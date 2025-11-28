"""
In-memory cache for generated code
Uses hash of env_spec + file_type + training_config + algorithm as key
"""
import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# In-memory cache: {cache_key: {"code": str, "file_name": str, "timestamp": datetime}}
_code_cache: Dict[str, Dict[str, Any]] = {}

# Cache TTL: 24 hours
CACHE_TTL = timedelta(hours=24)


def _compute_hash(
    env_spec: Dict[str, Any],
    file_type: str,
    training_config: Optional[Dict[str, Any]],
    algorithm: str,
) -> str:
    """Compute hash of all inputs to create unique cache key"""
    # Sort dicts to ensure consistent hashing
    cache_data = {
        "env_spec": json.dumps(env_spec, sort_keys=True),
        "file_type": file_type,
        "training_config": json.dumps(training_config or {}, sort_keys=True),
        "algorithm": algorithm,
    }

    cache_string = json.dumps(cache_data, sort_keys=True)
    return hashlib.sha256(cache_string.encode()).hexdigest()


def get_cached_code(
    env_spec: Dict[str, Any],
    file_type: str,
    training_config: Optional[Dict[str, Any]],
    algorithm: str,
) -> Optional[Dict[str, Any]]:
    """
    Get cached code if it exists and is still valid

    Returns:
        Dict with "code" and "file_name" if found, None otherwise
    """
    cache_key = _compute_hash(env_spec, file_type, training_config, algorithm)

    if cache_key in _code_cache:
        cached = _code_cache[cache_key]

        # Check if cache is still valid
        if datetime.now() - cached["timestamp"] < CACHE_TTL:
            logger.debug(f"Cache HIT for {file_type} (key: {cache_key[:8]}...)")
            return {"code": cached["code"], "file_name": cached["file_name"]}
        else:
            # Cache expired, remove it
            logger.debug(f"Cache EXPIRED for {file_type} (key: {cache_key[:8]}...)")
            del _code_cache[cache_key]

    logger.debug(f"Cache MISS for {file_type} (key: {cache_key[:8]}...)")
    return None


def set_cached_code(
    env_spec: Dict[str, Any],
    file_type: str,
    training_config: Optional[Dict[str, Any]],
    algorithm: str,
    code: str,
    file_name: str,
) -> None:
    """Store generated code in cache"""
    cache_key = _compute_hash(env_spec, file_type, training_config, algorithm)

    _code_cache[cache_key] = {
        "code": code,
        "file_name": file_name,
        "timestamp": datetime.now(),
    }

    logger.debug(
        f"Cached {file_type} (key: {cache_key[:8]}..., size: {len(code)} bytes)"
    )


def clear_cache() -> int:
    """Clear all cached code. Returns number of entries cleared."""
    count = len(_code_cache)
    _code_cache.clear()
    logger.info(f"Cleared {count} cache entries")
    return count


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    now = datetime.now()
    valid_entries = sum(
        1 for v in _code_cache.values() if now - v["timestamp"] < CACHE_TTL
    )
    expired_entries = len(_code_cache) - valid_entries

    return {
        "total_entries": len(_code_cache),
        "valid_entries": valid_entries,
        "expired_entries": expired_entries,
        "total_size_bytes": sum(len(v["code"]) for v in _code_cache.values()),
    }
