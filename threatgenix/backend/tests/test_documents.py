"""Tests for document upload endpoint (F-02)."""

import io
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.schemas.document import (
    DocumentParseResult,
    ParsedBoundary,
    ParsedComponent,
    ParsedFlow,
)

BASE_URL = "http://test"


async def override_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = override_get_db


def _api_url(threat_model_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/documents"


class FakeThreatModel:
    def __init__(self, id=None, system_name="Test System"):
        self.id = id or uuid.uuid4()
        self.system_name = system_name
        self.description = ""
        self.data_classification = "Internal"
        self.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.updated_at = datetime(2026, 1, 2, tzinfo=timezone.utc)


def _make_fake_parse_result() -> DocumentParseResult:
    return DocumentParseResult(
        components=[
            ParsedComponent(name="API Gateway", component_type="process", confidence=0.9, description="Gateway"),
            ParsedComponent(name="User DB", component_type="data_store", confidence=0.85, description="Database"),
        ],
        flows=[
            ParsedFlow(source="API Gateway", target="User DB", label="query", confidence=0.8),
        ],
        boundaries=[
            ParsedBoundary(name="DMZ", contains=["API Gateway"]),
        ],
        raw_text_excerpt="Sample text...",
    )


def _make_simple_pdf_bytes() -> bytes:
    """Create a minimal valid PDF using PyMuPDF."""
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test document content for threat modeling.")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_upload_valid_pdf_returns_201():
    """Upload a valid PDF -> 201 with parse result."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    fake_parse = _make_fake_parse_result()
    pdf_bytes = _make_simple_pdf_bytes()

    fake_doc_id = uuid.uuid4()

    # Build a mock DB that assigns an id when add() is called
    mock_db = AsyncMock()
    mock_db.add = MagicMock(side_effect=lambda obj: setattr(obj, "id", fake_doc_id))

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.documents.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.documents.validate_pdf", new_callable=AsyncMock, return_value=(pdf_bytes, 1)),
        patch("app.api.documents.extract_text_from_pdf", return_value="Test document content"),
        patch("app.api.documents.extract_components_from_text", new_callable=AsyncMock, return_value=fake_parse),
        patch("app.api.documents.generate_dfd_from_parse_result", new_callable=AsyncMock),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(
                _api_url(tm_id),
                files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            )

    # Reset override
    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "test.pdf"
    assert body["page_count"] == 1
    assert len(body["parse_result"]["components"]) == 2
    assert len(body["parse_result"]["flows"]) == 1
    assert len(body["parse_result"]["boundaries"]) == 1


@pytest.mark.asyncio
async def test_upload_threat_model_not_found_returns_404():
    """Upload to non-existent threat model -> 404."""
    tm_id = uuid.uuid4()

    with patch("app.api.documents.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(
                _api_url(tm_id),
                files={"file": ("test.pdf", io.BytesIO(b"fake"), "application/pdf")},
            )

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


@pytest.mark.asyncio
async def test_upload_non_pdf_returns_400():
    """Upload a non-PDF file -> 400 from validate_pdf."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)

    from fastapi import HTTPException

    async def mock_validate_pdf(file):
        raise HTTPException(status_code=400, detail="File is not a valid PDF.")

    with (
        patch("app.api.documents.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.documents.validate_pdf", side_effect=mock_validate_pdf),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(
                _api_url(tm_id),
                files={"file": ("readme.txt", io.BytesIO(b"not a pdf"), "text/plain")},
            )

    assert response.status_code == 400
    assert "not a valid PDF" in response.json()["detail"]


@pytest.mark.asyncio
async def test_validate_pdf_rejects_non_pdf():
    """Unit test: validate_pdf raises 400 for non-PDF bytes."""
    from unittest.mock import AsyncMock as AM

    from app.services.doc_parser import validate_pdf

    fake_file = AM()
    fake_file.read = AsyncMock(return_value=b"this is not a PDF file at all")
    fake_file.filename = "bad.txt"

    with pytest.raises(Exception) as exc_info:
        await validate_pdf(fake_file)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_validate_pdf_accepts_valid_pdf():
    """Unit test: validate_pdf accepts a real PDF and returns bytes + page count."""
    from app.services.doc_parser import validate_pdf

    pdf_bytes = _make_simple_pdf_bytes()

    fake_file = AsyncMock()
    fake_file.read = AsyncMock(return_value=pdf_bytes)
    fake_file.filename = "test.pdf"

    result_bytes, page_count = await validate_pdf(fake_file)
    assert result_bytes == pdf_bytes
    assert page_count == 1


def test_extract_text_from_pdf():
    """Unit test: extract_text_from_pdf returns text from PDF."""
    from app.services.doc_parser import extract_text_from_pdf

    pdf_bytes = _make_simple_pdf_bytes()
    text = extract_text_from_pdf(pdf_bytes)
    assert "Test document content" in text
