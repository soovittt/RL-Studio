"""
High-Performance Parallel Rollout Simulator
Optimized for batch processing and maximum throughput.

Target: 1M+ steps/second for simple environments
"""

import numpy as np
from typing import Dict, Any, List, Optional, Callable, Literal
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import multiprocessing as mp
from functools import partial
import logging

from .simulator import (
    run_rollout,
    validate_env_spec,
    create_initial_state,
    step_simulator,
    select_action
)

logger = logging.getLogger(__name__)


def _run_single_rollout_worker(args: tuple) -> Dict[str, Any]:
    """
    Worker function for parallel rollout execution.
    Must be at module level for multiprocessing.
    """
    env_spec, policy, max_steps = args
    try:
        result = run_rollout(
            env_spec=env_spec,
            policy=policy,
            max_steps=max_steps
        )
        return result
    except Exception as e:
        logger.error(f"Rollout worker failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "steps": [],
            "totalReward": 0.0,
            "episodeLength": 0
        }


def run_parallel_rollouts(
    env_spec: Dict[str, Any],
    policy: Literal["random", "greedy"] = "random",
    max_steps: int = 100,
    num_rollouts: int = 10,
    num_workers: Optional[int] = None,
    use_threads: bool = False
) -> List[Dict[str, Any]]:
    """
    Run multiple rollouts in parallel for high throughput.
    
    Args:
        env_spec: Environment specification
        policy: Policy to use
        max_steps: Maximum steps per rollout
        num_rollouts: Number of rollouts to run
        num_workers: Number of parallel workers (default: CPU count)
        use_threads: Use threads instead of processes (for I/O-bound)
    
    Returns:
        List of rollout results
    """
    # Validate environment once
    is_valid, error_msg = validate_env_spec(env_spec)
    if not is_valid:
        logger.error(f"Invalid environment: {error_msg}")
        return [{
            "success": False,
            "error": f"Invalid environment: {error_msg}",
            "steps": [],
            "totalReward": 0.0,
            "episodeLength": 0
        }] * num_rollouts
    
    # Determine number of workers
    if num_workers is None:
        num_workers = min(mp.cpu_count(), num_rollouts)
    
    # Prepare arguments for workers
    args_list = [(env_spec, policy, max_steps) for _ in range(num_rollouts)]
    
    # Choose executor based on workload
    if use_threads:
        executor = ThreadPoolExecutor(max_workers=num_workers)
    else:
        executor = ProcessPoolExecutor(max_workers=num_workers)
    
    results = []
    try:
        # Submit all rollouts
        futures = [executor.submit(_run_single_rollout_worker, args) for args in args_list]
        
        # Collect results as they complete
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to get rollout result: {e}")
                results.append({
                    "success": False,
                    "error": str(e),
                    "steps": [],
                    "totalReward": 0.0,
                    "episodeLength": 0
                })
    finally:
        executor.shutdown(wait=True)
    
    return results


def run_vectorized_batch(
    env_spec: Dict[str, Any],
    policy: Literal["random", "greedy"] = "random",
    max_steps: int = 100,
    batch_size: int = 32
) -> Dict[str, Any]:
    """
    Run batch of rollouts with vectorized operations where possible.
    
    For environments with simple state spaces, we can vectorize:
    - Position updates
    - Reward calculations
    - Collision detection
    
    Args:
        env_spec: Environment specification
        policy: Policy to use
        max_steps: Maximum steps per rollout
        batch_size: Number of parallel environments
    
    Returns:
        Aggregated batch results
    """
    # For now, use parallel rollouts
    # Future: Implement true vectorization with NumPy/JAX
    results = run_parallel_rollouts(
        env_spec=env_spec,
        policy=policy,
        max_steps=max_steps,
        num_rollouts=batch_size,
        num_workers=min(batch_size, mp.cpu_count())
    )
    
    # Aggregate results using NumPy for speed
    rewards = np.array([r.get("totalReward", 0.0) for r in results])
    lengths = np.array([r.get("episodeLength", 0) for r in results])
    successes = np.array([r.get("success", False) for r in results], dtype=bool)
    
    return {
        "results": results,
        "statistics": {
            "mean_reward": float(np.mean(rewards)),
            "std_reward": float(np.std(rewards)),
            "mean_length": float(np.mean(lengths)),
            "std_length": float(np.std(lengths)),
            "success_rate": float(np.mean(successes)),
            "num_rollouts": len(results)
        }
    }


def benchmark_rollout_performance(
    env_spec: Dict[str, Any],
    num_rollouts: int = 100,
    max_steps: int = 100
) -> Dict[str, Any]:
    """
    Benchmark rollout performance.
    
    Returns:
        Performance metrics (steps/second, etc.)
    """
    import time
    
    start_time = time.time()
    results = run_parallel_rollouts(
        env_spec=env_spec,
        policy="random",
        max_steps=max_steps,
        num_rollouts=num_rollouts
    )
    end_time = time.time()
    
    total_steps = sum(r.get("episodeLength", 0) for r in results)
    elapsed_time = end_time - start_time
    steps_per_second = total_steps / elapsed_time if elapsed_time > 0 else 0
    
    return {
        "total_rollouts": num_rollouts,
        "total_steps": total_steps,
        "elapsed_time": elapsed_time,
        "steps_per_second": steps_per_second,
        "rollouts_per_second": num_rollouts / elapsed_time if elapsed_time > 0 else 0,
        "avg_episode_length": total_steps / num_rollouts if num_rollouts > 0 else 0
    }

