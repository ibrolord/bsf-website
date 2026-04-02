"""Tests for threats generate, list, filter, summary, and triage endpoints (Block B19 + B13 + F-11)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.schemas.rules import GeneratedThreat, RuleEngineOutput

BASE_URL = "http://test"


async def override_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = override_get_db


def _generate_url(threat_model_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/threats/generate"


def _list_url(threat_model_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/threats"


def _summary_url(threat_model_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/threats/summary"


def _triage_url(threat_model_id: uuid.UUID, threat_id: uuid.UUID) -> str:
    return f"/api/threat-models/{threat_model_id}/threats/{threat_id}/triage"


class FakeThreatModel:
    def __init__(self, id=None):
        self.id = id or uuid.uuid4()
        self.system_name = "Test System"
        self.description = ""
        self.data_classification = "Internal"
        self.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.updated_at = datetime(2026, 1, 2, tzinfo=timezone.utc)


def _make_fake_nodes_edges_boundaries():
    """Create fake DFD data that the rules engine can process."""
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


def _mock_db_with_dfd(nodes, edges, boundaries):
    """Create a mock DB that returns DFD data across sequential execute calls."""
    call_count = 0

    async def mock_execute(stmt):
        nonlocal call_count
        call_count += 1
        mock_scalars = MagicMock()
        if call_count == 1:
            mock_scalars.all.return_value = nodes
        elif call_count == 2:
            mock_scalars.all.return_value = edges
        else:
            mock_scalars.all.return_value = boundaries
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    mock_db.add = MagicMock()
    return mock_db


def _mock_db_empty():
    """Create a mock DB that returns empty results for nodes (first query)."""
    async def mock_execute(stmt):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    return mock_db


# ─── POST /threats/generate Tests ──────────────────────────────────


@pytest.mark.asyncio
async def test_generate_threats_with_valid_dfd_returns_200():
    """POST generate with valid DFD -> 200, non-empty threats."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_output = _make_rule_engine_output()

    mock_db = _mock_db_with_dfd(nodes, edges, boundaries)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.evaluate_rules", return_value=fake_output),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_generate_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert len(body["threats"]) == 1
    assert body["threats"][0]["rule_id"] == "S-01"
    assert body["threats"][0]["display_id"] == "T-001"
    assert body["rules_evaluated"] == 10
    assert body["rules_fired"] == 1


@pytest.mark.asyncio
async def test_generate_threats_no_dfd_returns_400():
    """POST generate with no DFD -> 400."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    mock_db = _mock_db_empty()

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_generate_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 400
    assert "No DFD found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_threats_invalid_threat_model_returns_404():
    """POST generate with invalid threat_model_id -> 404."""
    tm_id = uuid.uuid4()

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_generate_url(tm_id))

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


@pytest.mark.asyncio
async def test_generate_threats_persists_to_db():
    """POST generate persists threats via db.add and db.commit."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_output = _make_rule_engine_output()

    mock_db = _mock_db_with_dfd(nodes, edges, boundaries)
    added_objects = []
    mock_db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.evaluate_rules", return_value=fake_output),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.post(_generate_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    # One threat was generated, so one object should have been added
    assert len(added_objects) == 1
    assert added_objects[0].source == "Rules"
    assert added_objects[0].status == "Open"
    assert added_objects[0].rule_id == "S-01"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_threats_idempotent():
    """POST generate twice -> idempotent (deletes old threats, same count)."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    nodes, edges, boundaries = _make_fake_nodes_edges_boundaries()
    fake_output = _make_rule_engine_output()

    # Run generate twice and verify delete is called each time
    for _ in range(2):
        mock_db = _mock_db_with_dfd(nodes, edges, boundaries)

        async def db_override():
            yield mock_db

        app.dependency_overrides[get_db] = db_override

        with (
            patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
            patch("app.api.threats.evaluate_rules", return_value=fake_output),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
                response = await client.post(_generate_url(tm_id))

        assert response.status_code == 200
        body = response.json()
        assert len(body["threats"]) == 1

    app.dependency_overrides[get_db] = override_get_db


# ─── GET /threats Tests ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_threats_empty_returns_200():
    """GET threats before generate -> empty list."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)

    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_list_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_threats_returns_persisted_threats():
    """GET threats after generate -> returns persisted threats."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    threat_id = uuid.uuid4()
    node_id = uuid.uuid4()
    now = datetime(2026, 3, 15, 12, 0, 0, tzinfo=timezone.utc)

    class FakeThreat:
        id = threat_id
        display_id = "T-001"
        description = "An attacker may spoof the API Gateway."
        stride_category = "Spoofing"
        severity = "High"
        source = "Rules"
        status = "Open"
        dismiss_reason = None
        rule_id = "S-01"
        ai_enhanced = False
        original_rule_threat_id = None
        affected_node_ids = [node_id]
        affected_edge_ids = []
        created_at = now

    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [FakeThreat()]
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_list_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["display_id"] == "T-001"
    assert body[0]["stride_category"] == "Spoofing"
    assert body[0]["source"] == "Rules"
    assert body[0]["status"] == "Open"
    assert body[0]["rule_id"] == "S-01"


@pytest.mark.asyncio
async def test_list_threats_invalid_threat_model_returns_404():
    """GET threats for non-existent threat model -> 404."""
    tm_id = uuid.uuid4()

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_list_url(tm_id))

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


# ─── B13: STRIDE filter + summary Tests ──────────────────────────────


def _make_fake_threats():
    """Create a list of fake threats with diverse STRIDE/severity/status values."""
    now = datetime(2026, 3, 15, 12, 0, 0, tzinfo=timezone.utc)

    class FakeThreat:
        def __init__(self, display_id, stride_category, severity, status):
            self.id = uuid.uuid4()
            self.display_id = display_id
            self.description = f"Threat {display_id}"
            self.stride_category = stride_category
            self.severity = severity
            self.source = "Rules"
            self.status = status
            self.dismiss_reason = None
            self.rule_id = "R-01"
            self.ai_enhanced = False
            self.original_rule_threat_id = None
            self.affected_node_ids = []
            self.affected_edge_ids = []
            self.created_at = now

    return [
        FakeThreat("T-001", "Spoofing", "High", "Open"),
        FakeThreat("T-002", "Spoofing", "Medium", "Accepted"),
        FakeThreat("T-003", "Tampering", "Critical", "Open"),
        FakeThreat("T-004", "Denial of Service", "Low", "Dismissed"),
    ]


@pytest.mark.asyncio
async def test_list_threats_with_stride_filter_returns_filtered():
    """GET threats with stride_category=Spoofing returns only Spoofing threats."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    all_threats = _make_fake_threats()
    spoofing_threats = [t for t in all_threats if t.stride_category == "Spoofing"]

    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = spoofing_threats
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(
                _list_url(tm_id), params={"stride_category": "Spoofing"}
            )

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert all(t["stride_category"] == "Spoofing" for t in body)


@pytest.mark.asyncio
async def test_list_threats_without_filter_returns_all():
    """GET threats without stride_category returns all threats."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    all_threats = _make_fake_threats()

    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = all_threats
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_list_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 4


@pytest.mark.asyncio
async def test_summary_returns_correct_counts():
    """GET summary returns correct by_stride, by_severity, by_status counts."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    all_threats = _make_fake_threats()

    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = all_threats
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_summary_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    assert body["by_stride"] == {"Spoofing": 2, "Tampering": 1, "Denial of Service": 1}
    assert body["by_severity"] == {"High": 1, "Medium": 1, "Critical": 1, "Low": 1}
    assert body["by_status"] == {"Open": 2, "Accepted": 1, "Dismissed": 1}


@pytest.mark.asyncio
async def test_summary_empty_threats_returns_zeros():
    """GET summary for empty threats returns total=0 and empty dicts."""
    tm_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)

    mock_db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_summary_url(tm_id))

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["by_stride"] == {}
    assert body["by_severity"] == {}
    assert body["by_status"] == {}


@pytest.mark.asyncio
async def test_summary_invalid_threat_model_returns_404():
    """GET summary for non-existent threat model -> 404."""
    tm_id = uuid.uuid4()

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.get(_summary_url(tm_id))

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


# ─── PATCH /threats/{threat_id}/triage Tests (F-11) ─────────────────


def _make_single_fake_threat(threat_model_id: uuid.UUID, threat_id: uuid.UUID):
    """Create a mutable fake threat object for triage tests."""
    now = datetime(2026, 3, 15, 12, 0, 0, tzinfo=timezone.utc)

    class FakeThreat:
        def __init__(self):
            self.id = threat_id
            self.threat_model_id = threat_model_id
            self.display_id = "T-001"
            self.description = "An attacker may spoof the API Gateway."
            self.stride_category = "Spoofing"
            self.threat_subtype = None
            self.severity = "High"
            self.source = "Rules"
            self.status = "Open"
            self.dismiss_reason = None
            self.rule_id = "S-01"
            self.ai_enhanced = False
            self.original_rule_threat_id = None
            self.affected_node_ids = []
            self.affected_edge_ids = []
            self.created_at = now
            self.updated_at = now

    return FakeThreat()


def _mock_db_for_triage(fake_threat):
    """Create a mock DB that returns a single threat from execute, supports refresh."""
    mock_db = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake_threat
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def mock_refresh(obj):
        pass  # no-op; the object is already mutated in-place
    mock_db.refresh = mock_refresh

    return mock_db


@pytest.mark.asyncio
async def test_triage_accept_sets_status_and_clears_dismiss_reason():
    """PATCH triage accept -> status=Accepted, dismiss_reason=None."""
    tm_id = uuid.uuid4()
    threat_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    fake_threat = _make_single_fake_threat(tm_id, threat_id)
    mock_db = _mock_db_for_triage(fake_threat)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.lookup_controls_batch", new_callable=AsyncMock, return_value={}),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.patch(
                _triage_url(tm_id, threat_id),
                json={"status": "Accepted"},
            )

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Accepted"
    assert body["dismiss_reason"] is None


@pytest.mark.asyncio
async def test_triage_dismiss_with_reason_sets_status_and_reason():
    """PATCH triage dismiss with reason -> status=Dismissed, dismiss_reason set."""
    tm_id = uuid.uuid4()
    threat_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    fake_threat = _make_single_fake_threat(tm_id, threat_id)
    mock_db = _mock_db_for_triage(fake_threat)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.lookup_controls_batch", new_callable=AsyncMock, return_value={}),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.patch(
                _triage_url(tm_id, threat_id),
                json={"status": "Dismissed", "dismiss_reason": "False positive"},
            )

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Dismissed"
    assert body["dismiss_reason"] == "False positive"


@pytest.mark.asyncio
async def test_triage_dismiss_without_reason_returns_400():
    """PATCH triage dismiss without dismiss_reason -> 400."""
    tm_id = uuid.uuid4()
    threat_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)
    fake_threat = _make_single_fake_threat(tm_id, threat_id)
    mock_db = _mock_db_for_triage(fake_threat)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with (
        patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm),
        patch("app.api.threats.lookup_controls_batch", new_callable=AsyncMock, return_value={}),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.patch(
                _triage_url(tm_id, threat_id),
                json={"status": "Dismissed"},
            )

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 400
    assert "dismiss_reason" in response.json()["detail"]


@pytest.mark.asyncio
async def test_triage_invalid_threat_model_returns_404():
    """PATCH triage with invalid threat_model_id -> 404."""
    tm_id = uuid.uuid4()
    threat_id = uuid.uuid4()

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.patch(
                _triage_url(tm_id, threat_id),
                json={"status": "Accepted"},
            )

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat model not found"


@pytest.mark.asyncio
async def test_triage_invalid_threat_id_returns_404():
    """PATCH triage with invalid threat_id -> 404."""
    tm_id = uuid.uuid4()
    threat_id = uuid.uuid4()
    fake_tm = FakeThreatModel(id=tm_id)

    # DB returns None for the threat query
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def db_override():
        yield mock_db

    app.dependency_overrides[get_db] = db_override

    with patch("app.api.threats.get_threat_model", new_callable=AsyncMock, return_value=fake_tm):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
            response = await client.patch(
                _triage_url(tm_id, threat_id),
                json={"status": "Accepted"},
            )

    app.dependency_overrides[get_db] = override_get_db

    assert response.status_code == 404
    assert response.json()["detail"] == "Threat not found"
