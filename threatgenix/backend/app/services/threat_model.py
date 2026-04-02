from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.threat import Threat
from app.models.threat_model import ThreatModel
from app.schemas.threat_model import ThreatModelCreate, ThreatModelListItem


async def create_threat_model(db: AsyncSession, data: ThreatModelCreate) -> ThreatModel:
    threat_model = ThreatModel(
        system_name=data.system_name,
        description=data.description,
        data_classification=data.data_classification,
    )
    db.add(threat_model)
    await db.commit()
    await db.refresh(threat_model)
    return threat_model


async def list_threat_models(db: AsyncSession) -> list[ThreatModelListItem]:
    stmt = (
        select(
            ThreatModel.id,
            ThreatModel.system_name,
            ThreatModel.data_classification,
            ThreatModel.created_at,
            ThreatModel.updated_at,
            func.count(Threat.id).label("threat_count"),
        )
        .outerjoin(Threat, ThreatModel.id == Threat.threat_model_id)
        .group_by(ThreatModel.id)
        .order_by(ThreatModel.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [ThreatModelListItem.model_validate(row._asdict()) for row in rows]


async def get_threat_model(db: AsyncSession, threat_model_id: UUID) -> Optional[ThreatModel]:
    stmt = select(ThreatModel).where(ThreatModel.id == threat_model_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
