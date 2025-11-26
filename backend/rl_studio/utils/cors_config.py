"""
CORS Configuration Module
Centralized CORS configuration with validation and environment-based settings
"""
import logging
import os
from typing import List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# Default origins for local development
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# Allowed HTTP methods for CORS
ALLOWED_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
]

# Allowed headers for CORS
ALLOWED_HEADERS = [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
    "X-CSRFToken",
]


def validate_origin(origin: str) -> bool:
    """
    Validate that an origin is properly formatted.

    Args:
        origin: Origin URL to validate

    Returns:
        True if valid, False otherwise
    """
    if not origin or not isinstance(origin, str):
        return False

    origin = origin.strip()
    if not origin:
        return False

    try:
        parsed = urlparse(origin)
        # Must have scheme and netloc
        if not parsed.scheme or not parsed.netloc:
            return False

        # Only allow http or https
        if parsed.scheme not in ("http", "https"):
            return False

        # Reject dangerous patterns
        if "javascript:" in origin.lower() or "<script" in origin.lower():
            return False

        return True
    except Exception:
        return False


def parse_cors_origins(origins_env: Optional[str] = None) -> List[str]:
    """
    Parse CORS origins from environment variable or return defaults.

    Args:
        origins_env: Comma-separated string of origins from environment

    Returns:
        List of validated origin URLs
    """
    if not origins_env:
        origins_env = os.getenv("CORS_ORIGINS", "")

    if not origins_env:
        logger.info("No CORS_ORIGINS set, using default development origins")
        return DEFAULT_ORIGINS.copy()

    # Split by comma and process each origin
    origins = []
    invalid_origins = []

    for origin in origins_env.split(","):
        origin = origin.strip()
        if not origin:
            continue

        if validate_origin(origin):
            origins.append(origin)
        else:
            invalid_origins.append(origin)
            logger.warning(f"Invalid CORS origin ignored: {origin}")

    if invalid_origins:
        logger.warning(
            f"Skipped {len(invalid_origins)} invalid CORS origin(s). "
            f"Valid origins: {origins}"
        )

    if not origins:
        logger.warning("No valid CORS origins found, falling back to defaults")
        return DEFAULT_ORIGINS.copy()

    logger.info(f"CORS allowed origins ({len(origins)}): {origins}")
    return origins


def get_cors_config() -> dict:
    """
    Get complete CORS configuration dictionary.

    Returns:
        Dictionary with CORS configuration for FastAPI CORSMiddleware
    """
    origins = parse_cors_origins()

    return {
        "allow_origins": origins,
        "allow_credentials": True,
        "allow_methods": ALLOWED_METHODS,
        "allow_headers": ALLOWED_HEADERS,
        "expose_headers": [],
        "max_age": 3600,  # Cache preflight requests for 1 hour
    }
