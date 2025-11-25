"""
Simulation Performance Benchmarks
Measures steps/second for different environment configurations
"""

import time
import statistics
from typing import Dict, Any, List
import json
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from rl_studio.rollout.simulator import run_rollout
from rl_studio.rollout.parallel_simulator import run_parallel_rollouts, benchmark_rollout_performance


def create_simple_env(width: int = 10, height: int = 10) -> Dict[str, Any]:
    """Create a simple grid environment for benchmarking"""
    return {
        "id": "benchmark_env",
        "name": "Benchmark Environment",
        "envType": "grid",
        "world": {
            "width": width,
            "height": height,
            "coordinateSystem": "grid",
            "cellSize": 1.0
        },
        "agents": [{
            "id": "agent1",
            "position": [1, 1]
        }],
        "objects": [{
            "id": "goal1",
            "type": "goal",
            "position": [width - 2, height - 2]
        }],
        "actionSpace": {
            "type": "discrete",
            "actions": ["up", "down", "left", "right"]
        },
        "rules": {
            "rewards": [{
                "id": "goal_reward",
                "condition": {
                    "type": "agent_at_object",
                    "objectId": "goal1",
                    "tolerance": 0.5
                },
                "reward": 10.0
            }],
            "terminations": [{
                "id": "goal_termination",
                "condition": {
                    "type": "agent_at_object",
                    "objectId": "goal1",
                    "tolerance": 0.5
                }
            }]
        }
    }


def benchmark_single_rollout(env_spec: Dict[str, Any], num_runs: int = 10) -> Dict[str, Any]:
    """Benchmark single rollout performance"""
    times = []
    steps_counts = []
    
    for _ in range(num_runs):
        start = time.time()
        result = run_rollout(
            env_spec=env_spec,
            policy="random",
            max_steps=100
        )
        elapsed = time.time() - start
        
        times.append(elapsed)
        steps_counts.append(result.get("episodeLength", 0))
    
    total_steps = sum(steps_counts)
    total_time = sum(times)
    steps_per_second = total_steps / total_time if total_time > 0 else 0
    
    return {
        "num_runs": num_runs,
        "total_steps": total_steps,
        "total_time": total_time,
        "avg_time": statistics.mean(times),
        "std_time": statistics.stdev(times) if len(times) > 1 else 0,
        "steps_per_second": steps_per_second,
        "avg_episode_length": statistics.mean(steps_counts)
    }


def benchmark_parallel_rollouts(env_spec: Dict[str, Any], num_rollouts: int = 10) -> Dict[str, Any]:
    """Benchmark parallel rollout performance"""
    return benchmark_rollout_performance(
        env_spec=env_spec,
        num_rollouts=num_rollouts,
        max_steps=100
    )


def benchmark_different_sizes() -> List[Dict[str, Any]]:
    """Benchmark different environment sizes"""
    results = []
    
    sizes = [
        (5, 5),
        (10, 10),
        (20, 20),
        (50, 50),
    ]
    
    for width, height in sizes:
        print(f"Benchmarking {width}x{height} environment...")
        env_spec = create_simple_env(width, height)
        
        # Single rollout
        single_result = benchmark_single_rollout(env_spec, num_runs=10)
        
        # Parallel rollouts
        parallel_result = benchmark_parallel_rollouts(env_spec, num_rollouts=10)
        
        results.append({
            "size": f"{width}x{height}",
            "single_rollout": single_result,
            "parallel_rollouts": parallel_result,
            "speedup": parallel_result["steps_per_second"] / single_result["steps_per_second"] if single_result["steps_per_second"] > 0 else 0
        })
    
    return results


def run_all_benchmarks() -> Dict[str, Any]:
    """Run all benchmarks and return results"""
    print("🚀 Starting RL Studio Performance Benchmarks")
    print("=" * 60)
    
    # Simple environment benchmark
    print("\n1. Simple Environment (10x10)")
    simple_env = create_simple_env(10, 10)
    single_result = benchmark_single_rollout(simple_env, num_runs=20)
    parallel_result = benchmark_parallel_rollouts(simple_env, num_rollouts=20)
    
    print(f"   Single rollout: {single_result['steps_per_second']:.0f} steps/sec")
    print(f"   Parallel (20): {parallel_result['steps_per_second']:.0f} steps/sec")
    print(f"   Speedup: {parallel_result['steps_per_second'] / single_result['steps_per_second']:.1f}x")
    
    # Different sizes
    print("\n2. Different Environment Sizes")
    size_results = benchmark_different_sizes()
    
    for result in size_results:
        print(f"   {result['size']}:")
        print(f"     Single: {result['single_rollout']['steps_per_second']:.0f} steps/sec")
        print(f"     Parallel: {result['parallel_rollouts']['steps_per_second']:.0f} steps/sec")
        print(f"     Speedup: {result['speedup']:.1f}x")
    
    # Summary
    all_results = {
        "timestamp": time.time(),
        "simple_env": {
            "single": single_result,
            "parallel": parallel_result
        },
        "different_sizes": size_results
    }
    
    print("\n" + "=" * 60)
    print("✅ Benchmarks Complete!")
    
    return all_results


if __name__ == "__main__":
    results = run_all_benchmarks()
    
    # Save results
    output_file = Path(__file__).parent / "benchmark_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📊 Results saved to: {output_file}")

