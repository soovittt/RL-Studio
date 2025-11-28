"""
High-Performance Caching System
Aggressive caching for maximum performance.

Features:
- LRU cache for compiled environments
- TTL cache for analysis results
- In-memory cache for assets
- Model loading cache
"""

import hashlib
import json
import logging
import time
from collections import OrderedDict
from functools import lru_cache, wraps
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class TTLCache:
    """Time-To-Live cache with automatic expiration"""

    def __init__(self, maxsize: int = 128, ttl: float = 300.0):
        self.maxsize = maxsize
        self.ttl = ttl
        self.cache: Dict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        if key not in self.cache:
            return None

        timestamp, value = self.cache[key]
        if time.time() - timestamp > self.ttl:
            # Expired
            del self.cache[key]
            return None

        # Move to end (most recently used)
        self.cache.move_to_end(key)
        return value

    def set(self, key: str, value: Any) -> None:
        """Set value in cache"""
        if len(self.cache) >= self.maxsize:
            # Remove oldest
            self.cache.popitem(last=False)

        self.cache[key] = (time.time(), value)

    def clear(self) -> None:
        """Clear all cached values"""
        self.cache.clear()

    def invalidate(self, key: str) -> None:
        """Remove specific key from cache"""
        if key in self.cache:
            del self.cache[key]


class PerformanceCache:
    """High-performance caching system for RL Studio"""

    def __init__(self):
        # Compiled environments (long-lived)
        self.environment_cache: Dict[str, Any] = {}

        # Analysis results (TTL)
        self.analysis_cache = TTLCache(maxsize=256, ttl=600.0)  # 10 min

        # Asset loading (long-lived)
        self.asset_cache: Dict[str, Any] = {}

        # Model loading (TTL - models can be updated)
        self.model_cache = TTLCache(maxsize=32, ttl=3600.0)  # 1 hour

        # Rollout results (short TTL)
        self.rollout_cache = TTLCache(maxsize=128, ttl=60.0)  # 1 min

    def get_environment(self, env_spec_hash: str) -> Optional[Any]:
        """Get compiled environment from cache"""
        return self.environment_cache.get(env_spec_hash)

    def set_environment(self, env_spec_hash: str, compiled_env: Any) -> None:
        """Cache compiled environment"""
        self.environment_cache[env_spec_hash] = compiled_env

    def get_analysis(self, analysis_key: str) -> Optional[Any]:
        """Get analysis result from cache"""
        return self.analysis_cache.get(analysis_key)

    def set_analysis(self, analysis_key: str, result: Any) -> None:
        """Cache analysis result"""
        self.analysis_cache.set(analysis_key, result)

    def get_asset(self, asset_id: str) -> Optional[Any]:
        """Get asset from cache"""
        return self.asset_cache.get(asset_id)

    def set_asset(self, asset_id: str, asset: Any) -> None:
        """Cache asset"""
        self.asset_cache[asset_id] = asset

    def get_model(self, model_key: str) -> Optional[Any]:
        """Get model from cache"""
        return self.model_cache.get(model_key)

    def set_model(self, model_key: str, model: Any) -> None:
        """Cache model"""
        self.model_cache.set(model_key, model)

    def get_rollout(self, rollout_key: str) -> Optional[Any]:
        """Get rollout result from cache"""
        return self.rollout_cache.get(rollout_key)

    def set_rollout(self, rollout_key: str, result: Any) -> None:
        """Cache rollout result"""
        self.rollout_cache.set(rollout_key, result)

    def invalidate_environment(self, env_spec_hash: str) -> None:
        """Invalidate environment cache"""
        if env_spec_hash in self.environment_cache:
            del self.environment_cache[env_spec_hash]

    def invalidate_asset(self, asset_id: str) -> None:
        """Invalidate asset cache"""
        if asset_id in self.asset_cache:
            del self.asset_cache[asset_id]

    def clear_all(self) -> None:
        """Clear all caches"""
        self.environment_cache.clear()
        self.analysis_cache.clear()
        self.asset_cache.clear()
        self.model_cache.clear()
        self.rollout_cache.clear()


# Global cache instance
_performance_cache: Optional[PerformanceCache] = None


def get_performance_cache() -> PerformanceCache:
    """Get global performance cache instance"""
    global _performance_cache
    if _performance_cache is None:
        _performance_cache = PerformanceCache()
    return _performance_cache


def hash_env_spec(env_spec: Dict[str, Any]) -> str:
    """Create hash of environment spec for caching"""
    # Sort keys for consistent hashing
    spec_str = json.dumps(env_spec, sort_keys=True)
    return hashlib.sha256(spec_str.encode()).hexdigest()[:16]


def cached_rollout(maxsize: int = 128, ttl: float = 60.0):
    """Decorator to cache rollout results"""
    cache = TTLCache(maxsize=maxsize, ttl=ttl)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Create cache key from args
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Check cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_result

            # Compute result
            result = func(*args, **kwargs)

            # Cache result
            cache.set(cache_key, result)

            return result

        return wrapper

    return decorator


def cached_analysis(ttl: float = 600.0):
    """Decorator to cache analysis results"""
    cache = get_performance_cache().analysis_cache

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Create cache key
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Check cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Analysis cache hit for {func.__name__}")
                return cached_result

            # Compute result
            result = func(*args, **kwargs)

            # Cache result
            cache.set(cache_key, result)

            return result

        return wrapper

    return decorator
