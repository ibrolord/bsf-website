"""Threats generate, list, and analyze endpoints (Block B19 + B13 + B23)."""

from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.dfd import DFDEdge, DFDNode, TrustBoundary
from app.models.document import Document
from app.models.threat import Threat
from app.schemas.dfd import (
    DFDEdgeResponse,
    DFDNodeResponse,
    DFDResponse,
    TrustBoundaryResponse,
)
from app.schemas.rules import RuleEngineOutput
from app.schemas.threat import AnalyzeResponse, ThreatResponse, ThreatSummary, ThreatTriageRequest
from app.services.ai_enhancement import enhance_threats
from app.services.ai_threat_merger import build_node_name_map, merge_ai_threats
from app.services.compliance_service import lookup_controls_batch
from app.services.rules.engine import evaluate_rules
from app.services.threat_model import get_threat_model

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/threat-models/{threat_model_id}",
    tags=["threats"],
)


@router.post("/threats/generate", response_model=RuleEngineOutput)
async def generate_threats(
    threat_model_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> RuleEngineOutput:
    """Run the rules engine against the DFD and persist generated threats."""
    # 1. Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    # 2. Load DFD from database
    nodes_result = await db.execute(
        select(DFDNode).where(DFDNode.threat_model_id == threat_model_id)
    )
    nodes = nodes_result.scalars().all()

    if not nodes:
        raise HTTPException(
            status_code=400,
            detail="No DFD found. Upload a document first.",
        )

    edges_result = await db.execute(
        select(DFDEdge).where(DFDEdge.threat_model_id == threat_model_id)
    )
    edges = edges_result.scalars().all()

    boundaries_result = await db.execute(
        select(TrustBoundary).where(TrustBoundary.threat_model_id == threat_model_id)
    )
    boundaries = boundaries_result.scalars().all()

    dfd_response = DFDResponse(
        nodes=[DFDNodeResponse.model_validate(n) for n in nodes],
        edges=[DFDEdgeResponse.model_validate(e) for e in edges],
        trust_boundaries=[TrustBoundaryResponse.model_validate(tb) for tb in boundaries],
    )

    # 3. Call the rules engine
    output = evaluate_rules(dfd_response)

    # 4. Persist generated threats (idempotent: delete existing rules-engine threats first)
    # Advisory lock prevents concurrent generate requests from duplicating threats.
    lock_key = threat_model_id.int % (2**63)
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
    await db.execute(
        delete(Threat).where(
            Threat.threat_model_id == threat_model_id,
            Threat.source == "Rules",
        )
    )

    for gt in output.threats:
        # Convert string UUIDs to UUID objects for ARRAY(UUID) columns
        affected_node_ids = [UUID(nid) for nid in gt.affected_node_ids]
        affected_edge_ids = [UUID(eid) for eid in gt.affected_edge_ids]

        threat = Threat(
            threat_model_id=threat_model_id,
            display_id=gt.display_id,
            description=gt.description,
            stride_category=gt.stride_category,
            threat_subtype=gt.threat_subtype,
            severity=gt.severity,
            source="Rules",
            status="Open",
            rule_id=gt.rule_id,
            affected_node_ids=affected_node_ids,
            affected_edge_ids=affected_edge_ids,
        )
        db.add(threat)

    await db.commit()

    # 5. Return the rule engine output
    return output


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    threat_model_id: UUID,
    rules_only: bool = Query(False, description="Skip AI enhancement pass"),
    db: AsyncSession = Depends(get_db),
) -> AnalyzeResponse:
    """Run the full 3-layer analysis pipeline (rules + optional AI enhancement).

    Layer 1: Rules engine (deterministic STRIDE threats).
    Layer 2: AI enhancement (context-dependent, banking-specific threats).
    Layer 3: Compliance mapping (handled at query time in GET /threats).

    Returns AnalyzeResponse with threats and ai_skipped_reason (null when AI
    enhancement succeeded, string reason when skipped).
    """
    # 1. Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    # 2. Load DFD from database
    nodes_result = await db.execute(
        select(DFDNode).where(DFDNode.threat_model_id == threat_model_id)
    )
    nodes = nodes_result.scalars().all()

    if not nodes:
        raise HTTPException(
            status_code=400,
            detail="No DFD found. Upload a document first.",
        )

    edges_result = await db.execute(
        select(DFDEdge).where(DFDEdge.threat_model_id == threat_model_id)
    )
    edges = edges_result.scalars().all()

    boundaries_result = await db.execute(
        select(TrustBoundary).where(TrustBoundary.threat_model_id == threat_model_id)
    )
    boundaries = boundaries_result.scalars().all()

    dfd_response = DFDResponse(
        nodes=[DFDNodeResponse.model_validate(n) for n in nodes],
        edges=[DFDEdgeResponse.model_validate(e) for e in edges],
        trust_boundaries=[TrustBoundaryResponse.model_validate(tb) for tb in boundaries],
    )

    # 3. Layer 1: Rules engine
    rules_output = evaluate_rules(dfd_response)

    # 4. Layer 2: AI enhancement (optional)
    all_threats = list(rules_output.threats)  # start with rule threats
    ai_skipped_reason: str | None = None

    if rules_only:
        ai_skipped_reason = "AI enhancement skipped (rules_only mode)"
    else:
        # Get doc excerpt from the most recent document
        doc_result = await db.execute(
            select(Document)
            .where(Document.threat_model_id == threat_model_id)
            .order_by(Document.uploaded_at.desc())
            .limit(1)
        )
        doc = doc_result.scalar_one_or_none()
        doc_excerpt = (doc.raw_text or "")[:500] if doc else ""

        try:
            ai_output, ai_skipped_reason = await enhance_threats(
                dfd_response, rules_output, doc_excerpt
            )
            if ai_skipped_reason is None:
                node_name_map = build_node_name_map(dfd_response.nodes)
                all_threats = merge_ai_threats(rules_output, ai_output, node_name_map)
        except Exception as exc:
            ai_skipped_reason = f"AI enhancement failed: {type(exc).__name__}"
            logger.warning("ai_enhancement_error in analyze: %s", exc)
            # Graceful degradation: return rules-only results

    # 5. Delete existing threats for this model (idempotent)
    # Advisory lock prevents concurrent analyze requests from duplicating threats
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": threat_model_id.int % (2**63)})
    await db.execute(
        delete(Threat).where(Threat.threat_model_id == threat_model_id)
    )

    # 6. Persist all threats (rules + AI) and build response list
    responses: list[ThreatResponse] = []
    now = datetime.now(timezone.utc)

    for gt in all_threats:
        affected_node_ids = [
            UUID(nid) if isinstance(nid, str) else nid
            for nid in gt.affected_node_ids
        ]
        affected_edge_ids = [
            UUID(eid) if isinstance(eid, str) else eid
            for eid in gt.affected_edge_ids
        ]

        threat_id = uuid4()
        threat = Threat(
            id=threat_id,
            threat_model_id=threat_model_id,
            display_id=gt.display_id,
            description=gt.description,
            stride_category=gt.stride_category,
            threat_subtype=gt.threat_subtype,
            severity=gt.severity,
            source=gt.source,
            status="Open",
            rule_id=gt.rule_id,
            ai_enhanced=gt.source in ("AI", "AI+Rules"),
            affected_node_ids=affected_node_ids,
            affected_edge_ids=affected_edge_ids,
        )
        db.add(threat)

        responses.append(
            ThreatResponse(
                id=threat_id,
                display_id=gt.display_id,
                description=gt.description,
                stride_category=gt.stride_category,
                threat_subtype=gt.threat_subtype,
                severity=gt.severity,
                source=gt.source,
                status="Open",
                dismiss_reason=None,
                rule_id=gt.rule_id,
                ai_enhanced=gt.source in ("AI", "AI+Rules"),
                original_rule_threat_id=None,
                affected_node_ids=affected_node_ids,
                affected_edge_ids=affected_edge_ids,
                created_at=now,
            )
        )

    await db.commit()

    # 7. Return AnalyzeResponse with threats and AI skip reason
    return AnalyzeResponse(threats=responses, ai_skipped_reason=ai_skipped_reason)


@router.get("/threats", response_model=list[ThreatResponse])
async def list_threats(
    threat_model_id: UUID,
    db: AsyncSession = Depends(get_db),
    stride_category: Optional[str] = Query(None, description="Filter by STRIDE category"),
) -> list[ThreatResponse]:
    """List all threats for a threat model, ordered by display_id."""
    # 1. Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    # 2. Query threats ordered by display_id, optionally filtered by STRIDE category
    stmt = select(Threat).where(Threat.threat_model_id == threat_model_id)
    if stride_category is not None:
        stmt = stmt.where(Threat.stride_category == stride_category)
    stmt = stmt.order_by(Threat.display_id)

    result = await db.execute(stmt)
    threats = result.scalars().all()

    # 3. Populate compliance controls
    controls_map = await lookup_controls_batch(db, threats)

    # 4. Return threat responses with compliance controls attached
    responses = []
    for t in threats:
        resp = ThreatResponse.model_validate(t)
        resp.compliance_controls = controls_map.get(t.id, [])
        responses.append(resp)
    return responses


@router.get("/threats/summary", response_model=ThreatSummary)
async def get_threats_summary(
    threat_model_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ThreatSummary:
    """Return threat counts grouped by STRIDE category, severity, and status."""
    # 1. Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    # 2. Load all threats for this model
    result = await db.execute(
        select(Threat).where(Threat.threat_model_id == threat_model_id)
    )
    threats = result.scalars().all()

    # 3. Count by category, severity, and status
    by_stride: dict[str, int] = dict(Counter(t.stride_category for t in threats))
    by_severity: dict[str, int] = dict(Counter(t.severity for t in threats))
    by_status: dict[str, int] = dict(Counter(t.status for t in threats))

    return ThreatSummary(
        total=len(threats),
        by_stride=by_stride,
        by_severity=by_severity,
        by_status=by_status,
    )


@router.patch("/threats/{threat_id}/triage", response_model=ThreatResponse)
async def triage_threat(
    threat_model_id: UUID,
    threat_id: UUID,
    body: ThreatTriageRequest,
    db: AsyncSession = Depends(get_db),
) -> ThreatResponse:
    """Accept or dismiss a threat (triage)."""
    # 1. Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    # 2. Load the threat by ID + threat_model_id
    result = await db.execute(
        select(Threat).where(
            Threat.id == threat_id,
            Threat.threat_model_id == threat_model_id,
        )
    )
    threat = result.scalar_one_or_none()
    if threat is None:
        raise HTTPException(status_code=404, detail="Threat not found")

    # 3. Validate: if Dismissed, dismiss_reason is required
    if body.status == "Dismissed" and not body.dismiss_reason:
        raise HTTPException(
            status_code=400,
            detail="dismiss_reason is required when status is Dismissed",
        )

    # 4. Update fields
    threat.status = body.status
    if body.status == "Accepted":
        threat.dismiss_reason = None
    else:
        threat.dismiss_reason = body.dismiss_reason

    await db.commit()
    await db.refresh(threat)

    # 5. Populate compliance controls and return
    controls_map = await lookup_controls_batch(db, [threat])
    resp = ThreatResponse.model_validate(threat)
    resp.compliance_controls = controls_map.get(threat.id, [])
    return resp
