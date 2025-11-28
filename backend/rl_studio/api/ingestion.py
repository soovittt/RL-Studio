"""
API endpoints for Dynamic Environment Ingestion
"""

import logging
from typing import Any, Dict, Optional, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..ingestion import (
    EnvSpecBuilder,
    ExtractorRegistry,
    SourceType,
    UnificationProcessor,
)
from ..ingestion.extractors.firecrawl_extractor import FirecrawlExtractor
from ..ingestion.extractors.github_extractor import GitHubExtractor
from ..ingestion.extractors.json_extractor import JSONExtractor
from ..ingestion.extractors.template_extractor import TemplateExtractor
from ..ingestion.extractors.text_extractor import TextExtractor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


# Register all extractors on module load
_extractors_registered = False


def _register_extractors():
    """Register all extractors"""
    global _extractors_registered
    if _extractors_registered:
        return

    ExtractorRegistry.register(FirecrawlExtractor())
    ExtractorRegistry.register(JSONExtractor())
    ExtractorRegistry.register(GitHubExtractor())
    ExtractorRegistry.register(TextExtractor())
    ExtractorRegistry.register(TemplateExtractor())

    _extractors_registered = True
    logger.info("✅ All extractors registered")


# Register on import
_register_extractors()


class IngestRequest(BaseModel):
    """Request to ingest environment from any source"""

    source_type: str  # "firecrawl", "json", "github", "text", "template"
    input_data: Union[str, Dict[str, Any]]  # URL, JSON, text, template name
    options: Optional[Dict[str, Any]] = None


class IngestResponse(BaseModel):
    """Response from ingestion"""

    success: bool
    env_spec: Optional[Dict[str, Any]] = None
    confidence: float = 0.0
    warnings: list[str] = []
    source_trace: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("/ingest", response_model=IngestResponse)
async def ingest_environment(request: IngestRequest):
    """
    Ingest environment from any source

    Supports:
    - firecrawl: URL to scrape
    - json: JSON object (EnvSpec or Gym config)
    - github: GitHub repository URL
    - text: Natural language description
    - template: Template name (gridworld, mujoco, maze)
    """
    try:
        # Get extractor
        try:
            source_type = SourceType(request.source_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid source_type: {request.source_type}. Valid: {[st.value for st in SourceType]}",
            )

        extractor = ExtractorRegistry.get(source_type)
        if not extractor:
            raise HTTPException(
                status_code=400, detail=f"Extractor for {source_type.value} not found"
            )

        # Check if extractor can handle input
        if not extractor.can_handle(request.input_data):
            raise HTTPException(
                status_code=400,
                detail=f"Extractor {extractor.name} cannot handle this input",
            )

        # Extract
        extraction_result = await extractor.extract(
            request.input_data, **(request.options or {})
        )

        if not extraction_result.success:
            return IngestResponse(
                success=False,
                error=extraction_result.error,
                warnings=extraction_result.metadata.warnings,
            )

        # Unify
        unifier = UnificationProcessor()
        unification_result = unifier.unify(extraction_result)

        if not unification_result.success:
            return IngestResponse(
                success=False,
                error=unification_result.error,
                warnings=unification_result.warnings,
            )

        # Build EnvSpec
        builder = EnvSpecBuilder()
        build_result = builder.build(unification_result)

        if not build_result.success:
            return IngestResponse(
                success=False,
                error=f"EnvSpec validation failed: {', '.join(build_result.validation_errors)}",
                warnings=build_result.warnings,
            )

        return IngestResponse(
            success=True,
            env_spec=build_result.env_spec,
            confidence=unification_result.confidence,
            warnings=build_result.warnings,
            source_trace=unification_result.source_trace,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/extractors")
async def list_extractors():
    """List all available extractors"""
    extractors = ExtractorRegistry.get_all()
    return {
        "extractors": [
            {
                "source_type": st.value,
                "name": extractor.name,
            }
            for st, extractor in extractors.items()
        ]
    }


@router.get("/templates")
async def list_templates():
    """List all available templates"""
    template_extractor = ExtractorRegistry.get(SourceType.TEMPLATE)
    if template_extractor and isinstance(template_extractor, TemplateExtractor):
        return {"templates": template_extractor.list_templates()}
    return {"templates": []}


@router.post("/auto-detect")
async def auto_detect_source(input_data: Union[str, Dict[str, Any]]):
    """
    Auto-detect which extractor can handle the input
    """
    extractor = ExtractorRegistry.find_extractor(input_data)
    if extractor:
        return {
            "detected": True,
            "source_type": extractor.source_type.value,
            "extractor_name": extractor.name,
        }
    return {"detected": False, "message": "No extractor can handle this input"}
