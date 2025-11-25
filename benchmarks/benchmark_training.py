"""
Training Performance Benchmarks
Measures training throughput and efficiency
"""

import time
import json
from pathlib import Path
from typing import Dict, Any
import sys

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))


def benchmark_training_setup() -> Dict[str, Any]:
    """Benchmark training setup time (environment creation, etc.)"""
    from rl_studio.training.trainer import RLStudioEnv
    
    # Simple environment
    env_spec = {
        "id": "benchmark",
        "name": "Benchmark",
        "envType": "grid",
        "world": {"width": 10, "height": 10, "coordinateSystem": "grid", "cellSize": 1.0},
        "agents": [{"id": "a1", "position": [1, 1]}],
        "objects": [{"id": "g1", "type": "goal", "position": [8, 8]}],
        "actionSpace": {"type": "discrete", "actions": ["up", "down", "left", "right"]},
        "rules": {
            "rewards": [{"id": "r1", "condition": {"type": "agent_at_object", "objectId": "g1"}, "reward": 10}],
            "terminations": [{"id": "t1", "condition": {"type": "agent_at_object", "objectId": "g1"}}]
        }
    }
    
    # Measure environment creation time
    times = []
    for _ in range(10):
        start = time.time()
        env = RLStudioEnv(env_spec)
        elapsed = time.time() - start
        times.append(elapsed)
    
    avg_time = sum(times) / len(times)
    
    return {
        "env_creation_avg_ms": avg_time * 1000,
        "env_creation_min_ms": min(times) * 1000,
        "env_creation_max_ms": max(times) * 1000
    }


def run_training_benchmarks() -> Dict[str, Any]:
    """Run all training benchmarks"""
    print("🚀 Starting Training Performance Benchmarks")
    print("=" * 60)
    
    print("\n1. Environment Creation")
    setup_results = benchmark_training_setup()
    print(f"   Avg: {setup_results['env_creation_avg_ms']:.2f}ms")
    
    print("\n" + "=" * 60)
    print("✅ Training Benchmarks Complete!")
    
    return {
        "timestamp": time.time(),
        "setup": setup_results
    }


if __name__ == "__main__":
    results = run_training_benchmarks()
    
    # Save results
    output_file = Path(__file__).parent / "training_benchmark_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📊 Results saved to: {output_file}")

