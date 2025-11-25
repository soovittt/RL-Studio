"""
Common GraphQL types
"""

import strawberry
from typing import Optional, List
from datetime import datetime


@strawberry.type
class Health:
    """Health check response"""
    status: str
    timestamp: str
    version: str
    services: Optional[str] = None  # JSON string for services


@strawberry.type
class Pagination:
    """Pagination information"""
    limit: int
    offset: int
    total: int
    has_more: bool


@strawberry.type
class Error:
    """Error information"""
    message: str
    code: Optional[str] = None
    field: Optional[str] = None


@strawberry.input
class PaginationInput:
    """Pagination input"""
    limit: int = 20
    offset: int = 0

