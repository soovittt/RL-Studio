"""
API endpoints for benchmark tasks
"""

from fastapi import APIRouter, HTTPException
from ..benchmarks.benchmark_tasks import BenchmarkRegistry

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


@router.get("/")
async def list_benchmarks():
    """List all available benchmarks"""
    try:
        benchmarks = BenchmarkRegistry.list_benchmarks()
        return {"success": True, "benchmarks": benchmarks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{benchmark_id}")
async def get_benchmark(benchmark_id: str):
    """Get a specific benchmark environment"""
    try:
        env_spec = BenchmarkRegistry.get_benchmark(benchmark_id)
        return {"success": True, "env_spec": env_spec}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

