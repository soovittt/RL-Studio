"""
Simple in-memory cache for assets and templates
Uses TTL-based expiration
"""
import logging
import time
from typing import Any, Optional, Dict
from threading import Lock

logger = logging.getLogger(__name__)

class TTLCache:
    """Thread-safe TTL cache"""
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._lock = Lock()
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        with self._lock:
            if key not in self._cache:
                return None
            
            value, expiry = self._cache[key]
            if time.time() > expiry:
                # Expired, remove it
                del self._cache[key]
                return None
            
            return value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        with self._lock:
            ttl = ttl or self.default_ttl
            expiry = time.time() + ttl
            self._cache[key] = (value, expiry)
    
    def invalidate(self, key: str) -> None:
        """Remove key from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    def invalidate_pattern(self, prefix: str) -> None:
        """Invalidate all cache entries that start with the given prefix"""
        with self._lock:
            keys_to_remove = [
                key for key in self._cache.keys()
                if key.startswith(prefix)
            ]
            for key in keys_to_remove:
                del self._cache[key]
            if keys_to_remove:
                logger.debug(f"Invalidated {len(keys_to_remove)} cache entries with prefix '{prefix}'")
    
    def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
    
    def cleanup_expired(self) -> None:
        """Remove expired entries"""
        with self._lock:
            now = time.time()
            expired_keys = [
                key for key, (_, expiry) in self._cache.items()
                if now > expiry
            ]
            for key in expired_keys:
                del self._cache[key]


# Global caches
asset_cache = TTLCache(default_ttl=300)  # 5 minutes
template_cache = TTLCache(default_ttl=600)  # 10 minutes

def get_cache_key(prefix: str, **kwargs) -> str:
    """Generate cache key from prefix and kwargs"""
    parts = [prefix]
    for key, value in sorted(kwargs.items()):
        if value is not None:
            parts.append(f"{key}:{value}")
    return "|".join(parts)

