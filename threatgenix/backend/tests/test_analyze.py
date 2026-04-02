"""Tests for POST /api/threat-models/{id}/analyze endpoint (Block B24)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.schemas.ai_pass import AIPassOutput, AIThreatRaw
from app.schemas.rules import GeneratedThreat, RuleEngineOutput

BASE_URL = "http://test"


async def override_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = override_get_db


def _analyze_url(threat_model_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/analyze"


class FakeThreatModel:
    def __init__(self, id: uuid.UUID | None = None):
        self.id = id or uuid.uuid4()
        self.system_name = "Test System"
        self.description = ""
        self.data_classification = "Internal"
        self.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.updated_at = datetime(2026, 1, 2, tzinfo=timezone.utc)


# Fixed UUIDs for deterministic tests
NODE_ID_1 = uuid.uuid4()
NODE_ID_2 = uuid.uuid4()
EDGE_ID = uuid.uuid4()
BOUNDARY_ID = uuid.uuid4()


def _make_fake_nodes_edges_boundaries():
    """Create fake DFD data that the rules engine can process."""

    class FakeNode:
        id = NODE_ID_1
        node_type = "process"
        name = "API Gateway"
        position_x = 0.0
        position_y = 0.0
        trust_boundary_id = None
        properties = {}

    class FakeNode2:
        id = NODE_ID_2
        node_type = "data_store"
        name = "User DB"
        position_x = 120.0
        position_y = 0.0
        trust_boundary_id = None
        properties = {}

    class FakeEdge:
        id = EDGE_ID
        source_node_id = NODE_ID_1
        target_node_id = NODE_ID_2
        label = "query"
        properties = {}

    class FakeBoundary:
        id = BOUNDARY_ID
        name = "DMZ"
        node_ids = [NODE_ID_1]

    return [FakeNode(), FakeNode2()], [FakeEdge()], [FakeBoundary()]


def _make_rule_engine_output() -> RuleEngineOutput:
    return RuleEngineOutput(
        threats=[
            GeneratedThreat(
                rule_id="S-01",
                display_id="T-001",
                stride_category="Spoofing",
                threat_subtype="Identity Spoofing",
                severity="High",
                description="An attacker may spoof the API Gateway.",
                affected_node_ids=[str(uuid.uuid4())],
                affected_edge_ids=[str(uuid.uuid4())],
                source="Rules",
            ),
        ],
        execution_time_ms=1.5,
        rules_evaluated=10,
        rules_fired=1,
    )


def _make_ai_output() -> AIPassOutput:
    return AIPassOutput(
        threats=[
            AIThreatRaw(
                description="Transaction Replay Attack: Attacker replays API Gateway transactions",
                stride_category="Tampering",
                severity="High",
                enhances_rule_threat_id=None,
                reasoning="Banking APIs are vulnerable to replay attacks.",
            ),
        ],
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        input_tokens=100,
        output_tokens=50,
        latency_ms=500.0,
    )


class FakeDocument:
    """Minimal fake Document model for DB queries."""
    id = uuid.uuid4()
    threat_model_id = uuid.uuid4()
    filename = "design.pdf"
    page_count = 5
    raw_text = "This is a banking system design document with PCI scope."
    uploaded_at = datetime(2026, 3, 1, tzinfo=timezone.utc)


def _mock_db_with_dfd(nodes, edges, boundaries, *, include_document: bool = True):
    """Create a mock DB that returns DFD data across sequential execute calls.

    For the analyze endpoint, the call order is:
    1. nodes query
    2. edges query
    3. boundaries query
    4. (if AI enabled) document query
    5. delete existing threats
    """
    call_count = 0

    async def mock_execute(stmt):
        nonlocal call_count
        call_count += 1
        mock_scalars = MagicMock()

        if call_count == 1:
            mock_scalars.all.return_value = nodes
        elif call_count == 2:
            mock_scalars.all.return_value = edges
        elif call_count == 3:
            mock_scalars.all.return_value = boundaries
        elif call_count == 4 and include_document:
            # Document query (scalar_one_or_none)
            mock_result = MagicMock()
            mock_result.scalars.return_value = mock_scalars
            mock_result.scalar_one_or_none.return_value = FakeDocument() if include_document else None
            return mock_result
        else:
            # delete statement or subsequent queries
            mock_scalars.all.return_value = []

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_result.scalar_one_or_none.return_value = None
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    mock_db.add = MagicMock()
    return mock_db


def _mock_db_with_dfd_rules_only(nodes, edges, boundaries):
    """Create a mock DB for rules_only=true (no document query needed)."""
    call_count = 0

    async def mock_execute(stmt):
        nonlocal call_count
        call_count += 1
        mock_scalars = MagicMock()

        if call_count == 1:
            mock_scalars.all.return_value = nodes
        elif call_count == 2:
            mock_scalars.all.return_value = edges
        elif call_count == 3:
            mock_scalars.all.return_value = boundaries
        else:
            # delete statement
            mock_scalars.all.return_value = []

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    mock_db.add = MagicMock()
    return mock_db


def _mock_db_empty():
    """Create a mock DB that returns empty nodes (first query)."""
    async def mock_execute(stmt):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    return mock_db


# ─── POST /analyze Tests ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_analyze_rules_only_returns_only_rule_threats():
    """POST analyze with rules_only=true -> only rule threats, no AI."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_output = _make_rule_engine_output()

    mock_db = _mock_db_with_dfd_rules_only(nodes, edges, boundaries)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.evaluate_rules", return_value=fake_output),
        patch("app.api.threats.enhance_threats", new_callable=AsyncMock) as mock_ai,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(
                _analyze_url(tm_id), params={"rules_only": "true"}
            )

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["display_id"] == "T-001"
    assert body[0]["source"] == "Rules"
    # AI should NOT have been called
    mock_ai.assert_not_awaited()


@pytest.mark.asyncio
async def test_analyze_with_ai_returns_rule_and_ai_threats():
    """POST analyze with rules_only=false + mocked AI -> rule + AI threats."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_rules_output = _make_rule_engine_output()
    fake_ai_output = _make_ai_output()

    mock_db = _mock_db_with_dfd(nodes, edges, boundaries)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    # merge_ai_threats will produce rule threats + AI threats
    merged_threats = list(fake_rules_output.threats) + [
        GeneratedThreat(
            rule_id="AI-001",
            display_id="T-002",
            stride_category="Tampering",
            threat_subtype="Transaction Replay Attack",
            severity="High",
            description="Transaction Replay Attack: Attacker replays API Gateway transactions",
            affected_node_ids=[str(NODE_ID_1)],
            affected_edge_ids=[],
            source="AI",
        ),
    ]

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.evaluate_rules", return_value=fake_rules_output),
        patch("app.api.threats.enhance_threats", new_callable=AsyncMock, return_value=fake_ai_output),
        patch("app.api.threats.merge_ai_threats", return_value=merged_threats),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_analyze_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    sources = {t["source"] for t in body}
    assert "Rules" in sources
    assert "AI" in sources
    assert body[0]["display_id"] == "T-001"
    assert body[1]["display_id"] == "T-002"


@pytest.mark.asyncio
async def test_analyze_ai_failure_graceful_degradation():
    """POST analyze with AI failure -> returns rule threats only."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_rules_output = _make_rule_engine_output()

    mock_db = _mock_db_with_dfd(nodes, edges, boundaries)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.evaluate_rules", return_value=fake_rules_output),
        patch(
            "app.api.threats.enhance_threats",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Bedrock unavailable"),
        ),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_analyze_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    # Should still return the rule threats despite AI failure
    assert len(body) == 1
    assert body[0]["source"] == "Rules"
    assert body[0]["display_id"] == "T-001"


@pytest.mark.asyncio
async def test_analyze_no_dfd_returns_400():
    """POST analyze with no DFD -> 400."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    mock_db = _mock_db_empty()

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_analyze_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 400
    assert "No DFD found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_analyze_invalid_model_returns_404():
    """POST analyze with invalid threat model -> 404."""
    tm_id = uuid.uuid4()

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_analyze_url(tm_id))

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


@pytest.mark.asyncio
async def test_analyze_is_idempotent():
    """POST analyze twice -> idempotent (same count each time)."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_output = _make_rule_engine_output()

    for _ in range(2):
        mock_db = _mock_db_with_dfd_rules_only(nodes, edges, boundaries)

        async def db_override():
            yield mock_db

        app.dependency_overrides[get_db] = db_override

        with (
            patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
            patch("app.api.threats.evaluate_rules", return_value=fake_output),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
                response = await client.post(
                    _analyze_url(tm_id), params={"rules_only": "true"}
                )

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1

    app.dependency_overrides[get_db] = override_get_db
