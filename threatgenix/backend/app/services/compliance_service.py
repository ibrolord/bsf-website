from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance import ComplianceMapping
from app.schemas.threat import ComplianceControlRef


async def lookup_controls(
    db: AsyncSession,
    stride_category: str,
    threat_subtype: str,
) -> list[ComplianceControlRef]:
    """Look up NIST controls for a given stride_category + threat_subtype."""
    if not stride_category or not threat_subtype:
        return []

    stmt = select(ComplianceMapping).where(
        ComplianceMapping.stride_category == stride_category,
        ComplianceMapping.threat_subtype == threat_subtype,
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        ComplianceControlRef(
            nist_control_id=row.nist_control_id,
            nist_control_name=row.nist_control_name,
        )
        for row in rows
    ]


async def lookup_controls_batch(
    db: AsyncSession,
    threats: list,
) -> dict[uuid.UUID, list[ComplianceControlRef]]:
    """Batch lookup: for each threat, find matching compliance controls.

    Returns dict mapping threat_id -> list of ComplianceControlRef.
    Avoids N+1 by loading all relevant mappings in one query.
    """
    result_map: dict[uuid.UUID, list[ComplianceControlRef]] = {}

    # Collect unique (stride_category, threat_subtype) pairs from threats
    # that have a valid threat_subtype.
    pairs: set[tuple[str, str]] = set()
    for threat in threats:
        threat_subtype = getattr(threat, "threat_subtype", None)
        if not threat_subtype:
            result_map[threat.id] = []
            continue
        pairs.add((threat.stride_category, threat_subtype))

    if not pairs:
        # All threats lacked threat_subtype; fill remaining ids
        for threat in threats:
            result_map.setdefault(threat.id, [])
        return result_map

    # Build a single query with OR conditions for all pairs
    conditions = [
        and_(
            ComplianceMapping.stride_category == sc,
            ComplianceMapping.threat_subtype == st,
        )
        for sc, st in pairs
    ]
    stmt = select(ComplianceMapping).where(or_(*conditions))
    result = await db.execute(stmt)
    rows = result.scalars().all()

    # Group mappings by (stride_category, threat_subtype)
    mapping_index: dict[tuple[str, str], list[ComplianceControlRef]] = defaultdict(list)
    for row in rows:
        mapping_index[(row.stride_category, row.threat_subtype)].append(
            ComplianceControlRef(
                nist_control_id=row.nist_control_id,
                nist_control_name=row.nist_control_name,
            )
        )

    # Assign controls to each threat
    for threat in threats:
        threat_subtype = getattr(threat, "threat_subtype", None)
        if not threat_subtype:
            result_map.setdefault(threat.id, [])
        else:
            key = (threat.stride_category, threat_subtype)
            result_map[threat.id] = mapping_index.get(key, [])

    return result_map
