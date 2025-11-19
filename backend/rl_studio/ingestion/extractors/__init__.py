"""
Extractors package
"""

from .firecrawl_extractor import FirecrawlExtractor
from .json_extractor import JSONExtractor
from .github_extractor import GitHubExtractor
from .text_extractor import TextExtractor
from .template_extractor import TemplateExtractor

__all__ = [
    'FirecrawlExtractor',
    'JSONExtractor',
    'GitHubExtractor',
    'TextExtractor',
    'TemplateExtractor',
]

