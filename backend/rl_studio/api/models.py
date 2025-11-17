"""
Pydantic models for API requests/responses
"""
from typing import Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

class RolloutRequest(BaseModel):
    envSpec: Dict[str, Any] = Field(..., description="Environment specification")
    policy: Literal["random", "greedy"] = Field(default="random", description="Policy to use")
    maxSteps: int = Field(default=100, ge=1, le=10000, description="Maximum steps")
    stream: bool = Field(default=False, description="Stream results in real-time")

class RolloutResponse(BaseModel):
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    executionTime: float

class LaunchJobRequest(BaseModel):
    runId: str = Field(..., description="Training run ID")
    config: Dict[str, Any] = Field(..., description="Job configuration")

class LaunchJobResponse(BaseModel):
    success: bool
    jobId: Optional[str] = None
    error: Optional[str] = None

class JobStatusResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    jobId: Optional[str] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]

