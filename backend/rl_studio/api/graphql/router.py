"""
GraphQL Router for FastAPI
"""

from strawberry.fastapi import GraphQLRouter
from .schema import schema

# Create GraphQL router
# This will be available at /graphql endpoint
graphql_router = GraphQLRouter(schema, path="/graphql")

