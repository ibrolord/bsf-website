import uuid
from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.schemas.threat_model import ThreatModelListItem

BASE_URL = "http://test"
API_PREFIX = "/api/threat-models"


async def override_get_db():
    """Fake DB dependency that yields a mock session."""
    yield AsyncMock()


# Override the DB dependency for all tests in this module
app.dependency_overrides[get_db] = override_get_db


class FakeThreatModel:
    """A plain object that mimics ThreatModel ORM attributes for Pydantic's from_attributes."""

    def __init__(
        self,
        id: Optional[uuid.UUID] = None,
        system_name: str = "Test System",
        description: str = "A test system",
        data_classification: str = "Internal",
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self.id = id or uuid.uuid4()
        self.system_name = system_name
        self.description = description
        self.data_classification = data_classification
        self.created_at = created_at or datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.updated_at = updated_at or datetime(2026, 1, 2, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_create_threat_model_returns_201():
    fake_tm = FakeThreatModel()
    with patch("app.api.threat_models.create_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(
                API_PREFIX,
                json={
                    "system_name": "Test System",
                    "description": "A test system",
                    "data_classification": "Internal",
                },
            )
    assert response.status_code == 201
    body = response.json()
    assert body["system_name"] == "Test System"
    assert body["description"] == "A test system"
    assert body["data_classification"] == "Internal"
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


@pytest.mark.asyncio
async def test_list_threat_models_empty():
    with patch("app.api.threat_models.list_threat_models", new_callable=AsyncMock, return_value=[]):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(API_PREFIX)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_threat_models_sorted_by_updated_at_desc():
    items = [
        ThreatModelListItem(
            id=uuid.uuid4(),
            system_name="Newer",
            data_classification="Public",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
            threat_count=2,
        ),
        ThreatModelListItem(
            id=uuid.uuid4(),
            system_name="Older",
            data_classification="Internal",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
            threat_count=0,
        ),
    ]
    with patch("app.api.threat_models.list_threat_models", new_callable=AsyncMock, return_value=items):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(API_PREFIX)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["system_name"] == "Newer"
    assert body[1]["system_name"] == "Older"
    assert body[0]["threat_count"] == 2
    assert body[1]["threat_count"] == 0


@pytest.mark.asyncio
async def test_get_threat_model_by_id():
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    with patch("app.api.threat_models.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(f"{API_PREFIX}/{tm_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(tm_id)
    assert body["system_name"] == "Test System"


@pytest.mark.asyncio
async def test_get_threat_model_not_found():
    missing_id = uuid.uuid4()
    with patch("app.api.threat_models.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(f"{API_PREFIX}/{missing_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


@pytest.mark.asyncio
async def test_create_threat_model_missing_system_name():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        response = await client.post(
            API_PREFIX,
            json={
                "description": "No name",
                "data_classification": "Public",
            },
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_threat_model_invalid_data_classification():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        response = await client.post(
            API_PREFIX,
            json={
                "system_name": "Test",
                "data_classification": "TopSecret",
            },
        )
    assert response.status_code == 422
