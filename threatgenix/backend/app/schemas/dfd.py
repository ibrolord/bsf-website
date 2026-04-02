from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DFDNodeCreate(BaseModel):
    node_type: Literal["process", "data_store", "external_entity"]
    name: str = Field(..., max_length=255)
    position_x: float = 0
    position_y: float = 0
    trust_boundary_id: Optional[UUID] = None


class DFDNodeResponse(BaseModel):
    id: UUID
    node_type: str
    name: str
    position_x: float
    position_y: float
    trust_boundary_id: Optional[UUID]
    properties: dict

    model_config = {"from_attributes": True}


class DFDNodeUpdate(BaseModel):
    name: Optional[str] = None
    node_type: Optional[Literal["process", "data_store", "external_entity"]] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    trust_boundary_id: Optional[UUID] = None


class DFDEdgeCreate(BaseModel):
    source_node_id: UUID
    target_node_id: UUID
    label: str = ""


class DFDEdgeResponse(BaseModel):
    id: UUID
    source_node_id: UUID
    target_node_id: UUID
    label: str
    properties: dict

    model_config = {"from_attributes": True}


class TrustBoundaryCreate(BaseModel):
    name: str = "Trust Boundary"
    node_ids: list[UUID]


class TrustBoundaryResponse(BaseModel):
    id: UUID
    name: str
    node_ids: list[UUID]

    model_config = {"from_attributes": True}


class DFDResponse(BaseModel):
    nodes: list[DFDNodeResponse]
    edges: list[DFDEdgeResponse]
    trust_boundaries: list[TrustBoundaryResponse]


class DFDBulkSave(BaseModel):
    nodes: list[DFDNodeCreate]
    edges: list[DFDEdgeCreate]
    trust_boundaries: list[TrustBoundaryCreate] = []
