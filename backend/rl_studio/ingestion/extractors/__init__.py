"""
Extractors package
"""

from .firecrawl_extractor import FirecrawlExtractor
from .github_extractor import GitHubExtractor
from .json_extractor import JSONExtractor
from .template_extractor import TemplateExtractor
from .text_extractor import TextExtractor

__all__ = [
    "FirecrawlExtractor",
    "JSONExtractor",
    "GitHubExtractor",
    "TextExtractor",
    "TemplateExtractor",
]
