"""F-02 LLM extraction service: PDF raw text -> DocumentParseResult.

Extracts architecture components, data flows, and trust boundaries from
bank system design documents using Claude via AWS Bedrock Converse API
with tool_use for structured output enforcement.

Prompt version is tracked for regression testing and debugging.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from app.config import settings
from app.schemas.document import (
    DocumentParseResult,
    ParsedBoundary,
    ParsedComponent,
    ParsedFlow,
)
from app.services.bedrock_client import BedrockClient

logger = logging.getLogger(__name__)

# ─── Prompt Versioning ───────────────────────────────────────────────
EXTRACTION_PROMPT_VERSION = "v1.0"

# ─── System Message ──────────────────────────────────────────────────
EXTRACTION_SYSTEM_MESSAGE = """\
You are a senior security architect analyzing system design documents for \
Canadian banks. Your task is to extract architecture components, data flows, \
and trust boundaries from the raw text of a design document.

## What to extract

1. COMPONENTS — every distinct system element:
   - **process**: services, APIs, applications, microservices, gateways, \
engines, workers, schedulers
   - **data_store**: databases, caches, message queues, file stores, \
data warehouses, key vaults, HSMs
   - **external_entity**: end users, administrators, third-party systems, \
partner APIs, regulatory bodies, card networks

2. DATA FLOWS — connections between components showing data movement:
   - Identify source and target by the exact component name you extracted
   - Label describes what data moves (e.g., "authentication request", \
"payment authorization", "encrypted card data")

3. TRUST BOUNDARIES — security zones that group components by trust level:
   - Infer from context clues: "DMZ", "internal network", "external-facing", \
"partner zone", "PCI scope", "cardholder data environment"
   - The "contains" list must use exact component names from your extraction

## Rules (follow strictly)

- ONLY extract what the document explicitly describes or strongly implies. \
Do NOT invent components that are not mentioned or clearly implied.
- Use the specific names from the document, not generic labels. If the \
document says "Interac e-Transfer Gateway", use that — not "payment gateway".
- Each component must appear exactly once with a unique name.
- Flow source and target must match extracted component names exactly.

## Confidence scoring

Assign confidence (0.0 to 1.0) based on how explicitly the document \
describes each item:
- **0.9–1.0**: Component is named explicitly with a clear role description. \
Example: "The API Gateway (Kong) routes all external requests."
- **0.7–0.8**: Component is named but its role is only partially described. \
Example: "Requests pass through the API gateway to backend services."
- **0.5–0.6**: Component is implied but not named directly. Example: \
"User data is persisted" implies a database but does not name one.
- **0.3–0.4**: Component is weakly inferred from context. Example: \
"The system is PCI-compliant" implies an HSM may exist but is not stated.
- **Below 0.3**: Do not extract. If you are this uncertain, the component \
is not in the document.

## Banking terminology

Recognize these as specific component types, not generic terms:
- Core banking system, ledger, general ledger → process
- Payment gateway, payment processor, acquirer, issuer → process
- Fraud detection engine, risk scoring service → process
- KYC/AML service, identity verification → process
- SWIFT interface, Interac gateway, EFT processor → process
- Card management system, tokenization service → process
- API gateway, WAF, load balancer, reverse proxy → process
- HSM (Hardware Security Module), key vault → data_store
- Redis cache, session store, message queue (Kafka, RabbitMQ) → data_store
- Customer database, transaction database, audit log → data_store
- Card networks (Visa, Mastercard), credit bureaus → external_entity
- Mobile app users, online banking users, branch tellers → external_entity
- Regulators (OSFI, FINTRAC), payment networks → external_entity

You must call the extract_architecture tool with your results. Do not \
respond with plain text."""

# ─── User Message Template ───────────────────────────────────────────
EXTRACTION_USER_TEMPLATE = """\
Extract all architecture components, data flows, and trust boundaries \
from the following system design document for "{system_name}".

Analyze the full text carefully. Extract every component, flow, and \
boundary you can identify with confidence >= 0.3.

---
DOCUMENT TEXT:
{raw_text}
---

Call the extract_architecture tool with your findings."""

# ─── Tool Schema (Bedrock Converse API tool_use format) ──────────────
EXTRACT_ARCHITECTURE_TOOL: dict[str, Any] = {
    "name": "extract_architecture",
    "description": (
        "Extract architecture components, data flows, and trust boundaries "
        "from a bank system design document. You MUST call this tool with "
        "your extraction results."
    ),
    "inputSchema": {
        "json": {
            "type": "object",
            "properties": {
                "components": {
                    "type": "array",
                    "description": (
                        "All system components found in the document. "
                        "Each must have a unique name."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": (
                                    "Exact name as used in the document, "
                                    "or a clear descriptive name if implied."
                                ),
                            },
                            "component_type": {
                                "type": "string",
                                "enum": [
                                    "process",
                                    "data_store",
                                    "external_entity",
                                ],
                                "description": (
                                    "process = services/APIs/apps, "
                                    "data_store = databases/caches/queues/HSMs, "
                                    "external_entity = users/third-parties"
                                ),
                            },
                            "confidence": {
                                "type": "number",
                                "minimum": 0.0,
                                "maximum": 1.0,
                                "description": (
                                    "How explicitly the document describes "
                                    "this component. 0.9+ = named with clear "
                                    "description, 0.5-0.8 = partially described "
                                    "or implied, 0.3-0.4 = weakly inferred."
                                ),
                            },
                            "description": {
                                "type": "string",
                                "description": (
                                    "Brief description of the component's role "
                                    "based on the document text."
                                ),
                            },
                        },
                        "required": [
                            "name",
                            "component_type",
                            "confidence",
                            "description",
                        ],
                    },
                },
                "flows": {
                    "type": "array",
                    "description": (
                        "Data flows between components. Source and target "
                        "must exactly match component names from the "
                        "components list."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "source": {
                                "type": "string",
                                "description": (
                                    "Name of the source component "
                                    "(must match a component name exactly)."
                                ),
                            },
                            "target": {
                                "type": "string",
                                "description": (
                                    "Name of the target component "
                                    "(must match a component name exactly)."
                                ),
                            },
                            "label": {
                                "type": "string",
                                "description": (
                                    "What data moves in this flow "
                                    "(e.g., 'authentication request', "
                                    "'encrypted card data')."
                                ),
                            },
                            "confidence": {
                                "type": "number",
                                "minimum": 0.0,
                                "maximum": 1.0,
                                "description": (
                                    "How explicitly the document describes "
                                    "this data flow."
                                ),
                            },
                        },
                        "required": [
                            "source",
                            "target",
                            "label",
                            "confidence",
                        ],
                    },
                },
                "boundaries": {
                    "type": "array",
                    "description": (
                        "Trust boundaries / security zones that group "
                        "components. The contains list must use exact "
                        "component names."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": (
                                    "Name of the trust boundary or security "
                                    "zone (e.g., 'DMZ', 'Internal Network', "
                                    "'PCI CDE')."
                                ),
                            },
                            "contains": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": (
                                    "List of component names within this "
                                    "boundary. Must match component names "
                                    "exactly."
                                ),
                            },
                        },
                        "required": ["name", "contains"],
                    },
                },
            },
            "required": ["components", "flows", "boundaries"],
        }
    },
}


def _empty_parse_result() -> DocumentParseResult:
    """Return an empty DocumentParseResult for graceful degradation."""
    return DocumentParseResult(
        components=[],
        flows=[],
        boundaries=[],
        raw_text_excerpt="",
    )


def _parse_tool_response(
    tool_output: dict[str, Any],
    raw_text: str,
) -> DocumentParseResult:
    """Convert Bedrock tool_use response dict into DocumentParseResult.

    Validates each item individually — malformed items are dropped rather
    than failing the entire parse. This is intentional: partial results
    are better than no results.
    """
    components: list[ParsedComponent] = []
    flows: list[ParsedFlow] = []
    boundaries: list[ParsedBoundary] = []

    # Parse components
    for raw in tool_output.get("components", []):
        try:
            components.append(
                ParsedComponent(
                    name=str(raw["name"]).strip(),
                    component_type=raw["component_type"],
                    confidence=float(raw["confidence"]),
                    description=str(raw.get("description", "")),
                )
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.debug("Skipping malformed component: %s — %s", raw, exc)

    # Build set of valid component names for flow validation (normalized)
    def _normalize(name: str) -> str:
        """Match normalize_name() from dfd_generator.py."""
        name = name.lower().strip()
        name = name.replace("-", " ").replace("_", " ")
        name = re.sub(r"\s+", " ", name)
        return name

    valid_names_normalized = {_normalize(c.name) for c in components}

    # Parse flows — only keep flows whose source/target match a component
    # Uses normalized matching to avoid dropping flows due to casing/formatting
    for raw in tool_output.get("flows", []):
        try:
            source = str(raw["source"]).strip()
            target = str(raw["target"]).strip()
            if _normalize(source) not in valid_names_normalized:
                logger.debug(
                    "Flow source '%s' not in components, dropping flow", source
                )
                continue
            if _normalize(target) not in valid_names_normalized:
                logger.debug(
                    "Flow target '%s' not in components, dropping flow", target
                )
                continue
            flows.append(
                ParsedFlow(
                    source=source,
                    target=target,
                    label=str(raw.get("label", "")),
                    confidence=float(raw["confidence"]),
                )
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.debug("Skipping malformed flow: %s — %s", raw, exc)

    # Parse boundaries — filter contains to valid component names (normalized)
    for raw in tool_output.get("boundaries", []):
        try:
            contains_raw = raw.get("contains", [])
            contains = [
                str(name).strip()
                for name in contains_raw
                if _normalize(str(name).strip()) in valid_names_normalized
            ]
            if contains:  # Only add boundaries that actually contain components
                boundaries.append(
                    ParsedBoundary(
                        name=str(raw["name"]).strip(),
                        contains=contains,
                    )
                )
        except (KeyError, ValueError, TypeError) as exc:
            logger.debug("Skipping malformed boundary: %s — %s", raw, exc)

    # Excerpt: first 500 chars of raw text for reference
    excerpt = raw_text[:500] if raw_text else ""

    result = DocumentParseResult(
        components=components,
        flows=flows,
        boundaries=boundaries,
        raw_text_excerpt=excerpt,
    )

    logger.info(
        "extraction_parse_complete components=%d flows=%d boundaries=%d",
        len(components),
        len(flows),
        len(boundaries),
    )

    return result


def _extract_sync(
    raw_text: str,
    system_name: str,
    client: BedrockClient | None = None,
) -> DocumentParseResult:
    """Synchronous extraction — called from async wrapper.

    Fallback chain:
    1. tool_use response -> parse directly
    2. If tool_use fails -> retry once with same prompt
    3. If both fail -> return empty DocumentParseResult
    """
    if client is None:
        client = BedrockClient()

    user_message = EXTRACTION_USER_TEMPLATE.format(
        raw_text=raw_text,
        system_name=system_name,
    )
    tools = [EXTRACT_ARCHITECTURE_TOOL]

    # Attempt 1
    tool_output = client.call_with_tools(
        system_message=EXTRACTION_SYSTEM_MESSAGE,
        user_message=user_message,
        tools=tools,
        prompt_version=EXTRACTION_PROMPT_VERSION,
    )

    if tool_output is not None:
        return _parse_tool_response(tool_output, raw_text)

    # Attempt 2: retry once
    logger.warning(
        "extraction_retry prompt_version=%s reason=first_attempt_failed",
        EXTRACTION_PROMPT_VERSION,
    )
    tool_output = client.call_with_tools(
        system_message=EXTRACTION_SYSTEM_MESSAGE,
        user_message=user_message,
        tools=tools,
        prompt_version=EXTRACTION_PROMPT_VERSION,
    )

    if tool_output is not None:
        return _parse_tool_response(tool_output, raw_text)

    # Both attempts failed — graceful degradation
    logger.warning(
        "extraction_failed prompt_version=%s returning empty result",
        EXTRACTION_PROMPT_VERSION,
    )
    return _empty_parse_result()


async def extract_components_from_text(
    raw_text: str,
    system_name: str,
    client: BedrockClient | None = None,
) -> DocumentParseResult:
    """Extract architecture components from raw PDF text using Claude.

    This is the main entry point for F-02 LLM extraction. It runs the
    synchronous Bedrock call in a thread pool to avoid blocking the
    async event loop.

    Graceful degradation (F-24): returns empty DocumentParseResult on
    any failure, including timeout (30s default).

    Args:
        raw_text: Raw text extracted from the PDF by PyMuPDF.
        system_name: Name of the system being analyzed (from threat model).
        client: Optional BedrockClient instance (for testing/DI).

    Returns:
        DocumentParseResult with extracted components, flows, boundaries.
        Empty result on any failure.
    """
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                _extract_sync,
                raw_text,
                system_name,
                client,
            ),
            timeout=float(settings.bedrock_timeout_seconds),
        )
        return result
    except asyncio.TimeoutError:
        logger.warning(
            "extraction_timeout prompt_version=%s timeout_seconds=%d",
            EXTRACTION_PROMPT_VERSION,
            settings.bedrock_timeout_seconds,
        )
        return _empty_parse_result()
    except Exception as exc:
        logger.warning(
            "extraction_unexpected_error prompt_version=%s error=%s",
            EXTRACTION_PROMPT_VERSION,
            str(exc),
        )
        return _empty_parse_result()
