from __future__ import annotations

import time
from typing import Any

from app.schemas.dfd import DFDResponse, DFDNodeResponse, TrustBoundaryResponse
from app.schemas.rules import GeneratedThreat, RuleEngineOutput
from app.services.rules.boundary import crosses_trust_boundary
from app.services.rules.loader import LoadedRule, load_rules
from app.services.rules.renderer import build_context, render_description

# ---------------------------------------------------------------------------
# STRIDE category sort order
# ---------------------------------------------------------------------------
_STRIDE_ORDER: dict[str, int] = {
    "Spoofing": 0,
    "Tampering": 1,
    "Repudiation": 2,
    "Information Disclosure": 3,
    "Denial of Service": 4,
    "Elevation of Privilege": 5,
}

# ---------------------------------------------------------------------------
# Module-level cached rules
# ---------------------------------------------------------------------------
_CACHED_RULES: list[LoadedRule] | None = None


def _get_rules() -> list[LoadedRule]:
    global _CACHED_RULES
    if _CACHED_RULES is None:
        _CACHED_RULES = load_rules()
    return _CACHED_RULES


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def evaluate_rules(dfd: DFDResponse) -> RuleEngineOutput:
    """Evaluate all STRIDE rules against a DFD. Returns deterministic results."""
    start = time.perf_counter()

    rules = _get_rules()
    rules_sorted = sorted(rules, key=lambda r: r.rule_id)

    # Step 2: build lookup maps, sort nodes by ID
    node_map: dict[str, DFDNodeResponse] = {str(n.id): n for n in dfd.nodes}
    sorted_nodes = sorted(dfd.nodes, key=lambda n: str(n.id))
    sorted_edges = sorted(dfd.edges, key=lambda e: str(e.id))
    sorted_boundaries = sorted(dfd.trust_boundaries, key=lambda b: str(b.id))

    # Step 3: extract tuples from edges
    edge_tuples: list[tuple[DFDNodeResponse, Any, DFDNodeResponse, bool, str | None]] = []
    for edge in sorted_edges:
        source = node_map.get(str(edge.source_node_id))
        target = node_map.get(str(edge.target_node_id))
        if source is None or target is None:
            continue
        crosses, boundary_name = crosses_trust_boundary(
            str(edge.source_node_id),
            str(edge.target_node_id),
            dfd.trust_boundaries,
        )
        edge_tuples.append((source, edge, target, crosses, boundary_name))

    # Separate rules by condition_type
    tuple_rules = [r for r in rules_sorted if r.condition_type == "tuple"]
    standalone_rules = [r for r in rules_sorted if r.condition_type == "standalone"]
    boundary_rules = [r for r in rules_sorted if r.condition_type == "boundary"]

    # Collect raw threats before dedup
    # Each entry: (rule_id, stride_category, threat_subtype, severity, description,
    #              affected_node_ids_frozenset, affected_node_ids_list,
    #              affected_edge_ids_list)
    raw_threats: list[tuple[str, str, str, str, str, frozenset[str], list[str], list[str]]] = []
    rules_evaluated = 0
    fired_rule_ids: set[str] = set()

    # Step 4: tuple-based rules
    for source, edge, target, crosses, boundary_name in edge_tuples:
        for rule in tuple_rules:
            rules_evaluated += 1
            if rule.requires_boundary_crossing and not crosses:
                continue
            if rule.condition_function(source, edge, target, crosses):
                ctx = build_context(
                    source=source,
                    edge=edge,
                    target=target,
                    boundary_name=boundary_name,
                )
                description = render_description(rule.description_template, ctx)
                node_ids_frozen = frozenset([str(source.id), str(target.id)])
                raw_threats.append((
                    rule.rule_id,
                    rule.stride_category,
                    rule.threat_subtype,
                    rule.severity,
                    description,
                    node_ids_frozen,
                    sorted(node_ids_frozen),
                    [str(edge.id)],
                ))
                fired_rule_ids.add(rule.rule_id)

    # Step 5: standalone rules
    for node in sorted_nodes:
        for rule in standalone_rules:
            rules_evaluated += 1
            context = {
                "all_nodes": dfd.nodes,
                "all_edges": dfd.edges,
                "boundaries": dfd.trust_boundaries,
            }
            if rule.condition_function(node, context):
                ctx = build_context(node=node)
                description = render_description(rule.description_template, ctx)
                node_ids_frozen = frozenset([str(node.id)])
                raw_threats.append((
                    rule.rule_id,
                    rule.stride_category,
                    rule.threat_subtype,
                    rule.severity,
                    description,
                    node_ids_frozen,
                    sorted(node_ids_frozen),
                    [],
                ))
                fired_rule_ids.add(rule.rule_id)

    # Step 6: boundary rules
    for boundary in sorted_boundaries:
        boundary_node_ids_set = {str(nid) for nid in boundary.node_ids}
        # Count entry points: edges from outside the boundary into the boundary
        entry_count = 0
        for edge in sorted_edges:
            src_id = str(edge.source_node_id)
            tgt_id = str(edge.target_node_id)
            if tgt_id in boundary_node_ids_set and src_id not in boundary_node_ids_set:
                entry_count += 1

        for rule in boundary_rules:
            rules_evaluated += 1
            if rule.condition_function(boundary, entry_count):
                ctx = build_context(
                    boundary_name=boundary.name,
                    extra={"entry_count": str(entry_count)},
                )
                description = render_description(rule.description_template, ctx)
                node_ids_frozen = frozenset(str(nid) for nid in boundary.node_ids)
                raw_threats.append((
                    rule.rule_id,
                    rule.stride_category,
                    rule.threat_subtype,
                    rule.severity,
                    description,
                    node_ids_frozen,
                    sorted(node_ids_frozen),
                    [],
                ))
                fired_rule_ids.add(rule.rule_id)

    # Step 7: deduplicate by rule_id — each rule fires at most once,
    # merging all affected node/edge IDs from duplicate firings.
    merged: dict[str, list] = {}
    for threat in raw_threats:
        rid = threat[0]
        if rid not in merged:
            # Store as list so we can mutate node_ids and edge_ids
            merged[rid] = list(threat)
        else:
            # Merge affected_node_ids (frozenset at index 5) and edge_ids (list at index 7)
            merged[rid][5] = merged[rid][5] | threat[5]  # union of frozensets
            merged[rid][6] = sorted(merged[rid][5])       # update sorted list
            for eid in threat[7]:
                if eid not in merged[rid][7]:
                    merged[rid][7].append(eid)
    deduped: list[tuple[str, str, str, str, str, frozenset[str], list[str], list[str]]] = [
        tuple(v) for v in merged.values()
    ]

    # Step 8: sort and assign display_ids
    deduped.sort(key=lambda t: (
        _STRIDE_ORDER.get(t[1], 99),
        t[0],   # rule_id
        t[6],   # sorted node_ids list
    ))

    threats: list[GeneratedThreat] = []
    for idx, t in enumerate(deduped, start=1):
        threats.append(GeneratedThreat(
            rule_id=t[0],
            display_id=f"T-{idx:03d}",
            stride_category=t[1],
            threat_subtype=t[2],
            severity=t[3],
            description=t[4],
            affected_node_ids=t[6],
            affected_edge_ids=t[7],
            source="Rules",
        ))

    elapsed_ms = (time.perf_counter() - start) * 1000.0

    return RuleEngineOutput(
        threats=threats,
        execution_time_ms=elapsed_ms,
        rules_evaluated=rules_evaluated,
        rules_fired=len(fired_rule_ids),
    )
