"""
Unification Processor - Normalizes all inputs to common structure
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from .base import ExtractionResult

logger = logging.getLogger(__name__)


@dataclass
class UnificationResult:
    """Result from unification process"""
    success: bool
    unified_data: Dict[str, Any]
    confidence: float
    warnings: List[str]
    source_trace: Dict[str, Any]  # Track where data came from
    error: Optional[str] = None


class UnificationProcessor:
    """
    Unifies extracted data from any source into a common structure
    
    Process:
    1. Detect key entities (agent, actions, rewards, states, termination)
    2. Identify type (grid vs. continuous vs. hybrid)
    3. Infer numeric params (dimensions, limits, timeouts, scaling)
    4. Resolve conflicts (e.g., continuous + discrete action mention)
    5. Map to canonical structure
    """
    
    def unify(self, extraction_result: ExtractionResult) -> UnificationResult:
        """
        Unify extracted data into canonical structure
        
        Args:
            extraction_result: Result from an extractor
        
        Returns:
            UnificationResult with unified data
        """
        try:
            if not extraction_result.success:
                return UnificationResult(
                    success=False,
                    unified_data={},
                    confidence=0.0,
                    warnings=extraction_result.metadata.warnings,
                    source_trace={},
                    error=extraction_result.error
                )
            
            normalized = extraction_result.normalized_data
            
            # Detect and resolve conflicts
            resolved = self._resolve_conflicts(normalized)
            
            # Infer missing fields
            inferred = self._infer_missing(resolved)
            
            # Validate structure
            validated = self._validate_structure(inferred)
            
            # Build source trace
            source_trace = {
                "source_type": extraction_result.metadata.source_type.value,
                "source_identifier": extraction_result.metadata.source_identifier,
                "extraction_method": extraction_result.metadata.extraction_method,
                "extraction_confidence": extraction_result.metadata.confidence,
            }
            
            # Calculate unified confidence
            confidence = self._calculate_confidence(
                extraction_result.metadata.confidence,
                validated
            )
            
            warnings = extraction_result.metadata.warnings + self._collect_warnings(validated)
            
            return UnificationResult(
                success=True,
                unified_data=validated,
                confidence=confidence,
                warnings=warnings,
                source_trace=source_trace
            )
            
        except Exception as e:
            logger.error(f"Unification failed: {e}", exc_info=True)
            return UnificationResult(
                success=False,
                unified_data={},
                confidence=0.0,
                warnings=[f"Unification error: {str(e)}"],
                source_trace={},
                error=str(e)
            )
    
    def _resolve_conflicts(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflicts in extracted data"""
        resolved = data.copy()
        
        # Check for action space conflicts
        action_space = resolved.get("actionSpace", {})
        env_type = resolved.get("envType", "grid")
        
        # If env_type is continuous but action_space is discrete, prefer continuous
        if env_type == "continuous2d" and action_space.get("type") == "discrete":
            resolved["actionSpace"] = {
                "type": "continuous",
                "dimensions": 2,
                "range": [-1, 1]
            }
            resolved["_conflicts_resolved"] = ["action_space_type"]
        
        # If env_type is grid but action_space is continuous, prefer discrete
        if env_type == "grid" and action_space.get("type") == "continuous":
            resolved["actionSpace"] = {
                "type": "discrete",
                "actions": ["up", "down", "left", "right"]
            }
            resolved["_conflicts_resolved"] = resolved.get("_conflicts_resolved", []) + ["action_space_type"]
        
        return resolved
    
    def _infer_missing(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Infer missing fields based on existing data"""
        inferred = data.copy()
        
        # Ensure world exists
        if "world" not in inferred:
            env_type = inferred.get("envType", "grid")
            inferred["world"] = {
                "coordinateSystem": "grid" if env_type == "grid" else "cartesian",
                "width": 10,
                "height": 10,
                "physics": {"enabled": env_type == "continuous2d"}
            }
        
        # Ensure agents exist
        if "agents" not in inferred or not inferred["agents"]:
            inferred["agents"] = [{
                "id": "agent_0",
                "name": "Agent",
                "position": [0, 0],
            }]
        
        # Ensure actionSpace exists
        if "actionSpace" not in inferred:
            env_type = inferred.get("envType", "grid")
            if env_type == "grid":
                inferred["actionSpace"] = {
                    "type": "discrete",
                    "actions": ["up", "down", "left", "right"]
                }
            else:
                inferred["actionSpace"] = {
                    "type": "continuous",
                    "dimensions": 2,
                    "range": [-1, 1]
                }
        
        # Ensure rules exist
        if "rules" not in inferred:
            inferred["rules"] = {
                "rewards": [],
                "terminations": [],
                "events": []
            }
        
        # Ensure objects exist
        if "objects" not in inferred:
            inferred["objects"] = []
        
        return inferred
    
    def _validate_structure(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and fix structure"""
        validated = data.copy()
        
        # Validate world dimensions
        world = validated.get("world", {})
        if not isinstance(world.get("width"), (int, float)) or world.get("width", 0) <= 0:
            world["width"] = 10
        if not isinstance(world.get("height"), (int, float)) or world.get("height", 0) <= 0:
            world["height"] = 10
        
        # Validate agent positions
        agents = validated.get("agents", [])
        for agent in agents:
            pos = agent.get("position", [0, 0])
            if not isinstance(pos, list) or len(pos) < 2:
                agent["position"] = [0, 0]
            else:
                # Clamp to world bounds
                x, y = float(pos[0]), float(pos[1])
                agent["position"] = [
                    max(0, min(x, world.get("width", 10))),
                    max(0, min(y, world.get("height", 10)))
                ]
        
        # Validate action space
        action_space = validated.get("actionSpace", {})
        if action_space.get("type") == "discrete":
            if not action_space.get("actions") or not isinstance(action_space["actions"], list):
                action_space["actions"] = ["up", "down", "left", "right"]
        elif action_space.get("type") == "continuous":
            if not isinstance(action_space.get("dimensions"), int):
                action_space["dimensions"] = 2
            if not isinstance(action_space.get("range"), list) or len(action_space["range"]) < 2:
                action_space["range"] = [-1, 1]
        
        return validated
    
    def _calculate_confidence(self, extraction_confidence: float, unified_data: Dict[str, Any]) -> float:
        """Calculate unified confidence"""
        confidence = extraction_confidence
        
        # Boost confidence for complete structures
        if unified_data.get("agents") and len(unified_data["agents"]) > 0:
            confidence += 0.05
        if unified_data.get("actionSpace"):
            confidence += 0.05
        if unified_data.get("rules", {}).get("rewards"):
            confidence += 0.05
        if unified_data.get("rules", {}).get("terminations"):
            confidence += 0.05
        
        return min(1.0, confidence)
    
    def _collect_warnings(self, unified_data: Dict[str, Any]) -> List[str]:
        """Collect warnings about unified data"""
        warnings = []
        
        if not unified_data.get("agents"):
            warnings.append("No agents in unified data")
        
        if not unified_data.get("actionSpace"):
            warnings.append("No action space in unified data")
        
        if unified_data.get("_conflicts_resolved"):
            warnings.append(f"Resolved conflicts: {', '.join(unified_data['_conflicts_resolved'])}")
        
        return warnings

