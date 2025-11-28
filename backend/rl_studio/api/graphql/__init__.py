"""
GraphQL API for RL Studio
Provides type-safe, efficient GraphQL endpoints alongside REST APIs
"""

from .router import graphql_router
from .schema import schema

__all__ = ["schema", "graphql_router"]
