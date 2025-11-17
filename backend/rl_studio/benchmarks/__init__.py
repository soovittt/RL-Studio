"""
Built-in Benchmark Tasks
Pre-built environments for RL research
"""

from .benchmark_tasks import BenchmarkRegistry, get_benchmark

__all__ = [
    'BenchmarkRegistry',
    'get_benchmark',
]

