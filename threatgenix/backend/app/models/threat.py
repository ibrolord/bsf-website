import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Threat(Base):
    __tablename__ = "threats"
    __table_args__ = (
        CheckConstraint(
            "stride_category IN ('Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege')",
            name="ck_threats_stride_category",
        ),
        CheckConstraint(
            "severity IN ('Critical', 'High', 'Medium', 'Low')",
            name="ck_threats_severity",
        ),
        CheckConstraint(
            "source IN ('Rules', 'AI', 'AI+Rules')",
            name="ck_threats_source",
        ),
        CheckConstraint(
            "status IN ('Open', 'Accepted', 'Dismissed')",
            name="ck_threats_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("threat_models.id", ondelete="CASCADE"), nullable=False)
    display_id: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    stride_category: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Open")
    dismiss_reason: Mapped[Optional[str]] = mapped_column(Text)
    threat_subtype: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rule_id: Mapped[Optional[str]] = mapped_column(String(50))
    ai_enhanced: Mapped[bool] = mapped_column(Boolean, default=False)
    original_rule_threat_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("threats.id"))
    affected_node_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    affected_edge_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    threat_model = relationship("ThreatModel", back_populates="threats")
