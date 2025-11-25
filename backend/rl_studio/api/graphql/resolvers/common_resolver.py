"""
Common GraphQL resolvers (health, etc.)
"""

import strawberry
import json
from typing import Optional
from datetime import datetime

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
            services='{"rollout": "available", "job_orchestrator": "available"}'
        )

