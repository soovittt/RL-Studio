"""
JSON Extractor - Manual JSON uploads (EnvSpec or Gym configs)
"""

import json
import logging
from typing import Any, Dict

from ..base import BaseExtractor, ExtractionMetadata, ExtractionResult, SourceType

logger = logging.getLogger(__name__)


class JSONExtractor(BaseExtractor):
    """
    Extract from JSON uploads
    Supports both EnvSpec format and Gymnasium configs
    """

    @property
    def source_type(self) -> SourceType:
        return SourceType.JSON

    @property
    def name(self) -> str:
        return "JSON Upload Extractor"

    def can_handle(self, input_data: Any) -> bool:
        """Check if input is a dict or JSON string"""
        if isinstance(input_data, dict):
            return True
        if isinstance(input_data, str):
            try:
                json.loads(input_data)
                return True
            except:
                return False
        return False

    async def extract(self, input_data: Any, **kwargs) -> ExtractionResult:
        """Extract from JSON"""
        try:
            # Parse if string
            if isinstance(input_data, str):
                data = json.loads(input_data)
            else:
                data = input_data

            # Detect format
            if self._is_envspec_format(data):
                normalized = self._normalize_envspec(data)
                confidence = 0.9
                method = "envspec_direct"
            elif self._is_gym_format(data):
                normalized = self._normalize_gym(data)
                confidence = 0.8
                method = "gymnasium_config"
            else:
                # Try generic normalization
                normalized = self._normalize_generic(data)
                confidence = 0.6
                method = "generic_json"

            warnings = self._validate_normalized(normalized)

            return ExtractionResult(
                success=True,
                raw_data=data,
                normalized_data=normalized,
                metadata=self._create_metadata(
                    "json_upload",
                    method,
                    confidence,
                    warnings,
                    json.dumps(data, indent=2)[:500],
                ),
            )

        except json.JSONDecodeError as e:
            return ExtractionResult(
                success=False,
                raw_data={},
                normalized_data={},
                metadata=self._create_metadata(
                    "json_upload", "json_parse", 0.0, [f"JSON parse error: {str(e)}"]
                ),
                error=f"Invalid JSON: {str(e)}",
            )
        except Exception as e:
            logger.error(f"JSON extraction failed: {e}", exc_info=True)
            return ExtractionResult(
                success=False,
                raw_data={},
                normalized_data={},
                metadata=self._create_metadata(
                    "json_upload", "json_error", 0.0, [f"Exception: {str(e)}"]
                ),
                error=str(e),
            )

    def _is_envspec_format(self, data: Dict[str, Any]) -> bool:
        """Check if data is already in EnvSpec format"""
        required_fields = ["world", "agents", "actionSpace"]
        return all(field in data for field in required_fields)

    def _is_gym_format(self, data: Dict[str, Any]) -> bool:
        """Check if data is Gymnasium format"""
        return "observation_space" in data or "action_space" in data or "id" in data

    def _normalize_envspec(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize EnvSpec format (already mostly normalized)"""
        # Ensure all required fields exist
        normalized = {
            "envType": data.get("envType", "grid"),
            "name": data.get("name", "Imported Environment"),
            "description": data.get("description", ""),
            "world": data.get(
                "world",
                {
                    "coordinateSystem": "grid",
                    "width": 10,
                    "height": 10,
                    "physics": {"enabled": False},
                },
            ),
            "agents": data.get("agents", []),
            "actionSpace": data.get(
                "actionSpace",
                {"type": "discrete", "actions": ["up", "down", "left", "right"]},
            ),
            "objects": data.get("objects", []),
            "rules": data.get(
                "rules", {"rewards": [], "terminations": [], "events": []}
            ),
        }
        return normalized

    def _normalize_gym(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Gymnasium format to EnvSpec"""
        # Extract action space
        action_space = data.get("action_space", {})
        if isinstance(action_space, dict):
            if action_space.get("type") == "Discrete":
                n = action_space.get("n", 4)
                actions = [f"action_{i}" for i in range(n)]
                if n == 4:
                    actions = ["up", "down", "left", "right"]
                action_spec = {"type": "discrete", "actions": actions}
            elif action_space.get("type") == "Box":
                shape = action_space.get("shape", [2])
                low = action_space.get("low", [-1])
                high = action_space.get("high", [1])
                action_spec = {
                    "type": "continuous",
                    "dimensions": shape[0] if shape else 2,
                    "range": [
                        float(low[0]) if isinstance(low, list) else float(low),
                        float(high[0]) if isinstance(high, list) else float(high),
                    ],
                }
            else:
                action_spec = {
                    "type": "discrete",
                    "actions": ["up", "down", "left", "right"],
                }
        else:
            action_spec = {
                "type": "discrete",
                "actions": ["up", "down", "left", "right"],
            }

        # Extract observation space
        obs_space = data.get("observation_space", {})
        if isinstance(obs_space, dict):
            if obs_space.get("type") == "Box":
                shape = obs_space.get("shape", [2])
                state_spec = {
                    "type": "vector",
                    "dimensions": list(shape) if isinstance(shape, list) else [shape],
                }
            else:
                state_spec = {"type": "vector", "dimensions": [2]}
        else:
            state_spec = {"type": "vector", "dimensions": [2]}

        # Determine env type
        env_type = "continuous2d" if action_spec["type"] == "continuous" else "grid"

        # Build normalized structure
        return {
            "envType": env_type,
            "name": data.get("id", "Gym Environment"),
            "description": data.get("description", ""),
            "world": {
                "coordinateSystem": "grid" if env_type == "grid" else "cartesian",
                "width": 10,
                "height": 10,
                "physics": {"enabled": env_type == "continuous2d"},
            },
            "agents": [
                {
                    "id": "agent_0",
                    "name": "Agent",
                    "position": [0, 0],
                }
            ],
            "actionSpace": action_spec,
            "stateSpace": state_spec,
            "objects": [],
            "rules": {"rewards": [], "terminations": [], "events": []},
        }

    def _normalize_generic(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generic normalization for unknown JSON structure"""
        # Try to infer structure
        env_type = "grid"
        if "continuous" in str(data).lower():
            env_type = "continuous2d"

        return {
            "envType": env_type,
            "name": data.get("name", "Imported Environment"),
            "description": str(data.get("description", "")),
            "world": {
                "coordinateSystem": "grid" if env_type == "grid" else "cartesian",
                "width": data.get("width", 10),
                "height": data.get("height", 10),
                "physics": {"enabled": env_type == "continuous2d"},
            },
            "agents": data.get(
                "agents",
                [
                    {
                        "id": "agent_0",
                        "name": "Agent",
                        "position": [0, 0],
                    }
                ],
            ),
            "actionSpace": data.get(
                "actionSpace",
                {"type": "discrete", "actions": ["up", "down", "left", "right"]},
            ),
            "objects": data.get("objects", []),
            "rules": {
                "rewards": data.get("rewards", []),
                "terminations": data.get("terminations", []),
                "events": [],
            },
        }

    def _validate_normalized(self, normalized: Dict[str, Any]) -> list[str]:
        """Validate normalized structure and return warnings"""
        warnings = []

        if not normalized.get("agents"):
            warnings.append("No agents found, using default")

        if not normalized.get("world", {}).get("width"):
            warnings.append("World width missing, using default")

        if not normalized.get("actionSpace"):
            warnings.append("Action space missing, using default")

        return warnings
