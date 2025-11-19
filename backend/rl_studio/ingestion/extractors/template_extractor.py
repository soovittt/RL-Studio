"""
Template Extractor - Prebuilt environment templates
"""

import logging
from typing import Dict, Any

from ..base import BaseExtractor, SourceType, ExtractionResult, ExtractionMetadata

logger = logging.getLogger(__name__)


class TemplateExtractor(BaseExtractor):
    """
    Extract from prebuilt environment templates
    (GridWorld, Mujoco, Atari, etc.)
    """
    
    TEMPLATES = {
        "gridworld": {
            "envType": "grid",
            "name": "GridWorld",
            "world": {"coordinateSystem": "grid", "width": 10, "height": 10, "physics": {"enabled": False}},
            "agents": [{"id": "agent_0", "name": "Agent", "position": [0, 0]}],
            "actionSpace": {"type": "discrete", "actions": ["up", "down", "left", "right"]},
            "objects": [],
            "rules": {
                "rewards": [{"condition": "timeout", "value": -0.01}],
                "terminations": [{"condition": "timeout", "steps": 100}],
                "events": []
            },
        },
        "mujoco": {
            "envType": "continuous2d",
            "name": "Mujoco Environment",
            "world": {"coordinateSystem": "cartesian", "width": 20, "height": 20, "physics": {"enabled": True}},
            "agents": [{"id": "agent_0", "name": "Agent", "position": [0, 0]}],
            "actionSpace": {"type": "continuous", "dimensions": 2, "range": [-1, 1]},
            "objects": [],
            "rules": {
                "rewards": [],
                "terminations": [{"condition": "timeout", "steps": 1000}],
                "events": []
            },
        },
        "maze": {
            "envType": "grid",
            "name": "Maze",
            "world": {"coordinateSystem": "grid", "width": 15, "height": 15, "physics": {"enabled": False}},
            "agents": [{"id": "agent_0", "name": "Agent", "position": [0, 0]}],
            "actionSpace": {"type": "discrete", "actions": ["up", "down", "left", "right"]},
            "objects": [{"id": "goal_0", "type": "goal", "position": [14, 14]}],
            "rules": {
                "rewards": [
                    {"condition": "agent_at_object", "value": 10},
                    {"condition": "timeout", "value": -0.01}
                ],
                "terminations": [{"condition": "timeout", "steps": 200}],
                "events": []
            },
        },
    }
    
    @property
    def source_type(self) -> SourceType:
        return SourceType.TEMPLATE
    
    @property
    def name(self) -> str:
        return "Template Extractor"
    
    def can_handle(self, input_data: Any) -> bool:
        """Check if input is a template name"""
        if isinstance(input_data, str):
            return input_data.lower() in self.TEMPLATES
        return False
    
    async def extract(self, input_data: str, **kwargs) -> ExtractionResult:
        """Extract from template"""
        try:
            template_name = input_data.lower()
            if template_name not in self.TEMPLATES:
                return ExtractionResult(
                    success=False,
                    raw_data={},
                    normalized_data={},
                    metadata=self._create_metadata(
                        input_data, "template_lookup", 0.0,
                        [f"Template '{input_data}' not found"]
                    ),
                    error=f"Template '{input_data}' not found. Available: {list(self.TEMPLATES.keys())}"
                )
            
            template = self.TEMPLATES[template_name].copy()
            
            # Apply any customizations from kwargs
            if "customizations" in kwargs:
                template.update(kwargs["customizations"])
            
            return ExtractionResult(
                success=True,
                raw_data={"template_name": template_name},
                normalized_data=template,
                metadata=self._create_metadata(
                    input_data,
                    "template_copy",
                    1.0,  # Templates are 100% confident
                    []
                )
            )
            
        except Exception as e:
            logger.error(f"Template extraction failed: {e}", exc_info=True)
            return ExtractionResult(
                success=False,
                raw_data={},
                normalized_data={},
                metadata=self._create_metadata(
                    input_data, "template_error", 0.0,
                    [f"Exception: {str(e)}"]
                ),
                error=str(e)
            )
    
    @classmethod
    def list_templates(cls) -> list[str]:
        """List all available templates"""
        return list(cls.TEMPLATES.keys())

