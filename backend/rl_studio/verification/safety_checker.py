"""
Safety Checker
Detects unsafe states, collision risks, etc.
"""

from typing import Dict, Any, List
from ..rollout.simulator import Vec2


class SafetyChecker:
    """Checks environment for safety issues"""
    
    def check(self, env_spec: Dict[str, Any], state: Dict[str, Any] = None) -> Dict[str, Any]:
        """Check environment and state for safety issues"""
        issues = []
        warnings = []
        
        # Check collision safety
        collision_issues = self._check_collision_safety(env_spec)
        issues.extend(collision_issues)
        
        # Check unsafe states
        if state:
            unsafe_states = self._check_unsafe_states(state, env_spec)
            issues.extend(unsafe_states)
        
        # Check bounds
        bounds_issues = self._check_bounds(env_spec)
        warnings.extend(bounds_issues)
        
        return {
            "safe": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
        }
    
    def _check_collision_safety(self, env_spec: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check for collision safety issues"""
        issues = []
        
        agents = env_spec.get("agents", [])
        objects = env_spec.get("objects", [])
        
        # Check if agents start inside obstacles
        for agent in agents:
            agent_pos = Vec2.from_list(agent.get("position", [0, 0]))
            for obj in objects:
                if obj.get("type") in ["wall", "obstacle"]:
                    obj_pos = Vec2.from_list(obj.get("position", [0, 0]))
                    dist = agent_pos.distance(obj_pos)
                    if dist < 0.5:
                        issues.append({
                            "type": "collision_risk",
                            "agent_id": agent.get("id", "unknown"),
                            "object_id": obj.get("id", "unknown"),
                            "message": f"Agent starts too close to obstacle (distance: {dist:.2f})",
                        })
        
        return issues
    
    def _check_unsafe_states(self, state: Dict[str, Any], env_spec: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check for unsafe states"""
        issues = []
        
        agents = state.get("agents", [])
        objects = state.get("objects", [])
        
        # Check for agents in unsafe positions
        for agent in agents:
            agent_pos = Vec2.from_list(agent.get("position", [0, 0]))
            
            # Check bounds
            world = env_spec.get("world", {})
            if world.get("coordinateSystem") == "grid":
                if agent_pos.x < 0 or agent_pos.x >= world.get("width", 10) or \
                   agent_pos.y < 0 or agent_pos.y >= world.get("height", 10):
                    issues.append({
                        "type": "unsafe_state",
                        "agent_id": agent.get("id", "unknown"),
                        "message": "Agent is out of bounds",
                    })
            
            # Check for collisions
            for obj in objects:
                if obj.get("type") in ["wall", "obstacle"]:
                    obj_pos = Vec2.from_list(obj.get("position", [0, 0]))
                    dist = agent_pos.distance(obj_pos)
                    if dist < 0.1:
                        issues.append({
                            "type": "unsafe_state",
                            "agent_id": agent.get("id", "unknown"),
                            "message": "Agent is colliding with obstacle",
                        })
        
        return issues
    
    def _check_bounds(self, env_spec: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check for bounds issues"""
        warnings = []
        
        world = env_spec.get("world", {})
        width = world.get("width", 10)
        height = world.get("height", 10)
        
        # Check if bounds are reasonable
        if width < 1 or height < 1:
            warnings.append({
                "type": "bounds_warning",
                "message": "Environment bounds are very small",
            })
        
        if width > 1000 or height > 1000:
            warnings.append({
                "type": "bounds_warning",
                "message": "Environment bounds are very large (may cause performance issues)",
            })
        
        return warnings

