"""Tests for B21 AI Enhancement Service."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.schemas.ai_pass import AIPassOutput, AIThreatRaw
from app.schemas.dfd import (
    DFDEdgeResponse,
    DFDNodeResponse,
    DFDResponse,
    TrustBoundaryResponse,
)
from app.schemas.rules import GeneratedThreat, RuleEngineOutput
from app.services.ai_enhancement import (
    AI_ENHANCEMENT_PROMPT_VERSION,
    VALID_STRIDE_CATEGORIES,
    _enhance_sync,
    _parse_enhancement_response,
    build_ai_pass_input,
    enhance_threats,
)


# ─── Fixtures ────────────────────────────────────────────────────────


def _make_dfd() -> DFDResponse:
    """Create a minimal DFD for testing."""
    node1_id = uuid4()
    node2_id = uuid4()
    node3_id = uuid4()
    return DFDResponse(
        nodes=[
            DFDNodeResponse(
                id=node1_id,
                node_type="process",
                name="API Gateway",
                position_x=0,
                position_y=0,
                trust_boundary_id=None,
                properties={},
            ),
            DFDNodeResponse(
                id=node2_id,
                node_type="data_store",
                name="Customer Database",
                position_x=100,
                position_y=0,
                trust_boundary_id=None,
                properties={},
            ),
            DFDNodeResponse(
                id=node3_id,
                node_type="external_entity",
                name="Mobile App User",
                position_x=200,
                position_y=0,
                trust_boundary_id=None,
                properties={},
            ),
        ],
        edges=[
            DFDEdgeResponse(
                id=uuid4(),
                source_node_id=node1_id,
                target_node_id=node2_id,
                label="query customer data",
                properties={},
            ),
        ],
        trust_boundaries=[
            TrustBoundaryResponse(
                id=uuid4(),
                name="PCI CDE",
                node_ids=[node1_id, node2_id],
            ),
        ],
    )


def _make_rules_output() -> RuleEngineOutput:
    """Create a minimal RuleEngineOutput for testing."""
    node_id = str(uuid4())
    edge_id = str(uuid4())
    return RuleEngineOutput(
        threats=[
            GeneratedThreat(
                rule_id="S-01",
                display_id="T-001",
                stride_category="Spoofing",
                threat_subtype="Identity Spoofing",
                severity="High",
                description="An attacker could spoof the API Gateway identity",
                affected_node_ids=[node_id],
                affected_edge_ids=[edge_id],
                source="Rules",
            ),
        ],
        execution_time_ms=15.0,
        rules_evaluated=20,
        rules_fired=1,
    )


def _make_bedrock_tool_response() -> dict:
    """Simulate a successful Bedrock tool_use response."""
    return {
        "new_threats": [
            {
                "title": "Race Condition in Balance Update",
                "stride_category": "Tampering",
                "severity": "Critical",
                "description": (
                    "Concurrent transactions could exploit a race condition "
                    "in the Customer Database balance update path"
                ),
                "affected_node_names": ["Customer Database", "API Gateway"],
                "rationale": (
                    "The DFD shows direct data flow from API Gateway to "
                    "Customer Database without explicit transaction isolation"
                ),
            },
            {
                "title": "Missing Audit Trail for Data Access",
                "stride_category": "Repudiation",
                "severity": "High",
                "description": (
                    "No evidence of audit logging for customer data queries "
                    "through the API Gateway"
                ),
                "affected_node_names": ["API Gateway"],
                "rationale": (
                    "PCI DSS Requirement 10 mandates tracking all access "
                    "to cardholder data"
                ),
            },
        ],
        "enrichments": [
            {
                "original_display_id": "T-001",
                "enhanced_description": (
                    "An attacker could spoof the API Gateway identity by "
                    "exploiting missing mutual TLS between Mobile App User "
                    "and API Gateway, potentially accessing PCI CDE resources"
                ),
                "suggested_severity": "Critical",
                "rationale": (
                    "Severity elevated to Critical because the API Gateway "
                    "sits within the PCI CDE boundary"
                ),
            },
        ],
    }


# ─── Tests ───────────────────────────────────────────────────────────


class TestBuildAIPassInput:
    """Tests for build_ai_pass_input."""

    def test_produces_correct_structure(self):
        dfd = _make_dfd()
        rules_output = _make_rules_output()
        doc_excerpt = "This is a sample banking system design document."

        result = build_ai_pass_input(dfd, rules_output, doc_excerpt)

        assert result.dfd is dfd
        assert len(result.rules_threats) == 1
        assert result.rules_threats[0].display_id == "T-001"
        assert result.rules_threats[0].stride_category == "Spoofing"
        assert result.doc_excerpt == doc_excerpt
        assert result.system_name == "API Gateway"  # first process node
        assert result.data_classification == "PCI-Restricted"  # from PCI CDE boundary

    def test_truncates_doc_excerpt(self):
        dfd = _make_dfd()
        rules_output = _make_rules_output()
        long_excerpt = "x" * 1000

        result = build_ai_pass_input(dfd, rules_output, long_excerpt)

        assert len(result.doc_excerpt) == 500

    def test_default_system_name_when_no_processes(self):
        dfd = DFDResponse(
            nodes=[
                DFDNodeResponse(
                    id=uuid4(),
                    node_type="data_store",
                    name="Some DB",
                    position_x=0,
                    position_y=0,
                    trust_boundary_id=None,
                    properties={},
                ),
            ],
            edges=[],
            trust_boundaries=[],
        )
        rules_output = RuleEngineOutput(
            threats=[], execution_time_ms=1.0, rules_evaluated=0, rules_fired=0
        )

        result = build_ai_pass_input(dfd, rules_output, "")

        assert result.system_name == "Unknown System"

    def test_default_data_classification(self):
        """Without PCI boundary, classification defaults to Confidential."""
        dfd = DFDResponse(
            nodes=[
                DFDNodeResponse(
                    id=uuid4(),
                    node_type="process",
                    name="Service A",
                    position_x=0,
                    position_y=0,
                    trust_boundary_id=None,
                    properties={},
                ),
            ],
            edges=[],
            trust_boundaries=[],
        )
        rules_output = RuleEngineOutput(
            threats=[], execution_time_ms=1.0, rules_evaluated=0, rules_fired=0
        )

        result = build_ai_pass_input(dfd, rules_output, "")

        assert result.data_classification == "Confidential"


class TestParseEnhancementResponse:
    """Tests for _parse_enhancement_response."""

    def test_parses_valid_response(self):
        tool_output = _make_bedrock_tool_response()
        threats = _parse_enhancement_response(tool_output)

        # 2 new threats + 1 enrichment = 3 total
        assert len(threats) == 3

        # First new threat
        assert "Race Condition" in threats[0].description
        assert threats[0].stride_category == "Tampering"
        assert threats[0].severity == "Critical"
        assert threats[0].enhances_rule_threat_id is None

        # Enrichment
        enrichment = threats[2]
        assert enrichment.enhances_rule_threat_id == "T-001"
        assert "mutual TLS" in enrichment.description

    def test_skips_invalid_stride_category(self):
        tool_output = {
            "new_threats": [
                {
                    "title": "Bad Threat",
                    "stride_category": "InvalidCategory",
                    "severity": "High",
                    "description": "test",
                    "affected_node_names": ["X"],
                    "rationale": "test",
                },
            ],
            "enrichments": [],
        }
        threats = _parse_enhancement_response(tool_output)
        assert len(threats) == 0

    def test_skips_invalid_severity(self):
        tool_output = {
            "new_threats": [
                {
                    "title": "Bad Threat",
                    "stride_category": "Spoofing",
                    "severity": "Ultra",
                    "description": "test",
                    "affected_node_names": ["X"],
                    "rationale": "test",
                },
            ],
            "enrichments": [],
        }
        threats = _parse_enhancement_response(tool_output)
        assert len(threats) == 0

    def test_skips_malformed_items(self):
        tool_output = {
            "new_threats": [
                {"title": "Missing required fields"},
            ],
            "enrichments": [
                {"not_a_valid_field": "value"},
            ],
        }
        threats = _parse_enhancement_response(tool_output)
        assert len(threats) == 0

    def test_empty_response(self):
        threats = _parse_enhancement_response(
            {"new_threats": [], "enrichments": []}
        )
        assert threats == []

    def test_new_threats_have_valid_stride_categories(self):
        tool_output = _make_bedrock_tool_response()
        threats = _parse_enhancement_response(tool_output)

        for t in threats:
            if t.enhances_rule_threat_id is None:
                # New threat -- must have a valid STRIDE category
                assert t.stride_category in VALID_STRIDE_CATEGORIES, (
                    f"Invalid STRIDE category: {t.stride_category}"
                )


class TestEnhanceSync:
    """Tests for _enhance_sync with mocked BedrockClient."""

    def test_returns_parsed_output_on_success(self):
        mock_client = MagicMock()
        mock_client.model_id = "anthropic.claude-3-sonnet-test"
        mock_client.call_with_tools.return_value = _make_bedrock_tool_response()

        dfd = _make_dfd()
        rules_output = _make_rules_output()
        ai_input = build_ai_pass_input(dfd, rules_output, "test excerpt")

        result = _enhance_sync(ai_input, client=mock_client)

        assert isinstance(result, AIPassOutput)
        assert len(result.threats) == 3  # 2 new + 1 enrichment
        assert result.model_id == "anthropic.claude-3-sonnet-test"
        assert result.latency_ms > 0
        mock_client.call_with_tools.assert_called_once()

    def test_retries_once_on_first_failure(self):
        mock_client = MagicMock()
        mock_client.model_id = "test-model"
        mock_client.call_with_tools.side_effect = [
            None,  # first attempt fails
            _make_bedrock_tool_response(),  # retry succeeds
        ]

        dfd = _make_dfd()
        rules_output = _make_rules_output()
        ai_input = build_ai_pass_input(dfd, rules_output, "test")

        result = _enhance_sync(ai_input, client=mock_client)

        assert len(result.threats) == 3
        assert mock_client.call_with_tools.call_count == 2

    def test_returns_empty_on_both_failures(self):
        mock_client = MagicMock()
        mock_client.model_id = "test-model"
        mock_client.call_with_tools.return_value = None

        dfd = _make_dfd()
        rules_output = _make_rules_output()
        ai_input = build_ai_pass_input(dfd, rules_output, "test")

        result = _enhance_sync(ai_input, client=mock_client)

        assert isinstance(result, AIPassOutput)
        assert len(result.threats) == 0
        assert mock_client.call_with_tools.call_count == 2


class TestEnhanceThreatsAsync:
    """Tests for the async enhance_threats entry point."""

    def test_returns_empty_on_timeout(self):
        """enhance_threats returns empty AIPassOutput on timeout."""
        mock_client = MagicMock()
        mock_client.model_id = "test-model"

        # Make call_with_tools block long enough to trigger timeout
        import time

        def slow_call(**kwargs):
            time.sleep(5)
            return _make_bedrock_tool_response()

        mock_client.call_with_tools.side_effect = slow_call

        dfd = _make_dfd()
        rules_output = _make_rules_output()

        with patch("app.services.ai_enhancement.settings") as mock_settings:
            mock_settings.bedrock_timeout_seconds = 0.1
            mock_settings.bedrock_model_id = "test-model"
            result = asyncio.get_event_loop().run_until_complete(
                enhance_threats(dfd, rules_output, "test", client=mock_client)
            )

        assert isinstance(result, AIPassOutput)
        assert len(result.threats) == 0

    def test_returns_empty_on_bedrock_failure(self):
        """enhance_threats returns empty AIPassOutput when Bedrock fails."""
        mock_client = MagicMock()
        mock_client.model_id = "test-model"
        mock_client.call_with_tools.return_value = None

        dfd = _make_dfd()
        rules_output = _make_rules_output()

        result = asyncio.get_event_loop().run_until_complete(
            enhance_threats(dfd, rules_output, "test", client=mock_client)
        )

        assert isinstance(result, AIPassOutput)
        assert len(result.threats) == 0

    def test_returns_empty_on_unexpected_exception(self):
        """enhance_threats returns empty AIPassOutput on unexpected errors."""
        mock_client = MagicMock()
        mock_client.model_id = "test-model"
        mock_client.call_with_tools.side_effect = RuntimeError("boom")

        dfd = _make_dfd()
        rules_output = _make_rules_output()

        result = asyncio.get_event_loop().run_until_complete(
            enhance_threats(dfd, rules_output, "test", client=mock_client)
        )

        assert isinstance(result, AIPassOutput)
        assert len(result.threats) == 0

    def test_success_path(self):
        """enhance_threats returns parsed threats on success."""
        mock_client = MagicMock()
        mock_client.model_id = "test-model"
        mock_client.call_with_tools.return_value = _make_bedrock_tool_response()

        dfd = _make_dfd()
        rules_output = _make_rules_output()

        result = asyncio.get_event_loop().run_until_complete(
            enhance_threats(dfd, rules_output, "test doc", client=mock_client)
        )

        assert isinstance(result, AIPassOutput)
        assert len(result.threats) == 3
