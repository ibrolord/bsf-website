from __future__ import annotations

import uuid

import pytest

from app.schemas.dfd import DFDEdgeResponse, DFDNodeResponse, TrustBoundaryResponse
from app.services.rules.conditions import (
    SENSITIVE_KEYWORDS,
    condition_d01,
    condition_d02,
    condition_d03,
    condition_e01,
    condition_e02,
    condition_e03,
    condition_i01,
    condition_i02,
    condition_i03,
    condition_i04,
    condition_r01,
    condition_r02,
    condition_r03,
    condition_s01,
    condition_s02,
    condition_s03,
    condition_t01,
    condition_t02,
    condition_t03,
    condition_t04,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _node(node_type: str, node_id: uuid.UUID | None = None) -> DFDNodeResponse:
    return DFDNodeResponse(
        id=node_id or uuid.uuid4(),
        node_type=node_type,
        name=f"test-{node_type}",
        position_x=0,
        position_y=0,
        trust_boundary_id=None,
        properties={},
    )


def _edge(
    source: DFDNodeResponse,
    target: DFDNodeResponse,
    label: str = "",
) -> DFDEdgeResponse:
    return DFDEdgeResponse(
        id=uuid.uuid4(),
        source_node_id=source.id,
        target_node_id=target.id,
        label=label,
        properties={},
    )


def _boundary(node_ids: list[uuid.UUID] | None = None) -> TrustBoundaryResponse:
    return TrustBoundaryResponse(
        id=uuid.uuid4(),
        name="test-boundary",
        node_ids=node_ids or [],
    )


# Reusable fixtures
EXT = _node("external_entity")
PROC = _node("process")
DS = _node("data_store")
EDGE = _edge(EXT, PROC)


# ===========================================================================
# Spoofing
# ===========================================================================


class TestConditionS01:
    def test_positive(self):
        assert condition_s01(EXT, EDGE, PROC, crosses_boundary=True) is True

    def test_negative_no_boundary(self):
        assert condition_s01(EXT, EDGE, PROC, crosses_boundary=False) is False

    def test_negative_wrong_source(self):
        assert condition_s01(PROC, EDGE, PROC, crosses_boundary=True) is False


class TestConditionS02:
    def test_positive(self):
        assert condition_s02(EXT, EDGE, PROC, crosses_boundary=True) is True

    def test_negative(self):
        assert condition_s02(EXT, EDGE, PROC, crosses_boundary=False) is False


class TestConditionS03:
    def test_positive(self):
        assert condition_s03(EXT, {}) is True

    def test_negative(self):
        assert condition_s03(PROC, {}) is False


# ===========================================================================
# Tampering
# ===========================================================================


class TestConditionT01:
    def test_positive(self):
        assert condition_t01(EXT, EDGE, PROC, crosses_boundary=True) is True

    def test_negative(self):
        assert condition_t01(EXT, EDGE, PROC, crosses_boundary=False) is False


class TestConditionT02:
    def test_positive(self):
        e = _edge(EXT, DS)
        assert condition_t02(EXT, e, DS, crosses_boundary=False) is True

    def test_negative(self):
        assert condition_t02(PROC, EDGE, DS, crosses_boundary=False) is False


class TestConditionT03:
    def test_positive(self):
        e = _edge(PROC, DS)
        assert condition_t03(PROC, e, DS, crosses_boundary=False) is True

    def test_negative(self):
        assert condition_t03(EXT, EDGE, PROC, crosses_boundary=False) is False


class TestConditionT04:
    def test_positive(self):
        e = _edge(EXT, DS)
        assert condition_t04(EXT, e, DS, crosses_boundary=True) is True

    def test_negative_no_boundary(self):
        e = _edge(EXT, DS)
        assert condition_t04(EXT, e, DS, crosses_boundary=False) is False

    def test_negative_wrong_target(self):
        assert condition_t04(EXT, EDGE, PROC, crosses_boundary=True) is False


# ===========================================================================
# Repudiation
# ===========================================================================


class TestConditionR01:
    def test_positive_source(self):
        assert condition_r01(EXT, EDGE, PROC, crosses_boundary=False) is True

    def test_positive_target(self):
        e = _edge(PROC, EXT)
        assert condition_r01(PROC, e, EXT, crosses_boundary=False) is True

    def test_negative(self):
        e = _edge(PROC, DS)
        assert condition_r01(PROC, e, DS, crosses_boundary=False) is False


class TestConditionR02:
    def test_positive_source(self):
        e = _edge(PROC, DS)
        assert condition_r02(PROC, e, DS, crosses_boundary=False) is True

    def test_positive_target(self):
        assert condition_r02(EXT, EDGE, PROC, crosses_boundary=False) is True

    def test_negative(self):
        e = _edge(EXT, DS)
        assert condition_r02(EXT, e, DS, crosses_boundary=False) is False


class TestConditionR03:
    def test_positive(self):
        e = _edge(PROC, DS)
        assert condition_r03(PROC, e, DS, crosses_boundary=False) is True

    def test_negative(self):
        assert condition_r03(EXT, EDGE, PROC, crosses_boundary=False) is False


# ===========================================================================
# Information Disclosure
# ===========================================================================


class TestConditionI01:
    def test_positive(self):
        assert condition_i01(EXT, EDGE, PROC, crosses_boundary=True) is True

    def test_negative(self):
        assert condition_i01(EXT, EDGE, PROC, crosses_boundary=False) is False


class TestConditionI02:
    def test_positive(self):
        e = _edge(DS, EXT)
        assert condition_i02(DS, e, EXT, crosses_boundary=False) is True

    def test_negative(self):
        e = _edge(DS, PROC)
        assert condition_i02(DS, e, PROC, crosses_boundary=False) is False


class TestConditionI03:
    def test_positive(self):
        e = _edge(DS, PROC)
        assert condition_i03(DS, e, PROC, crosses_boundary=True) is True

    def test_negative_no_boundary(self):
        e = _edge(DS, PROC)
        assert condition_i03(DS, e, PROC, crosses_boundary=False) is False

    def test_negative_wrong_source(self):
        assert condition_i03(EXT, EDGE, PROC, crosses_boundary=True) is False


class TestConditionI04:
    def test_positive_password(self):
        e = _edge(EXT, PROC, label="Send Password Reset")
        assert condition_i04(EXT, e, PROC, crosses_boundary=False) is True

    def test_positive_token_case_insensitive(self):
        e = _edge(EXT, PROC, label="JWT TOKEN exchange")
        assert condition_i04(EXT, e, PROC, crosses_boundary=False) is True

    def test_negative_no_keyword(self):
        e = _edge(EXT, PROC, label="Get user profile")
        assert condition_i04(EXT, e, PROC, crosses_boundary=False) is False

    def test_negative_empty_label(self):
        e = _edge(EXT, PROC, label="")
        assert condition_i04(EXT, e, PROC, crosses_boundary=False) is False


# ===========================================================================
# Denial of Service
# ===========================================================================


class TestConditionD01:
    def test_positive(self):
        assert condition_d01(EXT, EDGE, PROC, crosses_boundary=False) is True

    def test_negative(self):
        e = _edge(PROC, DS)
        assert condition_d01(PROC, e, DS, crosses_boundary=False) is False


class TestConditionD02:
    def test_positive(self):
        assert condition_d02(PROC, {}) is True

    def test_negative(self):
        assert condition_d02(EXT, {}) is False


class TestConditionD03:
    def test_positive_high_degree(self):
        # Create a hub node with 4 connections
        hub = _node("process")
        others = [_node("external_entity") for _ in range(4)]
        edges = [_edge(o, hub) for o in others]
        ctx = {"all_edges": edges}
        assert condition_d03(hub, ctx) is True

    def test_negative_low_degree(self):
        hub = _node("process")
        others = [_node("external_entity") for _ in range(2)]
        edges = [_edge(o, hub) for o in others]
        ctx = {"all_edges": edges}
        assert condition_d03(hub, ctx) is False

    def test_counts_both_directions(self):
        hub = _node("process")
        n1 = _node("external_entity")
        n2 = _node("data_store")
        edges = [_edge(n1, hub), _edge(n2, hub), _edge(hub, n1), _edge(hub, n2)]
        ctx = {"all_edges": edges}
        assert condition_d03(hub, ctx) is True


# ===========================================================================
# Elevation of Privilege
# ===========================================================================


class TestConditionE01:
    def test_positive(self):
        assert condition_e01(EXT, EDGE, PROC, crosses_boundary=True) is True

    def test_negative_no_boundary(self):
        assert condition_e01(EXT, EDGE, PROC, crosses_boundary=False) is False

    def test_negative_wrong_types(self):
        e = _edge(PROC, DS)
        assert condition_e01(PROC, e, DS, crosses_boundary=True) is False


class TestConditionE02:
    def test_positive(self):
        assert condition_e02(EXT, EDGE, PROC, crosses_boundary=True) is True

    def test_negative(self):
        assert condition_e02(EXT, EDGE, PROC, crosses_boundary=False) is False


class TestConditionE03:
    def test_positive(self):
        b = _boundary()
        assert condition_e03(b, entry_count=3) is True

    def test_positive_exact_threshold(self):
        b = _boundary()
        assert condition_e03(b, entry_count=2) is True

    def test_negative(self):
        b = _boundary()
        assert condition_e03(b, entry_count=1) is False
