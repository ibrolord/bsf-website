from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.report import ReportRequest
from app.schemas.threat_model import ThreatModelCreate, ThreatModelListItem, ThreatModelResponse
from app.services.pdf_report import generate_report
from app.services.threat_model import (
    create_threat_model,
    get_threat_model,
    list_threat_models,
)

router = APIRouter(prefix="/api/threat-models", tags=["threat-models"])


@router.post("", response_model=ThreatModelResponse, status_code=201)
async def create_threat_model_endpoint(
    data: ThreatModelCreate,
    db: AsyncSession = Depends(get_db),
) -> ThreatModelResponse:
    threat_model = await create_threat_model(db, data)
    return ThreatModelResponse.model_validate(threat_model)


@router.get("", response_model=list[ThreatModelListItem])
async def list_threat_models_endpoint(
    db: AsyncSession = Depends(get_db),
) -> list[ThreatModelListItem]:
    return await list_threat_models(db)


@router.get("/{threat_model_id}", response_model=ThreatModelResponse)
async def get_threat_model_endpoint(
    threat_model_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ThreatModelResponse:
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")
    return ThreatModelResponse.model_validate(threat_model)


@router.post("/{threat_model_id}/report")
async def get_report(
    threat_model_id: UUID,
    body: ReportRequest,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """F-14: Generate and return a PDF report for this threat model."""
    # Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    pdf_bytes = await generate_report(
        db,
        threat_model_id,
        dfd_image_base64=body.dfd_image_base64,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="threatmodel-{threat_model_id}.pdf"',
        },
    )
