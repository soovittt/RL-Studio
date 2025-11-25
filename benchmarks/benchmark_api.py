"""
API Performance Benchmarks
Measures response times for API endpoints
"""

import time
import statistics
import requests
from typing import Dict, Any, List
import json
from pathlib import Path


def benchmark_endpoint(
    base_url: str,
    endpoint: str,
    method: str = "GET",
    data: Dict[str, Any] = None,
    num_requests: int = 10
) -> Dict[str, Any]:
    """Benchmark a single API endpoint"""
    url = f"{base_url}{endpoint}"
    times = []
    errors = 0
    
    for _ in range(num_requests):
        start = time.time()
        try:
            if method == "GET":
                response = requests.get(url, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            elapsed = time.time() - start
            times.append(elapsed)
            
            if response.status_code >= 400:
                errors += 1
        except Exception as e:
            errors += 1
            print(f"Error: {e}")
    
    if not times:
        return {
            "endpoint": endpoint,
            "method": method,
            "errors": errors,
            "success": False
        }
    
    return {
        "endpoint": endpoint,
        "method": method,
        "num_requests": num_requests,
        "errors": errors,
        "success_rate": (num_requests - errors) / num_requests,
        "avg_time_ms": statistics.mean(times) * 1000,
        "min_time_ms": min(times) * 1000,
        "max_time_ms": max(times) * 1000,
        "p50_ms": statistics.median(times) * 1000,
        "p95_ms": sorted(times)[int(len(times) * 0.95)] * 1000 if len(times) > 1 else times[0] * 1000,
        "p99_ms": sorted(times)[int(len(times) * 0.99)] * 1000 if len(times) > 1 else times[0] * 1000,
        "success": True
    }


def run_api_benchmarks(base_url: str = "http://localhost:8000") -> Dict[str, Any]:
    """Run all API benchmarks"""
    print("🚀 Starting API Performance Benchmarks")
    print(f"Base URL: {base_url}")
    print("=" * 60)
    
    results = []
    
    # Health check
    print("\n1. Health Check")
    health_result = benchmark_endpoint(base_url, "/health", "GET", num_requests=20)
    results.append(health_result)
    if health_result["success"]:
        print(f"   Avg: {health_result['avg_time_ms']:.2f}ms")
        print(f"   P95: {health_result['p95_ms']:.2f}ms")
    
    # Simple rollout
    print("\n2. Simple Rollout")
    simple_env = {
        "id": "test",
        "name": "Test",
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
    
    rollout_result = benchmark_endpoint(
        base_url,
        "/api/rollout",
        "POST",
        data={
            "envSpec": simple_env,
            "policy": "random",
            "maxSteps": 50
        },
        num_requests=10
    )
    results.append(rollout_result)
    if rollout_result["success"]:
        print(f"   Avg: {rollout_result['avg_time_ms']:.2f}ms")
        print(f"   P95: {rollout_result['p95_ms']:.2f}ms")
    
    # Batch rollout
    print("\n3. Batch Rollout (10 parallel)")
    batch_result = benchmark_endpoint(
        base_url,
        "/api/rollout",
        "POST",
        data={
            "envSpec": simple_env,
            "policy": "random",
            "maxSteps": 50,
            "batchSize": 10,
            "useParallel": True
        },
        num_requests=5
    )
    results.append(batch_result)
    if batch_result["success"]:
        print(f"   Avg: {batch_result['avg_time_ms']:.2f}ms")
        print(f"   P95: {batch_result['p95_ms']:.2f}ms")
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ API Benchmarks Complete!")
    
    return {
        "timestamp": time.time(),
        "base_url": base_url,
        "results": results
    }


if __name__ == "__main__":
    import sys
    
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    results = run_api_benchmarks(base_url)
    
    # Save results
    output_file = Path(__file__).parent / "api_benchmark_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📊 Results saved to: {output_file}")

