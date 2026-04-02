"""Tests for DFD endpoint and generation service (F-04)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.schemas.dfd import DFDEdgeResponse, DFDNodeResponse, DFDResponse, TrustBoundaryResponse
from app.schemas.document import (
    DocumentParseResult,
    ParsedBoundary,
    ParsedComponent,
    ParsedFlow,
)
from app.services.dfd_generator import normalize_name, resolve_node_by_name
from app.services.dfd_layout import compute_layout

BASE_URL = "http://test"


async def override_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = override_get_db


def _api_url(threat_model_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/dfd"


class FakeThreatModel:
    def __init__(self, id=None):
        self.id = id or uuid.uuid4()
        self.system_name = "Test System"
        self.description = ""
        self.data_classification = "Internal"
        self.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.updated_at = datetime(2026, 1, 2, tzinfo=timezone.utc)


# ─── GET DFD Tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_dfd_empty_returns_200():
    """GET DFD when no DFD data exists -> 200 with empty lists."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)

    # Mock the DB queries to return empty results
    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.dfd.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_api_url(tm_id))

    assert response.status_code == 200
    body = response.json()
    assert body["nodes"] == []
    assert body["edges"] == []
    assert body["trust_boundaries"] == []

    # Reset override
    app.dependency_overrides[get_db] = override_get_db


@pytest.mark.asyncio
async def test_get_dfd_not_found_returns_404():
    """GET DFD for non-existent threat model -> 404."""
    tm_id = uuid.uuid4()

    with patch("app.api.dfd.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_api_url(tm_id))

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


@pytest.mark.asyncio
async def test_get_dfd_with_data_returns_nodes_edges_boundaries():
    """GET DFD returns populated DFD data."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    node_id_1 = uuid.uuid4()
    node_id_2 = uuid.uuid4()
    edge_id = uuid.uuid4()
    boundary_id = uuid.uuid4()

    class FakeNode:
        id = node_id_1
        node_type = "process"
        name = "API Gateway"
        position_x = 0.0
        position_y = 0.0
        trust_boundary_id = None
        properties = {}

    class FakeNode2:
        id = node_id_2
        node_type = "data_store"
        name = "User DB"
        position_x = 120.0
        position_y = 0.0
        trust_boundary_id = None
        properties = {}

    class FakeEdge:
        id = edge_id
        source_node_id = node_id_1
        target_node_id = node_id_2
        label = "query"
        properties = {}

    class FakeBoundary:
        id = boundary_id
        name = "DMZ"
        node_ids = [node_id_1]

    # Set up mock DB to return different results for each query
    call_count = 0

    async def mock_execute(stmt):
        nonlocal call_count
        call_count += 1
        mock_scalars = MagicMock()
        if call_count == 1:
            mock_scalars.all.return_value = [FakeNode(), FakeNode2()]
        elif call_count == 2:
            mock_scalars.all.return_value = [FakeEdge()]
        else:
            mock_scalars.all.return_value = [FakeBoundary()]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute = mock_execute

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.dfd.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_api_url(tm_id))

    assert response.status_code == 200
    body = response.json()
    assert len(body["nodes"]) == 2
    assert len(body["edges"]) == 1
    assert len(body["trust_boundaries"]) == 1
    assert body["nodes"][0]["name"] == "API Gateway"
    assert body["edges"][0]["label"] == "query"
    assert body["trust_boundaries"][0]["name"] == "DMZ"

    # Reset override
    app.dependency_overrides[get_db] = override_get_db


# ─── Name Normalization Tests (Block 8) ─────────────────────────────


def test_normalize_name_basic():
    assert normalize_name("API Gateway") == "api gateway"


def test_normalize_name_hyphens_underscores():
    assert normalize_name("api-gateway_service") == "api gateway service"


def test_normalize_name_extra_whitespace():
    assert normalize_name("  API   Gateway  ") == "api gateway"


def test_normalize_name_mixed():
    assert normalize_name("  My-Cool_Service  Name ") == "my cool service name"


def test_resolve_node_by_name_found():
    node_id = uuid.uuid4()
    nodes = {"api gateway": node_id}
    assert resolve_node_by_name("API Gateway", nodes) == node_id


def test_resolve_node_by_name_with_hyphens():
    node_id = uuid.uuid4()
    nodes = {"api gateway": node_id}
    assert resolve_node_by_name("api-gateway", nodes) == node_id


def test_resolve_node_by_name_not_found():
    nodes = {"api gateway": uuid.uuid4()}
    assert resolve_node_by_name("nonexistent", nodes) is None


# ─── Layout Tests (Block 10) ────────────────────────────────────────


def test_compute_layout_groups_by_type():
    nodes = [
        {"id": "1", "node_type": "external_entity"},
        {"id": "2", "node_type": "process"},
        {"id": "3", "node_type": "data_store"},
    ]
    positions = compute_layout(nodes, [])
    # external_entity at x=0, process at x=120, data_store at x=240
    assert positions["1"][0] == 0.0
    assert positions["2"][0] == 120.0
    assert positions["3"][0] == 240.0


def test_compute_layout_multiple_in_same_rank():
    nodes = [
        {"id": "1", "node_type": "process"},
        {"id": "2", "node_type": "process"},
        {"id": "3", "node_type": "process"},
    ]
    positions = compute_layout(nodes, [], nodesep=80)
    # All at x=120 (process rank), spaced by nodesep on y
    assert positions["1"][0] == 120.0
    assert positions["2"][0] == 120.0
    assert positions["3"][0] == 120.0
    # Y positions should be spaced
    assert positions["2"][1] - positions["1"][1] == 80.0


def test_compute_layout_empty():
    positions = compute_layout([], [])
    assert positions == {}
