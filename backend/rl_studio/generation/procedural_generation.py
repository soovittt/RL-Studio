"""
Procedural Environment Generation
Generates random environments based on rules
"""

from typing import Dict, Any, List, Optional
import random
import numpy as np
from ..rollout.simulator import Vec2


class ProceduralGenerator:
    """Generates procedural environments"""
    
    def __init__(self):
        self.generators = {
            "maze": self._generate_maze,
            "random_obstacles": self._generate_random_obstacles,
            "sparse_goals": self._generate_sparse_goals,
        }
    
    def generate(
        self,
        env_type: str,
        world_width: int = 10,
        world_height: int = 10,
        num_agents: int = 1,
        num_goals: int = 1,
        obstacle_density: float = 0.2,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate a procedural environment"""
        if env_type not in self.generators:
            raise ValueError(f"Unknown generator type: {env_type}")
        
        generator = self.generators[env_type]
        return generator(
            world_width=world_width,
            world_height=world_height,
            num_agents=num_agents,
            num_goals=num_goals,
            obstacle_density=obstacle_density,
            **kwargs
        )
    
    def _generate_maze(
        self,
        world_width: int,
        world_height: int,
        num_agents: int,
        num_goals: int,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate a simple maze environment"""
        # Simple maze: create walls in a grid pattern
        walls = []
        for x in range(1, world_width - 1, 2):
            for y in range(1, world_height - 1, 2):
                # Randomly place walls
                if random.random() < 0.3:
                    walls.append({
                        "id": f"wall_{len(walls)}",
                        "type": "wall",
                        "position": [x, y],
                        "size": {"type": "circle", "radius": 0.5},
                    })
        
        # Place agents at start
        agents = []
        for i in range(num_agents):
            agents.append({
                "id": f"agent_{i}",
                "position": [0, 0],
            })
        
        # Place goals
        goals = []
        for i in range(num_goals):
            goals.append({
                "id": f"goal_{i}",
                "type": "goal",
                "position": [world_width - 1, world_height - 1],
                "size": {"type": "circle", "radius": 0.5},
            })
        
        return {
            "id": f"maze_{random.randint(1000, 9999)}",
            "name": "Procedural Maze",
            "envType": "grid",
            "world": {
                "width": world_width,
                "height": world_height,
                "coordinateSystem": "grid",
                "cellSize": 1.0,
            },
            "agents": agents,
            "objects": walls + goals,
            "actionSpace": {
                "type": "discrete",
                "actions": ["up", "down", "left", "right"],
            },
            "rules": {
                "rewards": [
                    {
                        "id": "goal_reward",
                        "condition": {"type": "goalReached"},
                        "reward": 10.0,
                    },
                    {
                        "id": "step_penalty",
                        "condition": {"type": "perStep"},
                        "reward": -0.1,
                    },
                ],
                "terminations": [
                    {
                        "id": "goal_termination",
                        "condition": {"type": "goalReached"},
                    },
                    {
                        "id": "timeout",
                        "condition": {"type": "timeout", "steps": 100},
                    },
                ],
            },
        }
    
    def _generate_random_obstacles(
        self,
        world_width: int,
        world_height: int,
        num_agents: int,
        num_goals: int,
        obstacle_density: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate random obstacles"""
        num_obstacles = int(world_width * world_height * obstacle_density)
        obstacles = []
        occupied = set()
        
        # Place obstacles
        for i in range(num_obstacles):
            attempts = 0
            while attempts < 100:
                x = random.randint(0, world_width - 1)
                y = random.randint(0, world_height - 1)
                if (x, y) not in occupied:
                    obstacles.append({
                        "id": f"obstacle_{i}",
                        "type": "obstacle",
                        "position": [x, y],
                        "size": {"type": "circle", "radius": 0.5},
                    })
                    occupied.add((x, y))
                    break
                attempts += 1
        
        # Place agents
        agents = []
        for i in range(num_agents):
            attempts = 0
            while attempts < 100:
                x = random.randint(0, world_width - 1)
                y = random.randint(0, world_height - 1)
                if (x, y) not in occupied:
                    agents.append({
                        "id": f"agent_{i}",
                        "position": [x, y],
                    })
                    occupied.add((x, y))
                    break
                attempts += 1
        
        # Place goals
        goals = []
        for i in range(num_goals):
            attempts = 0
            while attempts < 100:
                x = random.randint(0, world_width - 1)
                y = random.randint(0, world_height - 1)
                if (x, y) not in occupied:
                    goals.append({
                        "id": f"goal_{i}",
                        "type": "goal",
                        "position": [x, y],
                        "size": {"type": "circle", "radius": 0.5},
                    })
                    occupied.add((x, y))
                    break
                attempts += 1
        
        return {
            "id": f"random_obstacles_{random.randint(1000, 9999)}",
            "name": "Random Obstacles",
            "envType": "grid",
            "world": {
                "width": world_width,
                "height": world_height,
                "coordinateSystem": "grid",
                "cellSize": 1.0,
            },
            "agents": agents,
            "objects": obstacles + goals,
            "actionSpace": {
                "type": "discrete",
                "actions": ["up", "down", "left", "right"],
            },
            "rules": {
                "rewards": [
                    {
                        "id": "goal_reward",
                        "condition": {"type": "goalReached"},
                        "reward": 10.0,
                    },
                    {
                        "id": "step_penalty",
                        "condition": {"type": "perStep"},
                        "reward": -0.1,
                    },
                ],
                "terminations": [
                    {
                        "id": "goal_termination",
                        "condition": {"type": "goalReached"},
                    },
                    {
                        "id": "timeout",
                        "condition": {"type": "timeout", "steps": 200},
                    },
                ],
            },
        }
    
    def _generate_sparse_goals(
        self,
        world_width: int,
        world_height: int,
        num_agents: int,
        num_goals: int,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate environment with sparse goals (hard exploration)"""
        # Place agents at center
        agents = []
        for i in range(num_agents):
            agents.append({
                "id": f"agent_{i}",
                "position": [world_width // 2, world_height // 2],
            })
        
        # Place goals far from start
        goals = []
        corners = [
            [0, 0],
            [world_width - 1, 0],
            [0, world_height - 1],
            [world_width - 1, world_height - 1],
        ]
        for i in range(min(num_goals, len(corners))):
            goals.append({
                "id": f"goal_{i}",
                "type": "goal",
                "position": corners[i],
                "size": {"type": "circle", "radius": 0.5},
            })
        
        return {
            "id": f"sparse_goals_{random.randint(1000, 9999)}",
            "name": "Sparse Goals",
            "envType": "grid",
            "world": {
                "width": world_width,
                "height": world_height,
                "coordinateSystem": "grid",
                "cellSize": 1.0,
            },
            "agents": agents,
            "objects": goals,
            "actionSpace": {
                "type": "discrete",
                "actions": ["up", "down", "left", "right"],
            },
            "rules": {
                "rewards": [
                    {
                        "id": "goal_reward",
                        "condition": {"type": "goalReached"},
                        "reward": 100.0,  # Large reward for sparse task
                    },
                    {
                        "id": "step_penalty",
                        "condition": {"type": "perStep"},
                        "reward": -0.01,  # Small penalty
                    },
                ],
                "terminations": [
                    {
                        "id": "goal_termination",
                        "condition": {"type": "goalReached"},
                    },
                    {
                        "id": "timeout",
                        "condition": {"type": "timeout", "steps": 500},
                    },
                ],
            },
        }

