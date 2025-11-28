"""
Text Extractor - LLM parsing for natural language descriptions
"""

import json
import logging
import os
import re
from typing import Any, Dict

from ..base import (BaseExtractor, ExtractionMetadata, ExtractionResult,
                    SourceType)

logger = logging.getLogger(__name__)


class TextExtractor(BaseExtractor):
    """
    Extract environment specs from natural language text
    Uses LLM (OpenAI GPT) to parse descriptions
    """

    @property
    def source_type(self) -> SourceType:
        return SourceType.TEXT

    @property
    def name(self) -> str:
        return "Text/LLM Description Extractor"

    def can_handle(self, input_data: Any) -> bool:
        """Check if input is a text string"""
        return isinstance(input_data, str) and len(input_data.strip()) > 10

    async def extract(self, input_data: str, **kwargs) -> ExtractionResult:
        """Extract from text using LLM"""
        try:
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                return ExtractionResult(
                    success=False,
                    raw_data={},
                    normalized_data={},
                    metadata=self._create_metadata(
                        input_data[:50],
                        "llm_parse",
                        0.0,
                        ["OPENAI_API_KEY not configured"],
                    ),
                    error="OPENAI_API_KEY not configured",
                )

            # Use LLM to parse text
            parsed = await self._llm_parse(input_data, openai_api_key)

            # Build normalized structure
            normalized = self._build_normalized(parsed)

            confidence = 0.7  # LLM parsing is reasonably confident
            warnings = []

            if not normalized.get("agents"):
                warnings.append("No agents inferred from description")

            return ExtractionResult(
                success=True,
                raw_data={
                    "text": input_data,
                    "llm_parsed": parsed,
                },
                normalized_data=normalized,
                metadata=self._create_metadata(
                    input_data[:50],
                    "openai_gpt_parse",
                    confidence,
                    warnings,
                    input_data[:200],
                ),
            )

        except Exception as e:
            logger.error(f"Text extraction failed: {e}", exc_info=True)
            return ExtractionResult(
                success=False,
                raw_data={},
                normalized_data={},
                metadata=self._create_metadata(
                    input_data[:50] if isinstance(input_data, str) else "text",
                    "llm_error",
                    0.0,
                    [f"Exception: {str(e)}"],
                ),
                error=str(e),
            )

    async def _llm_parse(self, text: str, api_key: str) -> Dict[str, Any]:
        """Use OpenAI to parse text into structured data"""
        import aiohttp

        prompt = f"""Parse this RL environment description into structured JSON:

"{text}"

Extract:
- Environment type (grid, continuous2d, etc.)
- World dimensions (width, height)
- Agent starting position
- Action space (discrete actions or continuous dimensions)
- Reward rules (conditions and values)
- Termination conditions (max steps, goal reached, etc.)
- Objects (goals, obstacles, etc.)

Return JSON with this structure:
{{
  "envType": "grid" or "continuous2d",
  "world": {{"width": number, "height": number}},
  "agents": [{{"id": "agent_0", "name": "Agent", "position": [x, y]}}],
  "actionSpace": {{"type": "discrete" or "continuous", ...}},
  "rewards": [{{"condition": "...", "value": number}}],
  "terminations": [{{"condition": "...", "steps": number}}],
  "objects": [{{"id": "...", "type": "goal" or "obstacle", "position": [x, y]}}]
}}

Return ONLY valid JSON, no explanations."""

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert at parsing RL environment descriptions into structured JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000,
                },
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    content = data["choices"][0]["message"]["content"]
                    # Extract JSON from response
                    json_match = re.search(r"\{.*\}", content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(0))
                    else:
                        return json.loads(content)
                else:
                    error_text = await response.text()
                    raise Exception(
                        f"OpenAI API error: {response.status} - {error_text}"
                    )

    def _build_normalized(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """Build normalized structure from LLM parsed data"""
        env_type = parsed.get("envType", "grid")

        return {
            "envType": env_type,
            "name": "LLM Generated Environment",
            "description": "",
            "world": {
                "coordinateSystem": "grid" if env_type == "grid" else "cartesian",
                "width": parsed.get("world", {}).get("width", 10),
                "height": parsed.get("world", {}).get("height", 10),
                "physics": {"enabled": env_type == "continuous2d"},
            },
            "agents": parsed.get(
                "agents",
                [
                    {
                        "id": "agent_0",
                        "name": "Agent",
                        "position": [0, 0],
                    }
                ],
            ),
            "actionSpace": parsed.get(
                "actionSpace",
                {"type": "discrete", "actions": ["up", "down", "left", "right"]},
            ),
            "objects": parsed.get("objects", []),
            "rules": {
                "rewards": parsed.get("rewards", []),
                "terminations": parsed.get("terminations", []),
                "events": [],
            },
        }
