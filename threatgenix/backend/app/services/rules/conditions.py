from __future__ import annotations

from app.schemas.dfd import DFDEdgeResponse, DFDNodeResponse, TrustBoundaryResponse

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

SENSITIVE_KEYWORDS: tuple[str, ...] = (
    "password",
    "credential",
    "token",
    "secret",
    "key",
    "auth",
    "ssn",
    "sin",
    "account",
)

# ===========================================================================
# Spoofing (S)
# ===========================================================================


def condition_s01(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """External entity sends data to a process across a trust boundary."""
    return (
        crosses_boundary
        and source.node_type == "external_entity"
        and target.node_type == "process"
    )


def condition_s02(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Any flow crosses a trust boundary (general spoofing risk)."""
    return crosses_boundary


def condition_s03(node: DFDNodeResponse, context: dict) -> bool:
    """External entity exists (potential identity spoofing source)."""
    return node.node_type == "external_entity"


# ===========================================================================
# Tampering (T)
# ===========================================================================


def condition_t01(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Data flow crosses trust boundary (data in transit risk)."""
    return crosses_boundary


def condition_t02(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """External entity writes to a data store."""
    return (
        source.node_type == "external_entity"
        and target.node_type == "data_store"
    )


def condition_t03(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Flow targets a data store (write integrity risk)."""
    return target.node_type == "data_store"


def condition_t04(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Flow crosses boundary AND targets data store."""
    return crosses_boundary and target.node_type == "data_store"


# ===========================================================================
# Repudiation (R)
# ===========================================================================


def condition_r01(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """External entity interacts with system (no audit trail assumed)."""
    return (
        source.node_type == "external_entity"
        or target.node_type == "external_entity"
    )


def condition_r02(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Flow involves a process (process actions may not be logged)."""
    return source.node_type == "process" or target.node_type == "process"


def condition_r03(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Process writes to data store (modification without audit)."""
    return (
        source.node_type == "process"
        and target.node_type == "data_store"
    )


# ===========================================================================
# Information Disclosure (I)
# ===========================================================================


def condition_i01(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Data flow crosses trust boundary (exposure in transit)."""
    return crosses_boundary


def condition_i02(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Data store is read by external entity."""
    return (
        source.node_type == "data_store"
        and target.node_type == "external_entity"
    )


def condition_i03(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Flow from data store crosses boundary."""
    return crosses_boundary and source.node_type == "data_store"


def condition_i04(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Flow label contains sensitive keywords."""
    if not edge.label:
        return False
    label_lower = edge.label.lower()
    return any(keyword in label_lower for keyword in SENSITIVE_KEYWORDS)


# ===========================================================================
# Denial of Service (D)
# ===========================================================================


def condition_d01(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """External entity sends to a process (potential flood)."""
    return (
        source.node_type == "external_entity"
        and target.node_type == "process"
    )


def condition_d02(node: DFDNodeResponse, context: dict) -> bool:
    """Process node exists (potential resource exhaustion target)."""
    return node.node_type == "process"


def condition_d03(node: DFDNodeResponse, context: dict) -> bool:
    """Node is a single point of failure — has high connectivity (degree >= 4)."""
    node_id = str(node.id)
    all_edges: list[DFDEdgeResponse] = context.get("all_edges", [])
    degree = sum(
        1
        for e in all_edges
        if str(e.source_node_id) == node_id or str(e.target_node_id) == node_id
    )
    return degree >= 4


# ===========================================================================
# Elevation of Privilege (E)
# ===========================================================================


def condition_e01(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """External entity accesses a process across boundary."""
    return (
        crosses_boundary
        and source.node_type == "external_entity"
        and target.node_type == "process"
    )


def condition_e02(
    source: DFDNodeResponse,
    edge: DFDEdgeResponse,
    target: DFDNodeResponse,
    crosses_boundary: bool,
) -> bool:
    """Flow crosses trust boundary (privilege escalation vector)."""
    return crosses_boundary


def condition_e03(boundary: TrustBoundaryResponse, entry_count: int) -> bool:
    """Trust boundary has multiple entry points (>= 2 inbound flows from outside)."""
    return entry_count >= 2
