"""
Security Utilities
Input sanitization, rate limiting, and security helpers
"""

import re
import html
from typing import Any, Dict, Optional
from functools import wraps
from time import time
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Simple in-memory rate limiter (for production, use Redis)
_rate_limit_store: Dict[str, list] = defaultdict(list)


def sanitize_string(input_str: Any, max_length: int = 1000) -> str:
    """
    Sanitize string input to prevent injection attacks.
    
    Args:
        input_str: Input to sanitize
        max_length: Maximum allowed length
    
    Returns:
        Sanitized string
    """
    if not isinstance(input_str, str):
        return str(input_str)[:max_length] if input_str else ""
    
    # Remove potentially dangerous characters
    sanitized = html.escape(input_str)
    
    # Remove javascript: protocol
    sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
    
    # Remove event handlers
    sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
    
    # Remove script tags
    sanitized = re.sub(r'<script[^>]*>.*?</script>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
    
    # Limit length
    sanitized = sanitized[:max_length]
    
    return sanitized.strip()


def sanitize_dict(data: Dict[str, Any], max_depth: int = 10) -> Dict[str, Any]:
    """
    Recursively sanitize dictionary values.
    
    Args:
        data: Dictionary to sanitize
        max_depth: Maximum recursion depth
    
    Returns:
        Sanitized dictionary
    """
    if max_depth <= 0:
        return {}
    
    sanitized = {}
    for key, value in data.items():
        # Sanitize key
        safe_key = sanitize_string(str(key), max_length=100)
        
        if isinstance(value, str):
            sanitized[safe_key] = sanitize_string(value)
        elif isinstance(value, dict):
            sanitized[safe_key] = sanitize_dict(value, max_depth - 1)
        elif isinstance(value, list):
            sanitized[safe_key] = [
                sanitize_string(item) if isinstance(item, str) else item
                for item in value[:100]  # Limit list size
            ]
        else:
            sanitized[safe_key] = value
    
    return sanitized


def rate_limit(max_requests: int = 60, window_seconds: int = 60):
    """
    Simple rate limiter decorator.
    
    Args:
        max_requests: Maximum requests per window
        window_seconds: Time window in seconds
    
    Usage:
        @rate_limit(max_requests=10, window_seconds=60)
        async def my_endpoint():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get client identifier (IP address or user ID)
            # In production, extract from request
            client_id = kwargs.get('client_id', 'default')
            
            now = time()
            window_start = now - window_seconds
            
            # Clean old entries
            _rate_limit_store[client_id] = [
                timestamp for timestamp in _rate_limit_store[client_id]
                if timestamp > window_start
            ]
            
            # Check rate limit
            if len(_rate_limit_store[client_id]) >= max_requests:
                logger.warning(f"Rate limit exceeded for {client_id}")
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds."
                )
            
            # Record request
            _rate_limit_store[client_id].append(now)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_json_size(data: Any, max_size_mb: float = 10.0) -> bool:
    """
    Validate JSON data size.
    
    Args:
        data: Data to validate
        max_size_mb: Maximum size in MB
    
    Returns:
        True if valid, False otherwise
    """
    import json
    try:
        json_str = json.dumps(data)
        size_mb = len(json_str.encode('utf-8')) / (1024 * 1024)
        return size_mb <= max_size_mb
    except Exception:
        return False


def validate_env_spec_structure(env_spec: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Validate environment spec structure for security.
    
    Args:
        env_spec: Environment specification
    
    Returns:
        (is_valid, error_message)
    """
    # Check for required fields
    if not isinstance(env_spec, dict):
        return False, "Environment spec must be a dictionary"
    
    # Check world bounds (prevent DoS with huge worlds)
    world = env_spec.get("world", {})
    width = world.get("width", 0)
    height = world.get("height", 0)
    
    if width > 1000 or height > 1000:
        return False, "World dimensions too large (max 1000x1000)"
    
    # Check number of objects (prevent DoS)
    objects = env_spec.get("objects", [])
    if len(objects) > 10000:
        return False, "Too many objects (max 10000)"
    
    # Check number of agents
    agents = env_spec.get("agents", [])
    if len(agents) > 100:
        return False, "Too many agents (max 100)"
    
    # Check action space size
    action_space = env_spec.get("actionSpace", {})
    if action_space.get("type") == "discrete":
        actions = action_space.get("actions", [])
        if len(actions) > 1000:
            return False, "Too many discrete actions (max 1000)"
    
    return True, None


def sanitize_env_spec(env_spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize environment specification.
    
    Args:
        env_spec: Environment specification
    
    Returns:
        Sanitized environment specification
    """
    # Deep copy to avoid modifying original
    import copy
    sanitized = copy.deepcopy(env_spec)
    
    # Sanitize string fields
    if "name" in sanitized:
        sanitized["name"] = sanitize_string(sanitized["name"], max_length=100)
    
    if "description" in sanitized:
        sanitized["description"] = sanitize_string(sanitized["description"], max_length=1000)
    
    # Validate and clamp numeric values
    world = sanitized.get("world", {})
    if "width" in world:
        world["width"] = max(1, min(1000, int(world.get("width", 10))))
    if "height" in world:
        world["height"] = max(1, min(1000, int(world.get("height", 10))))
    
    # Limit objects and agents
    if "objects" in sanitized:
        sanitized["objects"] = sanitized["objects"][:10000]
    
    if "agents" in sanitized:
        sanitized["agents"] = sanitized["agents"][:100]
    
    return sanitized

