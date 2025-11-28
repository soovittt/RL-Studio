"""
Extractor Registry - Plugin system for extractors
"""

from typing import Any, Dict, List, Optional

from .base import BaseExtractor, SourceType


class ExtractorRegistry:
    """
    Central registry for all extractors
    Allows dynamic plugin system
    """

    _extractors: Dict[SourceType, BaseExtractor] = {}

    @classmethod
    def register(cls, extractor: BaseExtractor):
        """Register an extractor"""
        cls._extractors[extractor.source_type] = extractor

    @classmethod
    def get(cls, source_type: SourceType) -> Optional[BaseExtractor]:
        """Get extractor by source type"""
        return cls._extractors.get(source_type)

    @classmethod
    def get_all(cls) -> Dict[SourceType, BaseExtractor]:
        """Get all registered extractors"""
        return cls._extractors.copy()

    @classmethod
    def find_extractor(cls, input_data: Any) -> Optional[BaseExtractor]:
        """
        Find the best extractor for given input

        Args:
            input_data: Input to analyze

        Returns:
            Best matching extractor or None

        Note: Checks more specific extractors first (GitHub before Text)
        """
        # Priority order: more specific extractors first
        priority_order = [
            SourceType.GITHUB,  # Check GitHub URLs before generic text
            SourceType.FIRECRAWL,  # Check URLs before generic text
            SourceType.TEMPLATE,  # Check templates before generic
            SourceType.JSON,  # Check JSON before text
            SourceType.TEXT,  # Text is most generic, check last
        ]

        # First try priority order
        for source_type in priority_order:
            extractor = cls._extractors.get(source_type)
            if extractor and extractor.can_handle(input_data):
                return extractor

        # Fallback: check all extractors
        for extractor in cls._extractors.values():
            if extractor.can_handle(input_data):
                return extractor

        return None

    @classmethod
    def list_available(cls) -> List[str]:
        """List all available extractor names"""
        return [extractor.name for extractor in cls._extractors.values()]
