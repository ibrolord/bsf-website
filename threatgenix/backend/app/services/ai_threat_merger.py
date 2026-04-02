"""B22 AI Threat Merger: Merges AI enhancement output with rule-based threats.

Takes the AI enhancement output (new threats + enrichments) and merges it with
existing rule-based threats to produce a single unified threat list.

The AI pass is ADDITIVE only -- it cannot remove or override rules engine threats.
Enrichments annotate existing threats with AI insights but do not change severity.
"""

from __future__ import annotations

from app.schemas.ai_pass import AIPassOutput, AIThreatRaw
from app.schemas.dfd import DFDNodeResponse
from app.schemas.rules import GeneratedThreat, RuleEngineOutput


def build_node_name_map(dfd_nodes: list[DFDNodeResponse]) -> dict[str, str]:
    """Build name->id map for resolving AI node references.

    Uses normalized matching (lowercase, stripped) since the AI may use
    slightly different casing than the original DFD node names.
    """
    return {node.name.lower().strip(): str(node.id) for node in dfd_nodes}


def _resolve_node_ids(
    description: str,
    node_name_to_id: dict[str, str],
) -> list[str]:
    """Extract node IDs from a description by checking for known node names.

    Scans the description text for any known node name (case-insensitive)
    and returns the corresponding node IDs. This compensates for AIThreatRaw
    not carrying structured affected_node_names.
    """
    description_lower = description.lower()
    found: list[str] = []
    for name_lower, node_id in node_name_to_id.items():
        if name_lower in description_lower and node_id not in found:
            found.append(node_id)
    return found


def _is_duplicate(
    ai_threat: AIThreatRaw,
    existing_threats: list[GeneratedThreat],
    ai_node_ids: list[str],
) -> bool:
    """Check if an AI threat duplicates an existing rule threat.

    Heuristic: same stride_category AND at least one overlapping
    affected_node_id -> likely duplicate -> skip.
    """
    for existing in existing_threats:
        if existing.stride_category != ai_threat.stride_category:
            continue
        existing_node_set = set(existing.affected_node_ids)
        if existing_node_set & set(ai_node_ids):
            return True
    return False


def merge_ai_threats(
    rules_output: RuleEngineOutput,
    ai_output: AIPassOutput,
    node_name_to_id: dict[str, str],
) -> list[GeneratedThreat]:
    """Merge AI-discovered threats with existing rule threats.

    Returns the full list: original rule threats + new AI threats.
    AI threats get new display_ids continuing from where rules left off.

    Args:
        rules_output: Output from the deterministic rules engine.
        ai_output: Output from the AI enhancement pass.
        node_name_to_id: Mapping of normalized (lowercase, stripped) node
            names to node IDs for resolving affected_node_ids.
    """
    # Start with copies of all rule threats so we can mutate enriched ones
    merged: list[GeneratedThreat] = [t.model_copy() for t in rules_output.threats]

    if not ai_output.threats:
        return merged

    # Separate new threats from enrichments
    new_threats: list[AIThreatRaw] = []
    enrichments: list[AIThreatRaw] = []
    for t in ai_output.threats:
        if t.enhances_rule_threat_id is not None:
            enrichments.append(t)
        else:
            new_threats.append(t)

    # --- Process enrichments ---
    # Build a lookup by display_id for O(1) access
    display_id_to_idx: dict[str, int] = {
        t.display_id: i for i, t in enumerate(merged)
    }

    for enrichment in enrichments:
        idx = display_id_to_idx.get(enrichment.enhances_rule_threat_id)  # type: ignore[arg-type]
        if idx is None:
            # No matching rule threat -- skip gracefully
            continue
        target = merged[idx]
        # Append AI insight to description
        merged[idx] = target.model_copy(
            update={
                "description": (
                    f"{target.description}\n\n"
                    f"[AI Insight] {enrichment.description}"
                ),
                "source": "AI+Rules",
            }
        )

    # --- Process new AI threats ---
    # Determine starting display_id number
    existing_display_nums: list[int] = []
    for t in merged:
        # Parse "T-NNN" format
        try:
            num = int(t.display_id.split("-", 1)[1])
            existing_display_nums.append(num)
        except (IndexError, ValueError):
            pass
    next_display_num = max(existing_display_nums, default=0) + 1

    ai_counter = 1
    for ai_threat in new_threats:
        node_ids = _resolve_node_ids(ai_threat.description, node_name_to_id)

        if _is_duplicate(ai_threat, rules_output.threats, node_ids):
            continue

        # Extract title from description if it follows the "Title: rest" format
        # produced by _parse_enhancement_response
        if ": " in ai_threat.description:
            threat_subtype = ai_threat.description.split(": ", 1)[0]
        else:
            threat_subtype = ai_threat.description[:80]

        merged.append(
            GeneratedThreat(
                rule_id=f"AI-{ai_counter:03d}",
                display_id=f"T-{next_display_num:03d}",
                stride_category=ai_threat.stride_category,
                threat_subtype=threat_subtype,
                severity=ai_threat.severity,
                description=ai_threat.description,
                affected_node_ids=node_ids,
                affected_edge_ids=[],
                source="AI",
            )
        )
        ai_counter += 1
        next_display_num += 1

    return merged
