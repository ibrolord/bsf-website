"""B21 AI Enhancement Service: Layer 2 of the hybrid threat engine.

After the rules engine (Layer 1) generates deterministic threats, this AI pass
reviews the DFD + existing threats and identifies:
1. Threats the rules missed (context-dependent, domain-specific)
2. Enrichments to existing threats (better descriptions, severity adjustments)

The AI pass is ADDITIVE only -- it cannot remove or override rules engine threats.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

from app.config import settings
from app.schemas.ai_pass import AIPassInput, AIPassOutput, AIThreatRaw
from app.schemas.dfd import DFDResponse
from app.schemas.rules import RuleEngineOutput
from app.schemas.threat import ThreatResponse
from app.services.bedrock_client import BedrockClient

logger = logging.getLogger(__name__)

# ─── Prompt Versioning ───────────────────────────────────────────────
AI_ENHANCEMENT_PROMPT_VERSION = "v1.0"

# ─── System Message ──────────────────────────────────────────────────
ENHANCEMENT_SYSTEM_MESSAGE = """\
You are a senior security architect at a Canadian bank, reviewing a Data Flow \
Diagram (DFD) and an existing set of rule-based STRIDE threats. Your goal is to \
identify threats that the automated rules missed and to enrich existing threats \
with more specific, banking-aware context.

## Your objectives

1. IDENTIFY MISSED THREATS that deterministic STRIDE rules cannot catch:
   - Business logic flaws (e.g., transaction replay, race conditions in balance \
updates, insufficient velocity checks)
   - Cryptographic weaknesses (e.g., weak key management, missing encryption \
at rest, improper TLS configuration)
   - Domain-specific regulatory risks (PCI DSS non-compliance, OSFI B-13 gaps, \
PIPEDA privacy violations, FINTRAC reporting failures)
   - Supply chain and third-party integration risks
   - Insider threat scenarios specific to the architecture
   - Session management and authentication bypass patterns
   - API-specific threats (mass assignment, BOLA, broken function-level auth)

2. ENRICH EXISTING THREATS with:
   - More specific descriptions referencing actual node names and data flows
   - Severity adjustments based on Canadian banking context (e.g., a threat \
affecting cardholder data in PCI scope should be Critical)
   - Regulatory context (which PCI DSS requirement, OSFI guideline, or \
PIPEDA principle is relevant)

## Rules
- Only add threats that are genuinely relevant to the architecture shown.
- Do not duplicate threats that already exist in the rules output.
- Each new threat must reference at least one affected node by name.
- Enrichments must reference the original threat's display_id.
- Severity must be one of: Critical, High, Medium, Low.
- STRIDE category must be one of: Spoofing, Tampering, Repudiation, \
Information Disclosure, Denial of Service, Elevation of Privilege.

You must call the enhance_threats tool with your findings. Do not respond \
with plain text."""

# ─── User Message Template ───────────────────────────────────────────
ENHANCEMENT_USER_TEMPLATE = """\
Review the following DFD and existing rule-based threats for the system \
"{system_name}" (data classification: {data_classification}).

## DFD Summary

### Nodes
{nodes_summary}

### Edges (Data Flows)
{edges_summary}

### Trust Boundaries
{boundaries_summary}

## Existing Rule-Based Threats ({threat_count} total)
{threats_summary}

## Document Excerpt
{doc_excerpt}

---

Analyze this architecture and call the enhance_threats tool with:
1. New threats the rules missed (focus on banking-specific, regulatory, and \
context-dependent risks)
2. Enrichments to existing threats (more specific descriptions, adjusted \
severity for banking context)"""

# ─── Tool Schema (Bedrock Converse API tool_use format) ──────────────
ENHANCE_THREATS_TOOL: dict[str, Any] = {
    "name": "enhance_threats",
    "description": (
        "Provide additional threats missed by rules and enrichments "
        "to existing threats"
    ),
    "inputSchema": {
        "json": {
            "type": "object",
            "properties": {
                "new_threats": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "stride_category": {
                                "type": "string",
                                "enum": [
                                    "Spoofing",
                                    "Tampering",
                                    "Repudiation",
                                    "Information Disclosure",
                                    "Denial of Service",
                                    "Elevation of Privilege",
                                ],
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["Critical", "High", "Medium", "Low"],
                            },
                            "description": {"type": "string"},
                            "affected_node_names": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "rationale": {"type": "string"},
                        },
                        "required": [
                            "title",
                            "stride_category",
                            "severity",
                            "description",
                            "affected_node_names",
                            "rationale",
                        ],
                    },
                },
                "enrichments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "original_display_id": {"type": "string"},
                            "enhanced_description": {"type": "string"},
                            "suggested_severity": {
                                "type": "string",
                                "enum": ["Critical", "High", "Medium", "Low"],
                            },
                            "rationale": {"type": "string"},
                        },
                        "required": [
                            "original_display_id",
                            "enhanced_description",
                            "rationale",
                        ],
                    },
                },
            },
            "required": ["new_threats", "enrichments"],
        }
    },
}

# ─── Valid STRIDE categories ─────────────────────────────────────────
VALID_STRIDE_CATEGORIES = frozenset(
    {
        "Spoofing",
        "Tampering",
        "Repudiation",
        "Information Disclosure",
        "Denial of Service",
        "Elevation of Privilege",
    }
)

VALID_SEVERITIES = frozenset({"Critical", "High", "Medium", "Low"})


def _empty_ai_output() -> AIPassOutput:
    """Return an empty AIPassOutput for graceful degradation."""
    return AIPassOutput(
        threats=[],
        model_id=settings.bedrock_model_id,
        input_tokens=0,
        output_tokens=0,
        latency_ms=0.0,
    )


def _summarize_nodes(dfd: DFDResponse) -> str:
    """Summarize DFD nodes as compact text for prompt context."""
    if not dfd.nodes:
        return "(no nodes)"
    lines = []
    for node in dfd.nodes:
        lines.append(f"- {node.name} ({node.node_type})")
    return "\n".join(lines)


def _summarize_edges(dfd: DFDResponse) -> str:
    """Summarize DFD edges as compact text for prompt context."""
    if not dfd.edges:
        return "(no data flows)"
    # Build a node ID -> name lookup
    node_names: dict[UUID, str] = {n.id: n.name for n in dfd.nodes}
    lines = []
    for edge in dfd.edges:
        src = node_names.get(edge.source_node_id, str(edge.source_node_id))
        tgt = node_names.get(edge.target_node_id, str(edge.target_node_id))
        label = edge.label or "(unlabeled)"
        lines.append(f"- {src} -> {tgt}: {label}")
    return "\n".join(lines)


def _summarize_boundaries(dfd: DFDResponse) -> str:
    """Summarize trust boundaries as compact text for prompt context."""
    if not dfd.trust_boundaries:
        return "(no trust boundaries)"
    node_names: dict[UUID, str] = {n.id: n.name for n in dfd.nodes}
    lines = []
    for boundary in dfd.trust_boundaries:
        contained = [
            node_names.get(nid, str(nid)) for nid in boundary.node_ids
        ]
        lines.append(f"- {boundary.name}: [{', '.join(contained)}]")
    return "\n".join(lines)


def _summarize_threats(threats: list[ThreatResponse]) -> str:
    """Summarize existing rule-based threats for prompt context."""
    if not threats:
        return "(no existing threats)"
    lines = []
    for t in threats:
        lines.append(
            f"- [{t.display_id}] ({t.stride_category}/{t.severity}) "
            f"{t.description[:120]}"
        )
    return "\n".join(lines)


def build_ai_pass_input(
    dfd: DFDResponse,
    rules_output: RuleEngineOutput,
    doc_excerpt: str,
) -> AIPassInput:
    """Build the input payload for the AI enhancement pass."""
    # Convert GeneratedThreat to ThreatResponse-compatible objects
    # We create minimal ThreatResponse objects from rule engine output
    from datetime import datetime, timezone
    from uuid import uuid4

    threat_responses: list[ThreatResponse] = []
    for gt in rules_output.threats:
        threat_responses.append(
            ThreatResponse(
                id=uuid4(),
                display_id=gt.display_id,
                description=gt.description,
                stride_category=gt.stride_category,
                severity=gt.severity,
                source=gt.source,
                status="Open",
                dismiss_reason=None,
                rule_id=gt.rule_id,
                ai_enhanced=False,
                original_rule_threat_id=None,
                affected_node_ids=[
                    UUID(nid) if isinstance(nid, str) else nid
                    for nid in gt.affected_node_ids
                ],
                affected_edge_ids=[
                    UUID(eid) if isinstance(eid, str) else eid
                    for eid in gt.affected_edge_ids
                ],
                created_at=datetime.now(timezone.utc),
            )
        )

    # Derive system name from DFD nodes (use first process name or fallback)
    system_name = "Unknown System"
    for node in dfd.nodes:
        if node.node_type == "process":
            system_name = node.name
            break

    # Derive data classification from trust boundaries or default
    data_classification = "Confidential"
    for boundary in dfd.trust_boundaries:
        name_lower = boundary.name.lower()
        if "pci" in name_lower or "cde" in name_lower:
            data_classification = "PCI-Restricted"
            break
        if "public" in name_lower or "dmz" in name_lower:
            data_classification = "Public-Facing"

    return AIPassInput(
        dfd=dfd,
        rules_threats=threat_responses,
        doc_excerpt=doc_excerpt[:500],
        system_name=system_name,
        data_classification=data_classification,
    )


def _parse_enhancement_response(
    tool_output: dict[str, Any],
) -> list[AIThreatRaw]:
    """Convert Bedrock tool_use response into a list of AIThreatRaw.

    Validates each item individually -- malformed items are dropped rather
    than failing the entire parse.
    """
    threats: list[AIThreatRaw] = []

    # Parse new threats
    for raw in tool_output.get("new_threats", []):
        try:
            category = raw["stride_category"]
            severity = raw["severity"]
            if category not in VALID_STRIDE_CATEGORIES:
                logger.debug(
                    "Skipping new threat with invalid STRIDE category: %s",
                    category,
                )
                continue
            if severity not in VALID_SEVERITIES:
                logger.debug(
                    "Skipping new threat with invalid severity: %s", severity
                )
                continue
            threats.append(
                AIThreatRaw(
                    description=f"{raw['title']}: {raw['description']}",
                    stride_category=category,
                    severity=severity,
                    enhances_rule_threat_id=None,
                    reasoning=raw["rationale"],
                )
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.debug("Skipping malformed new threat: %s -- %s", raw, exc)

    # Parse enrichments
    for raw in tool_output.get("enrichments", []):
        try:
            threats.append(
                AIThreatRaw(
                    description=raw["enhanced_description"],
                    stride_category="",  # enrichment, not a new category
                    severity=raw.get("suggested_severity", ""),
                    enhances_rule_threat_id=raw["original_display_id"],
                    reasoning=raw["rationale"],
                )
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.debug(
                "Skipping malformed enrichment: %s -- %s", raw, exc
            )

    return threats


def _enhance_sync(
    ai_input: AIPassInput,
    client: BedrockClient | None = None,
) -> AIPassOutput:
    """Synchronous Bedrock call for AI enhancement.

    Fallback chain:
    1. tool_use response -> parse directly
    2. If tool_use fails -> retry once with same prompt
    3. If both fail -> return empty AIPassOutput
    """
    import time

    if client is None:
        client = BedrockClient()

    user_message = ENHANCEMENT_USER_TEMPLATE.format(
        system_name=ai_input.system_name,
        data_classification=ai_input.data_classification,
        nodes_summary=_summarize_nodes(ai_input.dfd),
        edges_summary=_summarize_edges(ai_input.dfd),
        boundaries_summary=_summarize_boundaries(ai_input.dfd),
        threat_count=len(ai_input.rules_threats),
        threats_summary=_summarize_threats(ai_input.rules_threats),
        doc_excerpt=ai_input.doc_excerpt,
    )
    tools = [ENHANCE_THREATS_TOOL]

    start = time.monotonic()

    # Attempt 1
    tool_output = client.call_with_tools(
        system_message=ENHANCEMENT_SYSTEM_MESSAGE,
        user_message=user_message,
        tools=tools,
        prompt_version=AI_ENHANCEMENT_PROMPT_VERSION,
    )

    if tool_output is not None:
        elapsed_ms = (time.monotonic() - start) * 1000
        threats = _parse_enhancement_response(tool_output)
        logger.info(
            "ai_enhancement_complete prompt_version=%s threats=%d elapsed_ms=%.0f",
            AI_ENHANCEMENT_PROMPT_VERSION,
            len(threats),
            elapsed_ms,
        )
        return AIPassOutput(
            threats=threats,
            model_id=client.model_id,
            input_tokens=0,
            output_tokens=0,
            latency_ms=elapsed_ms,
        )

    # Attempt 2: retry once
    logger.warning(
        "ai_enhancement_retry prompt_version=%s reason=first_attempt_failed",
        AI_ENHANCEMENT_PROMPT_VERSION,
    )
    tool_output = client.call_with_tools(
        system_message=ENHANCEMENT_SYSTEM_MESSAGE,
        user_message=user_message,
        tools=tools,
        prompt_version=AI_ENHANCEMENT_PROMPT_VERSION,
    )

    if tool_output is not None:
        elapsed_ms = (time.monotonic() - start) * 1000
        threats = _parse_enhancement_response(tool_output)
        logger.info(
            "ai_enhancement_complete prompt_version=%s threats=%d elapsed_ms=%.0f",
            AI_ENHANCEMENT_PROMPT_VERSION,
            len(threats),
            elapsed_ms,
        )
        return AIPassOutput(
            threats=threats,
            model_id=client.model_id,
            input_tokens=0,
            output_tokens=0,
            latency_ms=elapsed_ms,
        )

    # Both attempts failed -- graceful degradation
    logger.warning(
        "ai_enhancement_failed prompt_version=%s returning empty result",
        AI_ENHANCEMENT_PROMPT_VERSION,
    )
    return _empty_ai_output()


async def enhance_threats(
    dfd: DFDResponse,
    rules_output: RuleEngineOutput,
    doc_excerpt: str,
    client: BedrockClient | None = None,
) -> tuple[AIPassOutput, str | None]:
    """Main async entry point. Runs AI enhancement in thread pool.

    Graceful degradation (F-24): returns empty AIPassOutput on any failure,
    including timeout. The second element of the tuple is None on success,
    or a human-readable skip reason string on failure.

    Args:
        dfd: The DFD for the system being analyzed.
        rules_output: Output from the rules engine (Layer 1).
        doc_excerpt: Raw text excerpt from the design document.
        client: Optional BedrockClient instance (for testing/DI).

    Returns:
        Tuple of (AIPassOutput, skip_reason). skip_reason is None when AI
        enhancement succeeded, or a string describing why it was skipped.
    """
    ai_input = build_ai_pass_input(dfd, rules_output, doc_excerpt)

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                _enhance_sync,
                ai_input,
                client,
            ),
            timeout=float(settings.bedrock_timeout_seconds),
        )
        return result, None
    except asyncio.TimeoutError:
        reason = f"AI enhancement timed out after {settings.bedrock_timeout_seconds}s"
        logger.warning(
            "ai_enhancement_timeout prompt_version=%s timeout_seconds=%d",
            AI_ENHANCEMENT_PROMPT_VERSION,
            settings.bedrock_timeout_seconds,
        )
        return _empty_ai_output(), reason
    except Exception as exc:
        reason = f"AI enhancement failed: {type(exc).__name__}"
        logger.warning(
            "ai_enhancement_unexpected_error prompt_version=%s error=%s",
            AI_ENHANCEMENT_PROMPT_VERSION,
            str(exc),
        )
        return _empty_ai_output(), reason
