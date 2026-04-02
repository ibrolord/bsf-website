"""DFD endpoints: GET, individual CRUD, and bulk save (Blocks 11 + F-05)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.dfd import DFDEdge, DFDNode, TrustBoundary
from app.schemas.dfd import (
    DFDBulkSave,
    DFDEdgeCreate,
    DFDEdgeResponse,
    DFDNodeCreate,
    DFDNodeResponse,
    DFDNodeUpdate,
    DFDResponse,
    TrustBoundaryCreate,
    TrustBoundaryResponse,
)
from app.services.threat_model import get_threat_model

router = APIRouter(
    prefix="/api/threat-models/{threat_model_id}/dfd",
    tags=["dfd"],
)


async def _verify_threat_model(db: AsyncSession, threat_model_id: UUID) -> None:
    """Raise 404 if threat model does not exist."""
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")


# ─── GET DFD ───────────────────────────────────────────────────────────


@router.get("", response_model=DFDResponse)
async def get_dfd(
    threat_model_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> DFDResponse:
    """Get the DFD for a threat model. Returns empty lists if no DFD data exists."""
    await _verify_threat_model(db, threat_model_id)

    nodes_result = await db.execute(
        select(DFDNode).where(DFDNode.threat_model_id == threat_model_id)
    )
    nodes = nodes_result.scalars().all()

    edges_result = await db.execute(
        select(DFDEdge).where(DFDEdge.threat_model_id == threat_model_id)
    )
    edges = edges_result.scalars().all()

    boundaries_result = await db.execute(
        select(TrustBoundary).where(TrustBoundary.threat_model_id == threat_model_id)
    )
    boundaries = boundaries_result.scalars().all()

    return DFDResponse(
        nodes=[DFDNodeResponse.model_validate(n) for n in nodes],
        edges=[DFDEdgeResponse.model_validate(e) for e in edges],
        trust_boundaries=[TrustBoundaryResponse.model_validate(tb) for tb in boundaries],
    )


# ─── Block 1: Node CRUD ───────────────────────────────────────────────


@router.post("/nodes", response_model=DFDNodeResponse, status_code=201)
async def create_node(
    threat_model_id: UUID,
    data: DFDNodeCreate,
    db: AsyncSession = Depends(get_db),
) -> DFDNodeResponse:
    """Create a new DFD node."""
    await _verify_threat_model(db, threat_model_id)

    node = DFDNode(
        threat_model_id=threat_model_id,
        node_type=data.node_type,
        name=data.name,
        position_x=data.position_x,
        position_y=data.position_y,
        trust_boundary_id=data.trust_boundary_id,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return DFDNodeResponse.model_validate(node)


@router.patch("/nodes/{node_id}", response_model=DFDNodeResponse)
async def update_node(
    threat_model_id: UUID,
    node_id: UUID,
    data: DFDNodeUpdate,
    db: AsyncSession = Depends(get_db),
) -> DFDNodeResponse:
    """Update a DFD node (partial update)."""
    await _verify_threat_model(db, threat_model_id)

    result = await db.execute(
        select(DFDNode).where(
            DFDNode.id == node_id,
            DFDNode.threat_model_id == threat_model_id,
        )
    )
    node = result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(node, field, value)

    await db.commit()
    await db.refresh(node)
    return DFDNodeResponse.model_validate(node)


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(
    threat_model_id: UUID,
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a DFD node and cascade to connected edges."""
    await _verify_threat_model(db, threat_model_id)

    result = await db.execute(
        select(DFDNode).where(
            DFDNode.id == node_id,
            DFDNode.threat_model_id == threat_model_id,
        )
    )
    node = result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    # Delete connected edges (cascade from DB FK, but explicit for clarity)
    await db.execute(
        delete(DFDEdge).where(
            (DFDEdge.source_node_id == node_id) | (DFDEdge.target_node_id == node_id)
        )
    )
    await db.delete(node)
    await db.commit()
    return Response(status_code=204)


# ─── Block 2: Edge CRUD ───────────────────────────────────────────────


@router.post("/edges", response_model=DFDEdgeResponse, status_code=201)
async def create_edge(
    threat_model_id: UUID,
    data: DFDEdgeCreate,
    db: AsyncSession = Depends(get_db),
) -> DFDEdgeResponse:
    """Create a new DFD edge."""
    await _verify_threat_model(db, threat_model_id)

    edge = DFDEdge(
        threat_model_id=threat_model_id,
        source_node_id=data.source_node_id,
        target_node_id=data.target_node_id,
        label=data.label,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return DFDEdgeResponse.model_validate(edge)


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(
    threat_model_id: UUID,
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a DFD edge."""
    await _verify_threat_model(db, threat_model_id)

    result = await db.execute(
        select(DFDEdge).where(
            DFDEdge.id == edge_id,
            DFDEdge.threat_model_id == threat_model_id,
        )
    )
    edge = result.scalar_one_or_none()
    if edge is None:
        raise HTTPException(status_code=404, detail="Edge not found")

    await db.delete(edge)
    await db.commit()
    return Response(status_code=204)


# ─── Block 3: Trust Boundary CRUD ─────────────────────────────────────


@router.post("/boundaries", response_model=TrustBoundaryResponse, status_code=201)
async def create_boundary(
    threat_model_id: UUID,
    data: TrustBoundaryCreate,
    db: AsyncSession = Depends(get_db),
) -> TrustBoundaryResponse:
    """Create a new trust boundary."""
    await _verify_threat_model(db, threat_model_id)

    boundary = TrustBoundary(
        threat_model_id=threat_model_id,
        name=data.name,
        node_ids=data.node_ids,
    )
    db.add(boundary)
    await db.commit()
    await db.refresh(boundary)
    return TrustBoundaryResponse.model_validate(boundary)


@router.delete("/boundaries/{boundary_id}", status_code=204)
async def delete_boundary(
    threat_model_id: UUID,
    boundary_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a trust boundary."""
    await _verify_threat_model(db, threat_model_id)

    result = await db.execute(
        select(TrustBoundary).where(
            TrustBoundary.id == boundary_id,
            TrustBoundary.threat_model_id == threat_model_id,
        )
    )
    boundary = result.scalar_one_or_none()
    if boundary is None:
        raise HTTPException(status_code=404, detail="Trust boundary not found")

    await db.delete(boundary)
    await db.commit()
    return Response(status_code=204)


# ─── Block 4: Bulk Save ───────────────────────────────────────────────


@router.put("", response_model=DFDResponse)
async def bulk_save_dfd(
    threat_model_id: UUID,
    data: DFDBulkSave,
    db: AsyncSession = Depends(get_db),
) -> DFDResponse:
    """Replace the entire DFD state (delete-then-create)."""
    await _verify_threat_model(db, threat_model_id)

    # Delete existing DFD data (edges first due to FK constraints)
    await db.execute(delete(DFDEdge).where(DFDEdge.threat_model_id == threat_model_id))
    await db.execute(delete(DFDNode).where(DFDNode.threat_model_id == threat_model_id))
    await db.execute(delete(TrustBoundary).where(TrustBoundary.threat_model_id == threat_model_id))

    # Create nodes
    db_nodes: list[DFDNode] = []
    for node_data in data.nodes:
        node = DFDNode(
            threat_model_id=threat_model_id,
            node_type=node_data.node_type,
            name=node_data.name,
            position_x=node_data.position_x,
            position_y=node_data.position_y,
            trust_boundary_id=node_data.trust_boundary_id,
        )
        db.add(node)
        db_nodes.append(node)

    await db.flush()

    # Build name->id map for edge resolution
    name_to_id: dict[str, UUID] = {}
    for node in db_nodes:
        name_to_id[node.name] = node.id

    # Create edges
    db_edges: list[DFDEdge] = []
    for edge_data in data.edges:
        edge = DFDEdge(
            threat_model_id=threat_model_id,
            source_node_id=edge_data.source_node_id,
            target_node_id=edge_data.target_node_id,
            label=edge_data.label,
        )
        db.add(edge)
        db_edges.append(edge)

    # Create trust boundaries
    db_boundaries: list[TrustBoundary] = []
    for boundary_data in data.trust_boundaries:
        boundary = TrustBoundary(
            threat_model_id=threat_model_id,
            name=boundary_data.name,
            node_ids=boundary_data.node_ids,
        )
        db.add(boundary)
        db_boundaries.append(boundary)

    await db.commit()

    # Refresh all objects for response
    for node in db_nodes:
        await db.refresh(node)
    for edge in db_edges:
        await db.refresh(edge)
    for boundary in db_boundaries:
        await db.refresh(boundary)

    return DFDResponse(
        nodes=[DFDNodeResponse.model_validate(n) for n in db_nodes],
        edges=[DFDEdgeResponse.model_validate(e) for e in db_edges],
        trust_boundaries=[TrustBoundaryResponse.model_validate(tb) for tb in db_boundaries],
    )
