from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ComplianceMapping(Base):
    __tablename__ = "compliance_mappings"
    __table_args__ = (
        UniqueConstraint("stride_category", "threat_subtype", "nist_control_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stride_category: Mapped[str] = mapped_column(String(30), nullable=False)
    threat_subtype: Mapped[str] = mapped_column(String(100), nullable=False)
    nist_control_id: Mapped[str] = mapped_column(String(20), nullable=False)
    nist_control_name: Mapped[str] = mapped_column(String(255), nullable=False)
