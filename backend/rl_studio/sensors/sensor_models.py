"""
Sensor Models for RL Agents
Raycast, LIDAR, vision cone, proximity sensors
"""

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ..rollout.simulator import Vec2


class SensorModel:
    """Base class for sensor models"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    def sense(
        self,
        agent_pos: Vec2,
        agent_angle: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
    ) -> np.ndarray:
        """Perform sensing and return observation vector"""
        raise NotImplementedError


class RaycastSensor(SensorModel):
    """Raycast sensor - casts rays in specified directions"""

    def sense(
        self,
        agent_pos: Vec2,
        agent_angle: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
    ) -> np.ndarray:
        """Cast rays and return distances to obstacles"""
        num_rays = self.config.get("numRays", 8)
        max_range = self.config.get("maxRange", 10.0)
        ray_angles = self.config.get("rayAngles", None)

        if ray_angles is None:
            # Default: evenly spaced rays
            ray_angles = [2 * math.pi * i / num_rays for i in range(num_rays)]

        distances = []
        world = env_spec.get("world", {})

        for ray_angle in ray_angles:
            # Absolute angle
            abs_angle = agent_angle + ray_angle

            # Cast ray
            distance = self._cast_ray(
                agent_pos, abs_angle, max_range, state, env_spec, world
            )
            distances.append(distance)

        return np.array(distances, dtype=np.float32)

    def _cast_ray(
        self,
        start: Vec2,
        angle: float,
        max_range: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
        world: Dict[str, Any],
    ) -> float:
        """Cast a single ray and return distance to first obstacle"""
        # Ray direction
        dx = math.cos(angle) * max_range
        dy = math.sin(angle) * max_range

        # Sample points along ray
        num_samples = int(max_range * 10)  # 10 samples per unit
        step_size = max_range / num_samples

        for i in range(num_samples):
            t = i * step_size
            x = start.x + dx * (t / max_range)
            y = start.y + dy * (t / max_range)
            point = Vec2(x, y)

            # Check bounds
            if world.get("coordinateSystem") == "grid":
                if (
                    x < 0
                    or x >= world.get("width", 10)
                    or y < 0
                    or y >= world.get("height", 10)
                ):
                    return t
            else:
                if world.get("coordinateSystem") == "cartesian":
                    if (
                        abs(x) > world.get("width", 10) / 2
                        or abs(y) > world.get("height", 10) / 2
                    ):
                        return t

            # Check obstacles
            for obj in state.get("objects", []):
                if obj.get("type") in ["wall", "obstacle"]:
                    obj_pos = Vec2.from_list(obj.get("position", [0, 0]))
                    dist = point.distance(obj_pos)
                    if dist < 0.5:  # Hit obstacle
                        return t

        return max_range  # No hit


class LIDARSensor(SensorModel):
    """LIDAR sensor - 360-degree distance measurements"""

    def sense(
        self,
        agent_pos: Vec2,
        agent_angle: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
    ) -> np.ndarray:
        """Perform LIDAR scan"""
        num_beams = self.config.get("numBeams", 36)  # 36 beams = 10 degree resolution
        max_range = self.config.get("maxRange", 10.0)

        distances = []
        world = env_spec.get("world", {})

        for i in range(num_beams):
            angle = 2 * math.pi * i / num_beams
            distance = self._cast_ray(
                agent_pos, angle, max_range, state, env_spec, world
            )
            distances.append(distance)

        return np.array(distances, dtype=np.float32)

    def _cast_ray(
        self,
        start: Vec2,
        angle: float,
        max_range: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
        world: Dict[str, Any],
    ) -> float:
        """Cast a single ray (same as RaycastSensor)"""
        dx = math.cos(angle) * max_range
        dy = math.sin(angle) * max_range
        num_samples = int(max_range * 10)
        step_size = max_range / num_samples

        for i in range(num_samples):
            t = i * step_size
            x = start.x + dx * (t / max_range)
            y = start.y + dy * (t / max_range)
            point = Vec2(x, y)

            if world.get("coordinateSystem") == "grid":
                if (
                    x < 0
                    or x >= world.get("width", 10)
                    or y < 0
                    or y >= world.get("height", 10)
                ):
                    return t
            else:
                if (
                    abs(x) > world.get("width", 10) / 2
                    or abs(y) > world.get("height", 10) / 2
                ):
                    return t

            for obj in state.get("objects", []):
                if obj.get("type") in ["wall", "obstacle"]:
                    obj_pos = Vec2.from_list(obj.get("position", [0, 0]))
                    if point.distance(obj_pos) < 0.5:
                        return t

        return max_range


class VisionConeSensor(SensorModel):
    """Vision cone sensor - detects objects within a cone"""

    def sense(
        self,
        agent_pos: Vec2,
        agent_angle: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
    ) -> np.ndarray:
        """Detect objects in vision cone"""
        cone_angle = self.config.get("coneAngle", math.pi / 3)  # 60 degrees
        max_range = self.config.get("maxRange", 10.0)
        detect_types = self.config.get("detectTypes", ["goal", "obstacle", "wall"])

        detected_objects = []

        for obj in state.get("objects", []):
            if obj.get("type") not in detect_types:
                continue

            obj_pos = Vec2.from_list(obj.get("position", [0, 0]))
            dist = agent_pos.distance(obj_pos)

            if dist > max_range:
                continue

            # Check if object is within cone
            dx = obj_pos.x - agent_pos.x
            dy = obj_pos.y - agent_pos.y
            obj_angle = math.atan2(dy, dx)

            # Angle difference
            angle_diff = abs(obj_angle - agent_angle)
            if angle_diff > math.pi:
                angle_diff = 2 * math.pi - angle_diff

            if angle_diff <= cone_angle / 2:
                detected_objects.append(
                    {
                        "type": obj.get("type"),
                        "distance": dist,
                        "angle": angle_diff,
                        "position": obj_pos.to_list(),
                    }
                )

        # Return as feature vector: [num_detected, avg_distance, min_distance, ...]
        if detected_objects:
            distances = [obj["distance"] for obj in detected_objects]
            return np.array(
                [
                    len(detected_objects),
                    np.mean(distances),
                    np.min(distances),
                    np.max(distances),
                ],
                dtype=np.float32,
            )
        else:
            return np.array([0, max_range, max_range, max_range], dtype=np.float32)


class ProximitySensor(SensorModel):
    """Proximity sensor - detects nearby objects"""

    def sense(
        self,
        agent_pos: Vec2,
        agent_angle: float,
        state: Dict[str, Any],
        env_spec: Dict[str, Any],
    ) -> np.ndarray:
        """Detect nearby objects"""
        radius = self.config.get("radius", 2.0)
        detect_types = self.config.get("detectTypes", ["goal", "obstacle", "wall"])

        nearby_objects = []

        for obj in state.get("objects", []):
            if obj.get("type") not in detect_types:
                continue

            obj_pos = Vec2.from_list(obj.get("position", [0, 0]))
            dist = agent_pos.distance(obj_pos)

            if dist <= radius:
                nearby_objects.append(
                    {
                        "type": obj.get("type"),
                        "distance": dist,
                        "position": obj_pos.to_list(),
                    }
                )

        # Return binary features for each direction (N, E, S, W)
        features = np.zeros(4, dtype=np.float32)

        for obj in nearby_objects:
            pos = obj["position"]
            dx = pos[0] - agent_pos.x
            dy = pos[1] - agent_pos.y

            # Determine direction
            if abs(dy) > abs(dx):
                if dy > 0:
                    features[2] = 1.0  # South
                else:
                    features[0] = 1.0  # North
            else:
                if dx > 0:
                    features[1] = 1.0  # East
                else:
                    features[3] = 1.0  # West

        return features


class SensorCalculator:
    """Calculates sensor readings for agents"""

    @staticmethod
    def calculate_sensors(
        agent: Dict[str, Any], state: Dict[str, Any], env_spec: Dict[str, Any]
    ) -> Dict[str, np.ndarray]:
        """Calculate all sensor readings for an agent"""
        agent_pos = Vec2.from_list(agent.get("position", [0, 0]))
        agent_angle = agent.get("angle", 0.0)  # Assume agents have orientation

        sensors = agent.get("sensors", [])
        readings = {}

        for sensor_spec in sensors:
            sensor_type = sensor_spec.get("type")
            config = sensor_spec.get("config", {})

            if sensor_type == "raycast":
                sensor = RaycastSensor(config)
            elif sensor_type == "lidar":
                sensor = LIDARSensor(config)
            elif sensor_type == "visionCone":
                sensor = VisionConeSensor(config)
            elif sensor_type == "proximity":
                sensor = ProximitySensor(config)
            else:
                continue

            sensor_id = sensor_spec.get("id", sensor_type)
            readings[sensor_id] = sensor.sense(agent_pos, agent_angle, state, env_spec)

        return readings
