"""
API endpoints for verification features
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from ..verification.reward_verification import RewardRuleVerifier
from ..verification.safety_checker import SafetyChecker

router = APIRouter(prefix="/api/verification", tags=["verification"])


class VerifyRewardRulesRequest(BaseModel):
    env_spec: Dict[str, Any]


class CheckSafetyRequest(BaseModel):
    env_spec: Dict[str, Any]
    state: Optional[Dict[str, Any]] = None


@router.post("/rewards")
async def verify_reward_rules(request: VerifyRewardRulesRequest):
    """Verify reward rules for issues"""
    try:
        verifier = RewardRuleVerifier()
        result = verifier.verify(request.env_spec)
        return {"success": True, "verification": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/safety")
async def check_safety(request: CheckSafetyRequest):
    """Check environment and state for safety issues"""
    try:
        checker = SafetyChecker()
        result = checker.check(request.env_spec, request.state)
        return {"success": True, "safety": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

