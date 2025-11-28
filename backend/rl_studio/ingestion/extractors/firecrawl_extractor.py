"""
Firecrawl Extractor - Enhanced web/paper/code extraction
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from ..base import BaseExtractor, ExtractionMetadata, ExtractionResult, SourceType

logger = logging.getLogger(__name__)


class FirecrawlExtractor(BaseExtractor):
    """
    Extract environment specs from web pages, papers, and documentation
    Uses Firecrawl API for semantic scraping
    """

    @property
    def source_type(self) -> SourceType:
        return SourceType.FIRECRAWL

    @property
    def name(self) -> str:
        return "Firecrawl Web/Paper Extractor"

    def can_handle(self, input_data: Any) -> bool:
        """Check if input is a URL string"""
        if isinstance(input_data, str):
            # Check if it looks like a URL
            return input_data.startswith(("http://", "https://"))
        return False

    async def extract(self, input_data: str, **kwargs) -> ExtractionResult:
        """
        Extract from URL using Firecrawl

        Args:
            input_data: URL to scrape
            **kwargs: Options like formats, includeImages, etc.
        """
        try:
            firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
            if not firecrawl_api_key:
                return ExtractionResult(
                    success=False,
                    raw_data={},
                    normalized_data={},
                    metadata=self._create_metadata(
                        input_data,
                        "firecrawl_api",
                        0.0,
                        ["FIRECRAWL_API_KEY not configured"],
                    ),
                    error="FIRECRAWL_API_KEY not configured",
                )

            # Scrape with Firecrawl
            scrape_options = {
                "formats": ["markdown", "html"],
                "includeImages": True,
                **kwargs,
            }

            response = await self._scrape_url(
                input_data, firecrawl_api_key, scrape_options
            )

            if not response.get("success"):
                return ExtractionResult(
                    success=False,
                    raw_data=response,
                    normalized_data={},
                    metadata=self._create_metadata(
                        input_data,
                        "firecrawl_scrape",
                        0.0,
                        [f"Scraping failed: {response.get('error', 'Unknown error')}"],
                    ),
                    error=response.get("error", "Scraping failed"),
                )

            # Extract content
            data = response.get("data", {})
            content = data.get("markdown") or data.get("text") or ""

            # Parse content for RL environment information
            parsed = self._parse_content(content, input_data)

            # Build normalized structure
            normalized = self._build_normalized(parsed, data)

            confidence = self._calculate_confidence(parsed, normalized)
            warnings = self._collect_warnings(parsed, normalized)

            return ExtractionResult(
                success=True,
                raw_data={
                    "url": input_data,
                    "scrape_response": response,
                    "content": content[:5000],  # Preview
                    "images": data.get("images", [])[:5],
                },
                normalized_data=normalized,
                metadata=self._create_metadata(
                    input_data,
                    "firecrawl_semantic_parse",
                    confidence,
                    warnings,
                    content[:500],
                ),
            )

        except Exception as e:
            logger.error(f"Firecrawl extraction failed: {e}", exc_info=True)
            return ExtractionResult(
                success=False,
                raw_data={},
                normalized_data={},
                metadata=self._create_metadata(
                    input_data, "firecrawl_error", 0.0, [f"Exception: {str(e)}"]
                ),
                error=str(e),
            )

    async def _scrape_url(
        self, url: str, api_key: str, options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call Firecrawl API"""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={"url": url, **options},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status == 200:
                    return {"success": True, "data": await response.json()}
                else:
                    error_text = await response.text()
                    return {
                        "success": False,
                        "error": f"HTTP {response.status}: {error_text[:200]}",
                    }

    def _parse_content(self, content: str, source_url: str) -> Dict[str, Any]:
        """Parse content for RL environment information"""
        lower_content = content.lower()

        # Detect environment type
        env_type = self._detect_env_type(lower_content, content)

        # Extract dimensions
        dimensions = self._extract_dimensions(content)

        # Extract agents
        agents = self._extract_agents(content, lower_content)

        # Extract actions
        actions = self._extract_actions(content, lower_content, env_type)

        # Extract rewards
        rewards = self._extract_rewards(content, lower_content)

        # Extract terminations
        terminations = self._extract_terminations(content, lower_content)

        # Extract objects
        objects = self._extract_objects(content, lower_content)

        # Extract physics parameters
        physics = self._extract_physics(content, lower_content)

        return {
            "env_type": env_type,
            "dimensions": dimensions,
            "agents": agents,
            "actions": actions,
            "rewards": rewards,
            "terminations": terminations,
            "objects": objects,
            "physics": physics,
            "source_url": source_url,
            "raw_content_length": len(content),
        }

    def _detect_env_type(self, lower_content: str, content: str) -> str:
        """Detect environment type from content"""
        if any(
            term in lower_content
            for term in ["continuous", "physics", "velocity", "acceleration", "force"]
        ):
            return "continuous2d"
        elif any(
            term in lower_content for term in ["grid", "discrete", "cell", "tile"]
        ):
            return "grid"
        elif any(term in lower_content for term in ["graph", "node", "edge"]):
            return "graph"
        else:
            # Default based on action space mentions
            if (
                "continuous action" in lower_content
                or "continuous control" in lower_content
            ):
                return "continuous2d"
            return "grid"

    def _extract_dimensions(self, content: str) -> Dict[str, int]:
        """Extract world dimensions"""
        # Look for patterns like "10x10", "width: 20, height: 15", etc.
        patterns = [
            r"(\d+)\s*[x×]\s*(\d+)",  # 10x10
            r"width[:\s=]+(\d+)",  # width: 20
            r"height[:\s=]+(\d+)",  # height: 15
            r"size[:\s=]+(\d+)\s*[x×,]\s*(\d+)",  # size: 20x15
        ]

        width, height = 10, 10  # defaults

        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                if isinstance(matches[0], tuple):
                    width, height = int(matches[0][0]), int(matches[0][1])
                else:
                    # Try to find width and height separately
                    width_match = re.search(
                        r"width[:\s=]+(\d+)", content, re.IGNORECASE
                    )
                    height_match = re.search(
                        r"height[:\s=]+(\d+)", content, re.IGNORECASE
                    )
                    if width_match:
                        width = int(width_match.group(1))
                    if height_match:
                        height = int(height_match.group(1))
                break

        return {"width": width, "height": height}

    def _extract_agents(self, content: str, lower_content: str) -> List[Dict[str, Any]]:
        """Extract agent information"""
        agents = []

        # Look for agent mentions
        agent_patterns = [
            r"agent[:\s]+(?:position|pos|location)[:\s=]+[\[\(]?(\d+)[,\s]+(\d+)[\]\)]?",
            r"start[:\s]+(?:position|pos)[:\s=]+[\[\(]?(\d+)[,\s]+(\d+)[\]\)]?",
        ]

        for pattern in agent_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                x, y = float(match.group(1)), float(match.group(2))
                agents.append(
                    {
                        "id": f"agent_{len(agents)}",
                        "name": "Agent",
                        "position": [x, y],
                    }
                )

        # Default agent if none found
        if not agents:
            agents.append(
                {
                    "id": "agent_0",
                    "name": "Agent",
                    "position": [0, 0],
                }
            )

        return agents

    def _extract_actions(
        self, content: str, lower_content: str, env_type: str
    ) -> Dict[str, Any]:
        """Extract action space"""
        # Check for discrete actions
        discrete_patterns = [
            r"actions?[:\s=]+\[(.*?)\]",
            r"action[_\s]?space[:\s=]+\[(.*?)\]",
        ]

        for pattern in discrete_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                actions_str = match.group(1)
                actions = [a.strip().strip("\"'") for a in actions_str.split(",")]
                if actions:
                    return {"type": "discrete", "actions": actions}

        # Check for continuous
        if (
            "continuous action" in lower_content
            or "continuous control" in lower_content
        ):
            # Try to extract dimensions
            dim_match = re.search(r"(\d+)[\s-]?d(?:imensional)?", lower_content)
            dimensions = int(dim_match.group(1)) if dim_match else 2

            return {"type": "continuous", "dimensions": dimensions, "range": [-1, 1]}

        # Default based on env_type
        if env_type == "grid":
            return {"type": "discrete", "actions": ["up", "down", "left", "right"]}
        else:
            return {"type": "continuous", "dimensions": 2, "range": [-1, 1]}

    def _extract_rewards(
        self, content: str, lower_content: str
    ) -> List[Dict[str, Any]]:
        """Extract reward rules"""
        rewards = []

        # Look for reward patterns
        reward_patterns = [
            r"reward[:\s=]+([+-]?\d*\.?\d+)",
            r"\+(\d+)\s*(?:point|reward)",
            r"\-(\d+)\s*(?:point|penalty)",
        ]

        for pattern in reward_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                value = float(match.group(1))
                # Try to infer condition
                context = content[max(0, match.start() - 50) : match.end() + 50].lower()
                if "goal" in context or "reach" in context:
                    condition = "agent_at_object"
                elif "step" in context or "time" in context:
                    condition = "timeout"
                else:
                    condition = "custom"

                rewards.append(
                    {
                        "condition": condition,
                        "value": value,
                    }
                )

        # Default step penalty if no rewards found
        if not rewards:
            rewards.append(
                {
                    "condition": "timeout",
                    "value": -0.01,
                }
            )

        return rewards

    def _extract_terminations(
        self, content: str, lower_content: str
    ) -> List[Dict[str, Any]]:
        """Extract termination conditions"""
        terminations = []

        # Look for max steps
        step_patterns = [
            r"max[_\s]?steps?[:\s=]+(\d+)",
            r"episode[_\s]?length[:\s=]+(\d+)",
            r"timeout[:\s=]+(\d+)",
        ]

        for pattern in step_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                steps = int(match.group(1))
                terminations.append(
                    {
                        "condition": "timeout",
                        "steps": steps,
                    }
                )
                break

        # Default timeout
        if not terminations:
            terminations.append(
                {
                    "condition": "timeout",
                    "steps": 100,
                }
            )

        return terminations

    def _extract_objects(
        self, content: str, lower_content: str
    ) -> List[Dict[str, Any]]:
        """Extract objects (goals, obstacles, etc.)"""
        objects = []

        # Look for goal mentions
        if "goal" in lower_content:
            goal_patterns = [
                r"goal[:\s]+(?:position|pos|location)[:\s=]+[\[\(]?(\d+)[,\s]+(\d+)[\]\)]?",
            ]
            for pattern in goal_patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    x, y = float(match.group(1)), float(match.group(2))
                    objects.append(
                        {
                            "id": f"goal_{len(objects)}",
                            "type": "goal",
                            "position": [x, y],
                        }
                    )

        return objects

    def _extract_physics(self, content: str, lower_content: str) -> Dict[str, Any]:
        """Extract physics parameters"""
        physics = {
            "enabled": "physics" in lower_content or "continuous" in lower_content,
            "collisionEnabled": "collision" in lower_content,
        }

        # Extract gravity
        gravity_match = re.search(
            r"gravity[:\s=]+[\[\(]?([+-]?\d*\.?\d+)[,\s]+([+-]?\d*\.?\d+)[\]\)]?",
            content,
            re.IGNORECASE,
        )
        if gravity_match:
            physics["gravity"] = [
                float(gravity_match.group(1)),
                float(gravity_match.group(2)),
            ]

        # Extract friction
        friction_match = re.search(
            r"friction[:\s=]+([+-]?\d*\.?\d+)", content, re.IGNORECASE
        )
        if friction_match:
            physics["friction"] = float(friction_match.group(1))

        return physics

    def _build_normalized(
        self, parsed: Dict[str, Any], scrape_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build normalized structure from parsed data"""
        env_type = parsed["env_type"]
        dims = parsed["dimensions"]

        return {
            "envType": env_type,
            "name": "Imported Environment",
            "description": (
                scrape_data.get("markdown", "")[:500]
                if isinstance(scrape_data.get("markdown"), str)
                else ""
            ),
            "world": {
                "coordinateSystem": "grid" if env_type == "grid" else "cartesian",
                "width": dims["width"],
                "height": dims["height"],
                "physics": parsed["physics"],
            },
            "agents": parsed["agents"],
            "actionSpace": parsed["actions"],
            "objects": parsed["objects"],
            "rules": {
                "rewards": parsed["rewards"],
                "terminations": parsed["terminations"],
                "events": [],
            },
        }

    def _calculate_confidence(
        self, parsed: Dict[str, Any], normalized: Dict[str, Any]
    ) -> float:
        """Calculate extraction confidence (0.0 to 1.0)"""
        confidence = 0.5  # Base confidence

        # Boost confidence for specific findings
        if len(parsed["agents"]) > 0:
            confidence += 0.1
        if len(parsed["rewards"]) > 0:
            confidence += 0.1
        if len(parsed["terminations"]) > 0:
            confidence += 0.1
        if len(parsed["objects"]) > 0:
            confidence += 0.1
        if parsed["raw_content_length"] > 1000:
            confidence += 0.1

        return min(1.0, confidence)

    def _collect_warnings(
        self, parsed: Dict[str, Any], normalized: Dict[str, Any]
    ) -> List[str]:
        """Collect warnings about extraction"""
        warnings = []

        if parsed["raw_content_length"] < 100:
            warnings.append("Content very short, may have missed information")

        if len(parsed["agents"]) == 0:
            warnings.append("No agents found, using default")

        if len(parsed["rewards"]) == 0:
            warnings.append("No rewards found, using default step penalty")

        return warnings
