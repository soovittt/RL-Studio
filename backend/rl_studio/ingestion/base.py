"""
Base extractor interface and types
All extractors must implement this interface
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum


class SourceType(str, Enum):
    """Supported source types"""
    FIRECRAWL = "firecrawl"
    JSON = "json"
    GITHUB = "github"
    TEXT = "text"
    TEMPLATE = "template"


@dataclass
class ExtractionMetadata:
    """Metadata about the extraction process"""
    source_type: SourceType
    source_identifier: str  # URL, file path, text, etc.
    extraction_method: str
    confidence: float  # 0.0 to 1.0
    warnings: List[str]
    raw_data_preview: Optional[str] = None
    extraction_timestamp: Optional[float] = None


@dataclass
class ExtractionResult:
    """Result from an extractor"""
    success: bool
    raw_data: Dict[str, Any]  # Raw extracted data (varies by source)
    normalized_data: Dict[str, Any]  # Partially normalized structure
    metadata: ExtractionMetadata
    error: Optional[str] = None


class BaseExtractor(ABC):
    """
    Base class for all extractors
    
    Each extractor:
    1. Takes raw input (URL, JSON, text, etc.)
    2. Extracts relevant RL environment information
    3. Returns partially normalized data structure
    4. Provides metadata about extraction quality
    """
    
    @property
    @abstractmethod
    def source_type(self) -> SourceType:
        """The type of source this extractor handles"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this extractor"""
        pass
    
    @abstractmethod
    async def extract(self, input_data: Any, **kwargs) -> ExtractionResult:
        """
        Extract environment data from input
        
        Args:
            input_data: Raw input (URL string, JSON dict, text, etc.)
            **kwargs: Additional extractor-specific options
        
        Returns:
            ExtractionResult with raw_data and normalized_data
        """
        pass
    
    @abstractmethod
    def can_handle(self, input_data: Any) -> bool:
        """
        Check if this extractor can handle the given input
        
        Args:
            input_data: Input to check
        
        Returns:
            True if this extractor can process the input
        """
        pass
    
    def _create_metadata(
        self,
        source_identifier: str,
        extraction_method: str,
        confidence: float,
        warnings: Optional[List[str]] = None,
        raw_data_preview: Optional[str] = None
    ) -> ExtractionMetadata:
        """Helper to create extraction metadata"""
        import time
        return ExtractionMetadata(
            source_type=self.source_type,
            source_identifier=source_identifier,
            extraction_method=extraction_method,
            confidence=confidence,
            warnings=warnings or [],
            raw_data_preview=raw_data_preview,
            extraction_timestamp=time.time()
        )

