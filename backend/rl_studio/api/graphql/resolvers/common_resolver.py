"""
Common GraphQL resolvers (health, etc.)
"""

import json
from datetime import datetime
from typing import Optional

import strawberry

from ..types.common import Health


@strawberry.type
class CommonResolver:
    """Common queries"""

    @strawberry.field
    async def health(self) -> Health:
        """Health check endpoint"""
        return Health(
            status="healthy",
            timestamp=datetime.utcnow().isoformat(),
            version="1.0.0",
            services='{"rollout": "available", "job_orchestrator": "available"}',
        )
