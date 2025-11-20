"""
Dynamic Environment Ingestion Layer
Universal ingestion + translation system for RL environments

Supports multiple input sources:
- Firecrawl (web/paper/code extraction)
- JSON uploads (EnvSpec or Gym configs)
- GitHub repos (via Firecrawl + code parsing)
- Text descriptions (LLM parsing)
- Environment templates (GridWorld, Mujoco, etc.)

All sources feed into a unified EnvSpec pipeline.
"""

from .base import BaseExtractor, ExtractionResult, ExtractionMetadata, SourceType
from .unifier import UnificationProcessor, UnificationResult
from .builder import EnvSpecBuilder, BuildResult
from .registry import ExtractorRegistry

__all__ = [
    'BaseExtractor',
    'ExtractionResult',
    'ExtractionMetadata',
    'SourceType',
    'UnificationProcessor',
    'UnificationResult',
    'EnvSpecBuilder',
    'BuildResult',
    'ExtractorRegistry',
]

