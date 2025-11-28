"""
GitHub Extractor - Extract from GitHub repositories
Uses Firecrawl + code parsing
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional

from ..base import (BaseExtractor, ExtractionMetadata, ExtractionResult,
                    SourceType)
from .firecrawl_extractor import FirecrawlExtractor

logger = logging.getLogger(__name__)


class GitHubExtractor(BaseExtractor):
    """
    Extract environment specs from GitHub repositories
    Combines Firecrawl scraping with code parsing
    """

    def __init__(self):
        self.firecrawl_extractor = FirecrawlExtractor()

    @property
    def source_type(self) -> SourceType:
        return SourceType.GITHUB

    @property
    def name(self) -> str:
        return "GitHub Repository Extractor"

    def can_handle(self, input_data: Any) -> bool:
        """Check if input is a GitHub URL"""
        if isinstance(input_data, str):
            return "github.com" in input_data.lower()
        return False

    async def extract(self, input_data: str, **kwargs) -> ExtractionResult:
        """Extract from GitHub repo"""
        try:
            # Parse GitHub URL
            repo_info = self._parse_github_url(input_data)
            if not repo_info:
                return ExtractionResult(
                    success=False,
                    raw_data={},
                    normalized_data={},
                    metadata=self._create_metadata(
                        input_data, "github_parse", 0.0, ["Invalid GitHub URL"]
                    ),
                    error="Invalid GitHub URL",
                )

            # Use Firecrawl to scrape README
            readme_url = f"https://github.com/{repo_info['owner']}/{repo_info['repo']}/blob/main/README.md"
            firecrawl_result = await self.firecrawl_extractor.extract(readme_url)

            if not firecrawl_result.success:
                return firecrawl_result

            # Enhance with code parsing
            code_data = await self._parse_repo_code(repo_info)

            # Merge Firecrawl and code parsing results
            normalized = self._merge_results(
                firecrawl_result.normalized_data, code_data, repo_info
            )

            warnings = firecrawl_result.metadata.warnings + code_data.get(
                "warnings", []
            )
            confidence = min(1.0, firecrawl_result.metadata.confidence + 0.1)

            return ExtractionResult(
                success=True,
                raw_data={
                    "repo_info": repo_info,
                    "firecrawl_result": firecrawl_result.raw_data,
                    "code_parsing": code_data,
                },
                normalized_data=normalized,
                metadata=self._create_metadata(
                    input_data,
                    "github_firecrawl_code_parse",
                    confidence,
                    warnings,
                    f"Repo: {repo_info['owner']}/{repo_info['repo']}",
                ),
            )

        except Exception as e:
            logger.error(f"GitHub extraction failed: {e}", exc_info=True)
            return ExtractionResult(
                success=False,
                raw_data={},
                normalized_data={},
                metadata=self._create_metadata(
                    input_data, "github_error", 0.0, [f"Exception: {str(e)}"]
                ),
                error=str(e),
            )

    def _parse_github_url(self, url: str) -> Optional[Dict[str, str]]:
        """Parse GitHub URL to extract owner and repo"""
        match = re.match(r"https?://github\.com/([^/]+)/([^/]+)", url)
        if match:
            return {
                "owner": match.group(1),
                "repo": match.group(2).replace(".git", ""),
                "url": url,
            }
        return None

    async def _parse_repo_code(self, repo_info: Dict[str, str]) -> Dict[str, Any]:
        """Parse repository code for environment definitions"""
        # This would ideally fetch and parse Python files
        # For now, return structure hints
        return {
            "detected_classes": [],
            "detected_functions": [],
            "warnings": ["Code parsing not fully implemented - using README only"],
        }

    def _merge_results(
        self,
        firecrawl_data: Dict[str, Any],
        code_data: Dict[str, Any],
        repo_info: Dict[str, str],
    ) -> Dict[str, Any]:
        """Merge Firecrawl and code parsing results"""
        merged = firecrawl_data.copy()

        # Enhance with repo info
        merged["name"] = f"{repo_info['repo']} (GitHub)"
        merged["metadata"] = {
            "source": "github",
            "repo": f"{repo_info['owner']}/{repo_info['repo']}",
            "url": repo_info["url"],
        }

        return merged
