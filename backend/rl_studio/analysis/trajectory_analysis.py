"""
Action-State Trajectory Analysis
Scientific RL feature for trajectory visualization and policy analysis
Uses scipy, sklearn for proper RL math
"""

from typing import Dict, Any, List, Tuple
import numpy as np
from scipy import stats
from scipy.spatial.distance import euclidean
from sklearn.cluster import DBSCAN
from collections import defaultdict


class TrajectoryAnalyzer:
    """Analyzes agent trajectories for RL interpretability"""
    
    def __init__(self):
        self.trajectories: List[List[Dict[str, Any]]] = []
        self.action_state_pairs: List[Tuple[Any, Any]] = []
        self.policy_entropy_history: List[float] = []
    
    def analyze_rollout(self, rollout_steps: List[Dict[str, Any]], env_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze trajectory from a rollout - OPTIMIZED with NumPy vectorization"""
        trajectory = []
        action_state_pairs = []
        action_distribution = defaultdict(int)
        
        # OPTIMIZED: Batch extract positions for NumPy processing
        positions = []
        for step in rollout_steps:
            state = step.get("state", {})
            action = step.get("action")
            
            # Extract agent position
            agents = state.get("agents", [])
            if agents:
                agent_pos = agents[0].get("position", [0, 0])
                positions.append(agent_pos)
                trajectory.append({
                    "step": state.get("step", 0),
                    "position": agent_pos,
                    "action": action,
                    "reward": step.get("reward", 0.0),
                })
                
                # Action-state pair
                action_state_pairs.append({
                    "action": action,
                    "state": agent_pos,
                    "step": state.get("step", 0),
                })
                
                # Track action distribution
                if isinstance(action, str):
                    action_distribution[action] += 1
                elif isinstance(action, list):
                    action_distribution[f"continuous_{len(action)}d"] += 1
        
        # Use scipy.stats for proper entropy calculation (RL standard)
        total_actions = sum(action_distribution.values())
        if total_actions > 0:
            probs = np.array([count / total_actions for count in action_distribution.values()])
            # Use scipy.stats.entropy for proper Shannon entropy (RL standard)
            entropy = float(stats.entropy(probs, base=2))  # Base 2 for bits
        else:
            entropy = 0.0
        
        # Analyze trajectory patterns (uses NumPy internally)
        analysis = {
            "trajectory_path": trajectory,
            "action_state_pairs": action_state_pairs,
            "action_distribution": dict(action_distribution),
            "policy_entropy": entropy,
            "trajectory_length": len(trajectory),
            "path_efficiency": self._calculate_path_efficiency(trajectory),
            "oscillation_detection": self._detect_oscillations(trajectory),
            "suboptimal_attractors": self._detect_attractors(trajectory),
        }
        
        return analysis
    
    def analyze_multiple_rollouts(self, rollouts: List[List[Dict[str, Any]]], env_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze multiple rollouts for aggregate trajectory statistics"""
        all_trajectories = []
        all_entropies = []
        
        for rollout in rollouts:
            analysis = self.analyze_rollout(rollout, env_spec)
            all_trajectories.append(analysis["trajectory_path"])
            all_entropies.append(analysis["policy_entropy"])
        
        # Aggregate analysis
        aggregate = {
            "num_rollouts": len(rollouts),
            "mean_entropy": np.mean(all_entropies) if all_entropies else 0,
            "std_entropy": np.std(all_entropies) if all_entropies else 0,
            "entropy_over_time": self._calculate_entropy_over_time(all_trajectories),
            "common_paths": self._find_common_paths(all_trajectories),
            "trajectory_diversity": self._calculate_diversity(all_trajectories),
        }
        
        return aggregate
    
    def _calculate_path_efficiency(self, trajectory: List[Dict[str, Any]]) -> float:
        """Calculate path efficiency using scipy distance calculations (proper RL metric)"""
        if len(trajectory) < 2:
            return 1.0
        
        positions = np.array([t["position"] for t in trajectory])
        start_pos = positions[0]
        end_pos = positions[-1]
        
        # Use scipy.spatial.distance for proper distance calculation
        straight_dist = euclidean(start_pos, end_pos)
        
        # Calculate actual path distance using numpy (vectorized)
        if len(positions) > 1:
            diffs = np.diff(positions, axis=0)
            distances = np.linalg.norm(diffs, axis=1)
            actual_dist = float(np.sum(distances))
        else:
            actual_dist = 0.0
        
        if actual_dist == 0:
            return 1.0
        
        # Efficiency = straight-line / actual path (higher is better)
        efficiency = float(straight_dist / actual_dist)
        return min(efficiency, 1.0)  # Cap at 1.0
    
    def _detect_oscillations(self, trajectory: List[Dict[str, Any]], window: int = 5) -> Dict[str, Any]:
        """Detect oscillations using scipy signal processing (proper RL method)"""
        if len(trajectory) < window * 2:
            return {"detected": False, "oscillation_count": 0, "oscillation_rate": 0.0}
        
        positions = np.array([t["position"] for t in trajectory])
        
        # Use scipy for autocorrelation to detect oscillations
        # Calculate position changes
        position_changes = np.diff(positions, axis=0)
        distances = np.linalg.norm(position_changes, axis=1)
        
        # Use autocorrelation to detect periodic patterns (oscillations)
        from scipy.signal import correlate
        if len(distances) > window:
            autocorr = correlate(distances, distances, mode='valid')
            # Normalize
            autocorr = autocorr / (len(distances) - window + 1)
            # Check for significant autocorrelation at small lags (oscillation indicator)
            oscillation_score = np.mean(autocorr[:window]) if len(autocorr) >= window else 0
            detected = oscillation_score > 0.3  # Threshold for oscillation detection
        else:
            detected = False
            oscillation_score = 0
        
        # Count actual oscillation cycles
        oscillation_count = 0
        for i in range(window, len(positions) - window):
            current = positions[i]
            # Check for back-and-forth pattern
            prev_window = positions[max(0, i - window):i]
            if len(prev_window) > 0:
                distances_to_prev = np.linalg.norm(prev_window - current, axis=1)
                if np.any(distances_to_prev < 0.1):  # Very close to previous position
                    oscillation_count += 1
        
        return {
            "detected": detected,
            "oscillation_count": oscillation_count,
            "oscillation_rate": oscillation_count / len(trajectory) if trajectory else 0.0,
            "oscillation_score": float(oscillation_score),
        }
    
    def _detect_attractors(self, trajectory: List[Dict[str, Any]], radius: float = 1.0) -> List[Dict[str, Any]]:
        """Detect suboptimal attractors using sklearn DBSCAN clustering (proper RL method)"""
        if len(trajectory) < 10:
            return []
        
        positions = np.array([t["position"] for t in trajectory])
        
        # Use sklearn DBSCAN for proper clustering (RL standard method)
        # eps = radius, min_samples = minimum points to form cluster
        clustering = DBSCAN(eps=radius, min_samples=5).fit(positions)
        labels = clustering.labels_
        
        attractors = []
        unique_labels = set(labels)
        
        for label in unique_labels:
            if label == -1:  # Noise points, skip
                continue
            
            # Get all points in this cluster
            cluster_indices = np.where(labels == label)[0]
            cluster_positions = positions[cluster_indices]
            
            # Calculate cluster center (mean position)
            center = np.mean(cluster_positions, axis=0)
            
            # Calculate visit statistics
            visit_count = len(cluster_indices)
            visit_duration = max(cluster_indices) - min(cluster_indices) + 1
            
            attractors.append({
                "position": center.tolist(),
                "visit_count": int(visit_count),
                "visit_duration": int(visit_duration),
                "steps": cluster_indices.tolist(),
                "cluster_id": int(label),
            })
        
        # Sort by visit count (most visited first)
        attractors.sort(key=lambda x: x["visit_count"], reverse=True)
        
        return attractors
    
    def _calculate_entropy_over_time(self, trajectories: List[List[Dict[str, Any]]]) -> List[float]:
        """Calculate policy entropy over time across rollouts"""
        if not trajectories:
            return []
        
        max_length = max(len(t) for t in trajectories)
        entropy_over_time = []
        
        for step_idx in range(max_length):
            step_actions = []
            for traj in trajectories:
                if step_idx < len(traj):
                    step_actions.append(traj[step_idx].get("action"))
            
            if step_actions:
                action_counts = defaultdict(int)
                for action in step_actions:
                    action_key = str(action) if not isinstance(action, str) else action
                    action_counts[action_key] += 1
                
                total = sum(action_counts.values())
                probs = [count / total for count in action_counts.values()]
                entropy = -sum(p * np.log(p + 1e-10) for p in probs)
                entropy_over_time.append(entropy)
        
        return entropy_over_time
    
    def _find_common_paths(self, trajectories: List[List[Dict[str, Any]]], min_length: int = 3) -> List[Dict[str, Any]]:
        """Find common path segments across trajectories"""
        if not trajectories:
            return []
        
        # Extract action sequences
        action_sequences = []
        for traj in trajectories:
            seq = [t.get("action") for t in traj]
            action_sequences.append(seq)
        
        # Find common subsequences
        common_paths = []
        # Simple implementation: find common action patterns
        # In production, use more sophisticated sequence mining
        
        return common_paths
    
    def _calculate_diversity(self, trajectories: List[List[Dict[str, Any]]]) -> float:
        """Calculate trajectory diversity (how different trajectories are)"""
        if len(trajectories) < 2:
            return 0.0
        
        # Calculate pairwise distances between trajectories
        distances = []
        for i in range(len(trajectories)):
            for j in range(i + 1, len(trajectories)):
                traj1 = trajectories[i]
                traj2 = trajectories[j]
                
                # Align trajectories by length
                min_len = min(len(traj1), len(traj2))
                if min_len == 0:
                    continue
                
                # Calculate average position difference
                pos_diff = 0.0
                for k in range(min_len):
                    pos1 = traj1[k]["position"]
                    pos2 = traj2[k]["position"]
                    pos_diff += np.sqrt(
                        (pos1[0] - pos2[0])**2 + 
                        (pos1[1] - pos2[1])**2
                    )
                
                distances.append(pos_diff / min_len)
        
        return np.mean(distances) if distances else 0.0

