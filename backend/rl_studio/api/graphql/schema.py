"""
GraphQL Schema Definition
Combines all types and resolvers into a single schema
"""

import strawberry
from .resolvers.common_resolver import CommonResolver
from .resolvers.asset_resolver import AssetResolver
from .resolvers.scene_resolver import SceneResolver
from .resolvers.training_resolver import TrainingResolver
from .resolvers.rollout_resolver import RolloutResolver
from .resolvers.research_resolver import ResearchResolver


# Merge all resolvers into root types using multiple inheritance
@strawberry.type
class Query(CommonResolver, AssetResolver, SceneResolver, TrainingResolver, ResearchResolver):
    """Root query type - combines all query resolvers"""
    pass


@strawberry.type
class Mutation(AssetResolver, SceneResolver, TrainingResolver, RolloutResolver, ResearchResolver):
    """Root mutation type - combines all mutation resolvers"""
    pass


# Create the schema
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation
)

