"""Document upload endpoint (Block 6)."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentParseResult, DocumentUploadResponse
from app.services.ai_extraction import extract_components_from_text
from app.services.dfd_generator import generate_dfd_from_parse_result
from app.services.doc_parser import extract_text_from_pdf, validate_pdf
from app.services.threat_model import get_threat_model

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/threat-models/{threat_model_id}/documents",
    tags=["documents"],
)


@router.post("", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    threat_model_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadResponse:
    """Upload a PDF document, extract components, and auto-generate DFD."""
    # Verify threat model exists
    threat_model = await get_threat_model(db, threat_model_id)
    if threat_model is None:
        raise HTTPException(status_code=404, detail="Threat model not found")

    # Validate PDF
    pdf_bytes, page_count = await validate_pdf(file)

    # Extract text from PDF
    raw_text = extract_text_from_pdf(pdf_bytes)

    # Extract components using AI
    parse_result: DocumentParseResult = await extract_components_from_text(
        raw_text=raw_text,
        system_name=threat_model.system_name,
    )

    # Store Document record
    document = Document(
        threat_model_id=threat_model_id,
        filename=file.filename or "untitled.pdf",
        page_count=page_count,
        raw_text=raw_text,
        parsed_components=parse_result.model_dump(),
        parsed_at=datetime.now(timezone.utc),
    )
    db.add(document)

    # Auto-generate DFD from parse result
    await generate_dfd_from_parse_result(db, threat_model_id, parse_result)

    await db.commit()
    await db.refresh(document)

    return DocumentUploadResponse(
        document_id=document.id,
        filename=document.filename,
        page_count=document.page_count,
        parse_result=parse_result,
    )
