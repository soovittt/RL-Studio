"""
EnvSpec Builder - Builds complete, validated EnvSpec from unified data
"""

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .unifier import UnificationResult

logger = logging.getLogger(__name__)


@dataclass
class BuildResult:
    """Result from EnvSpec building"""

    success: bool
    env_spec: Dict[str, Any]
    validation_errors: List[str]
    warnings: List[str]
    build_metadata: Dict[str, Any]
    error: Optional[str] = None


class EnvSpecBuilder:
    """
    Builds complete EnvSpec from unified data

    Fills:
    - AgentSpec (with defaults if missing)
    - RuleSet (rewards, terminations, events)
    - State/ActionSpec (with validation)
    - WorldSpec (with physics)
    - Validates schema
    """

    def build(self, unification_result: UnificationResult) -> BuildResult:
        """
        Build complete EnvSpec from unified data

        Args:
            unification_result: Result from unification processor

        Returns:
            BuildResult with complete EnvSpec
        """
        try:
            if not unification_result.success:
                return BuildResult(
                    success=False,
                    env_spec={},
                    validation_errors=[],
                    warnings=unification_result.warnings,
                    build_metadata={},
                    error=unification_result.error,
                )

            unified = unification_result.unified_data

            # Build complete EnvSpec
            env_spec = {
                "id": f"env_{int(time.time() * 1000)}",
                "name": unified.get("name", "Imported Environment"),
                "envType": unified.get("envType", "grid"),
                "world": self._build_world_spec(unified),
                "objects": unified.get("objects", []),
                "agents": self._build_agent_specs(unified),
                "actionSpace": self._build_action_space(unified),
                "stateSpace": self._build_state_space(unified),
                "rules": self._build_rules(unified),
                "visuals": self._build_visuals(unified),
                "metadata": self._build_metadata(unified, unification_result),
            }

            # Validate
            validation_errors = self._validate_env_spec(env_spec)

            # Collect warnings
            warnings = unification_result.warnings + self._collect_build_warnings(
                env_spec
            )

            build_metadata = {
                "build_timestamp": time.time(),
                "source_trace": unification_result.source_trace,
                "confidence": unification_result.confidence,
                "validation_passed": len(validation_errors) == 0,
            }

            return BuildResult(
                success=len(validation_errors) == 0,
                env_spec=env_spec,
                validation_errors=validation_errors,
                warnings=warnings,
                build_metadata=build_metadata,
            )

        except Exception as e:
            logger.error(f"EnvSpec building failed: {e}", exc_info=True)
            return BuildResult(
                success=False,
                env_spec={},
                validation_errors=[str(e)],
                warnings=[],
                build_metadata={},
                error=str(e),
            )

    def _build_world_spec(self, unified: Dict[str, Any]) -> Dict[str, Any]:
        """Build world specification"""
        world = unified.get("world", {})
        env_type = unified.get("envType", "grid")

        return {
            "coordinateSystem": world.get(
                "coordinateSystem", "grid" if env_type == "grid" else "cartesian"
            ),
            "width": world.get("width", 10),
            "height": world.get("height", 10),
            "cellSize": world.get("cellSize", 1 if env_type == "grid" else None),
            "physics": world.get(
                "physics",
                {"enabled": env_type == "continuous2d", "collisionEnabled": True},
            ),
            "geometry": world.get("geometry"),
        }

    def _build_agent_specs(self, unified: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build agent specifications"""
        agents = unified.get("agents", [])
        env_type = unified.get("envType", "grid")

        if not agents:
            agents = [
                {
                    "id": "agent_0",
                    "name": "Agent",
                    "position": [0, 0],
                }
            ]

        # Enhance each agent
        enhanced_agents = []
        for agent in agents:
            enhanced = {
                "id": agent.get("id", f"agent_{len(enhanced_agents)}"),
                "name": agent.get("name", "Agent"),
                "position": agent.get("position", [0, 0]),
                "rotation": agent.get("rotation", 0),
                "dynamics": agent.get(
                    "dynamics",
                    {
                        "type": (
                            "grid-step" if env_type == "grid" else "continuous-velocity"
                        ),
                        "maxSpeed": (
                            agent.get("maxSpeed", 1.0) if env_type != "grid" else None
                        ),
                    },
                ),
                "sensors": agent.get("sensors", []),
            }
            enhanced_agents.append(enhanced)

        return enhanced_agents

    def _build_action_space(self, unified: Dict[str, Any]) -> Dict[str, Any]:
        """Build action space specification"""
        action_space = unified.get("actionSpace", {})
        env_type = unified.get("envType", "grid")

        if not action_space:
            if env_type == "grid":
                action_space = {
                    "type": "discrete",
                    "actions": ["up", "down", "left", "right"],
                }
            else:
                action_space = {"type": "continuous", "dimensions": 2, "range": [-1, 1]}

        return action_space

    def _build_state_space(self, unified: Dict[str, Any]) -> Dict[str, Any]:
        """Build state space specification"""
        state_space = unified.get("stateSpace", {})
        env_type = unified.get("envType", "grid")

        if not state_space:
            state_space = {
                "type": "vector",
                "dimensions": [2],
                "components": [
                    {"name": "position", "type": "position", "dimensions": [2]}
                ],
            }

        return state_space

    def _build_rules(self, unified: Dict[str, Any]) -> Dict[str, Any]:
        """Build rules (rewards, terminations, events)"""
        rules = unified.get("rules", {})

        return {
            "rewards": rules.get("rewards", []),
            "terminations": rules.get("terminations", []),
            "events": rules.get("events", []),
        }

    def _build_visuals(self, unified: Dict[str, Any]) -> Dict[str, Any]:
        """Build visual specification"""
        env_type = unified.get("envType", "grid")

        return {
            "renderer": "grid" if env_type == "grid" else "continuous2d",
        }

    def _build_metadata(
        self, unified: Dict[str, Any], unification_result: UnificationResult
    ) -> Dict[str, Any]:
        """Build metadata"""
        return {
            "tags": unified.get("metadata", {}).get("tags", []),
            "notes": unified.get("description", ""),
            "source": unification_result.source_trace.get("source_type", "unknown"),
            "imported_at": time.time(),
        }

    def _validate_env_spec(self, env_spec: Dict[str, Any]) -> List[str]:
        """Validate EnvSpec structure"""
        errors = []

        # Check required fields
        required_fields = [
            "id",
            "name",
            "envType",
            "world",
            "agents",
            "actionSpace",
            "rules",
        ]
        for field in required_fields:
            if field not in env_spec:
                errors.append(f"Missing required field: {field}")

        # Validate world
        world = env_spec.get("world", {})
        if (
            not isinstance(world.get("width"), (int, float))
            or world.get("width", 0) <= 0
        ):
            errors.append("World width must be positive number")
        if (
            not isinstance(world.get("height"), (int, float))
            or world.get("height", 0) <= 0
        ):
            errors.append("World height must be positive number")

        # Validate agents
        agents = env_spec.get("agents", [])
        if not agents:
            errors.append("At least one agent required")
        for i, agent in enumerate(agents):
            if not agent.get("id"):
                errors.append(f"Agent {i} missing id")
            if not agent.get("position") or len(agent.get("position", [])) < 2:
                errors.append(f"Agent {i} missing valid position")

        # Validate action space
        action_space = env_spec.get("actionSpace", {})
        if action_space.get("type") == "discrete":
            if not action_space.get("actions") or not isinstance(
                action_space["actions"], list
            ):
                errors.append("Discrete action space must have actions list")
        elif action_space.get("type") == "continuous":
            if not isinstance(action_space.get("dimensions"), int):
                errors.append("Continuous action space must have dimensions")
            if (
                not isinstance(action_space.get("range"), list)
                or len(action_space.get("range", [])) < 2
            ):
                errors.append("Continuous action space must have range [min, max]")

        return errors

    def _collect_build_warnings(self, env_spec: Dict[str, Any]) -> List[str]:
        """Collect warnings about built EnvSpec"""
        warnings = []

        if not env_spec.get("rules", {}).get("rewards"):
            warnings.append("No reward rules defined")

        if not env_spec.get("rules", {}).get("terminations"):
            warnings.append("No termination rules defined")

        if not env_spec.get("objects"):
            warnings.append("No objects defined")

        return warnings
