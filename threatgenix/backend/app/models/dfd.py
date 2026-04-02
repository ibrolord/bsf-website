import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DFDNode(Base):
    __tablename__ = "dfd_nodes"
    __table_args__ = (
        CheckConstraint(
            "node_type IN ('process', 'data_store', 'external_entity')",
            name="ck_dfd_nodes_node_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("threat_models.id", ondelete="CASCADE"), nullable=False)
    node_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position_x: Mapped[float] = mapped_column(Float, default=0)
    position_y: Mapped[float] = mapped_column(Float, default=0)
    trust_boundary_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("trust_boundaries.id", ondelete="SET NULL"))
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    threat_model = relationship("ThreatModel", back_populates="nodes")


class DFDEdge(Base):
    __tablename__ = "dfd_edges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("threat_models.id", ondelete="CASCADE"), nullable=False)
    source_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dfd_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dfd_nodes.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), default="")
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    threat_model = relationship("ThreatModel", back_populates="edges")
    source_node = relationship("DFDNode", foreign_keys=[source_node_id])
    target_node = relationship("DFDNode", foreign_keys=[target_node_id])


class TrustBoundary(Base):
    __tablename__ = "trust_boundaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("threat_models.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="Trust Boundary")
    node_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    threat_model = relationship("ThreatModel", back_populates="trust_boundaries")
