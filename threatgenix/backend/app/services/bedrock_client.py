"""Reusable AWS Bedrock Converse API wrapper.

Region is hardcoded to ca-central-1 for data residency compliance.
No abstraction layers, no model registry — one model, one client, one region.
"""

import hashlib
import logging
import time
from typing import Any, Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class BedrockClient:
    """Thin wrapper around Bedrock Converse API with tool_use support."""

    def __init__(
        self,
        region: str = settings.bedrock_region,
        model_id: str = settings.bedrock_model_id,
        timeout_seconds: int = settings.bedrock_timeout_seconds,
    ):
        # ca-central-1 enforcement: warn loudly if overridden
        if region != "ca-central-1":
            logger.warning(
                "Bedrock region is '%s', NOT ca-central-1. "
                "This may violate data residency requirements.",
                region,
            )

        boto_config = BotoConfig(
            region_name=region,
            read_timeout=timeout_seconds,
            connect_timeout=10,
            retries={"max_attempts": 0},  # We handle retries ourselves
        )
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=boto_config,
        )
        self.model_id = model_id
        self.timeout_seconds = timeout_seconds

    def call_with_tools(
        self,
        system_message: str,
        user_message: str,
        tools: list[dict[str, Any]],
        max_tokens: int = settings.bedrock_max_tokens,
        prompt_version: str = "unknown",
    ) -> Optional[dict[str, Any]]:
        """Make a Bedrock Converse API call with tool definitions.

        Returns the tool_use input dict on success, None on failure.
        Logs prompt hash (not content), token counts, and latency.
        """
        messages = [{"role": "user", "content": [{"text": user_message}]}]
        system = [{"text": system_message}]
        tool_config = {"tools": [{"toolSpec": t} for t in tools]}

        # Log prompt metadata — never log full prompt content (data residency)
        prompt_hash = hashlib.sha256(
            (system_message + user_message).encode()
        ).hexdigest()[:12]
        logger.info(
            "bedrock_call_start prompt_version=%s model=%s prompt_hash=%s",
            prompt_version,
            self.model_id,
            prompt_hash,
        )

        start = time.monotonic()
        try:
            response = self.client.converse(
                modelId=self.model_id,
                messages=messages,
                system=system,
                toolConfig=tool_config,
                inferenceConfig={"maxTokens": max_tokens},
            )
        except ClientError as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            logger.warning(
                "bedrock_call_error prompt_version=%s elapsed_ms=%d error=%s",
                prompt_version,
                elapsed_ms,
                str(exc),
            )
            return None
        except Exception as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            logger.warning(
                "bedrock_call_error prompt_version=%s elapsed_ms=%d error=%s",
                prompt_version,
                elapsed_ms,
                str(exc),
            )
            return None

        elapsed_ms = int((time.monotonic() - start) * 1000)

        # Extract usage metrics
        usage = response.get("usage", {})
        input_tokens = usage.get("inputTokens", 0)
        output_tokens = usage.get("outputTokens", 0)

        logger.info(
            "bedrock_call_complete prompt_version=%s elapsed_ms=%d "
            "input_tokens=%d output_tokens=%d",
            prompt_version,
            elapsed_ms,
            input_tokens,
            output_tokens,
        )

        return self._extract_tool_use(response)

    def _extract_tool_use(self, response: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Extract the tool use input from the Converse API response."""
        try:
            content_blocks = response["output"]["message"]["content"]
            for block in content_blocks:
                if "toolUse" in block:
                    return block["toolUse"]["input"]
        except (KeyError, TypeError) as exc:
            logger.warning("bedrock_parse_error failed to extract tool_use: %s", exc)
        return None
