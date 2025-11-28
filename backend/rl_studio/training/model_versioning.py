"""
Model Versioning and Checkpoint Management
"""

import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ModelVersionManager:
    """Manage model versions and checkpoints"""

    def __init__(self, base_dir: str = "models"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_checkpoint(
        self,
        model_path: str,
        run_id: str,
        checkpoint_name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Save a model checkpoint with versioning

        Returns:
            Path to saved checkpoint
        """
        run_dir = self.base_dir / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        checkpoint_dir = run_dir / checkpoint_name
        checkpoint_dir.mkdir(parents=True, exist_ok=True)

        # Copy model files
        if os.path.isdir(model_path):
            shutil.copytree(model_path, checkpoint_dir / "model", dirs_exist_ok=True)
        else:
            shutil.copy2(model_path, checkpoint_dir / "model")

        # Save metadata
        metadata_file = checkpoint_dir / "metadata.json"
        metadata_dict = {
            "run_id": run_id,
            "checkpoint_name": checkpoint_name,
            "created_at": datetime.now().isoformat(),
            "model_path": str(model_path),
            **(metadata or {}),
        }

        with open(metadata_file, "w") as f:
            json.dump(metadata_dict, f, indent=2)

        logger.info(f"✅ Saved checkpoint: {checkpoint_dir}")
        return str(checkpoint_dir)

    def list_checkpoints(self, run_id: str) -> List[Dict[str, Any]]:
        """List all checkpoints for a run"""
        run_dir = self.base_dir / run_id
        if not run_dir.exists():
            return []

        checkpoints = []
        for checkpoint_dir in run_dir.iterdir():
            if checkpoint_dir.is_dir():
                metadata_file = checkpoint_dir / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file, "r") as f:
                        metadata = json.load(f)
                    checkpoints.append(
                        {
                            "checkpoint_name": checkpoint_dir.name,
                            "path": str(checkpoint_dir),
                            **metadata,
                        }
                    )

        # Sort by creation time
        checkpoints.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return checkpoints

    def get_latest_checkpoint(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get the latest checkpoint for a run"""
        checkpoints = self.list_checkpoints(run_id)
        return checkpoints[0] if checkpoints else None

    def load_checkpoint(
        self, run_id: str, checkpoint_name: Optional[str] = None
    ) -> Optional[str]:
        """Load a checkpoint path"""
        if checkpoint_name:
            checkpoint_dir = self.base_dir / run_id / checkpoint_name
        else:
            # Get latest
            latest = self.get_latest_checkpoint(run_id)
            if not latest:
                return None
            checkpoint_dir = Path(latest["path"])

        model_path = checkpoint_dir / "model"
        if model_path.exists():
            return str(model_path)
        return None

    def delete_checkpoint(self, run_id: str, checkpoint_name: str) -> bool:
        """Delete a checkpoint"""
        checkpoint_dir = self.base_dir / run_id / checkpoint_name
        if checkpoint_dir.exists():
            shutil.rmtree(checkpoint_dir)
            logger.info(f"✅ Deleted checkpoint: {checkpoint_dir}")
            return True
        return False

    def create_version(
        self,
        run_id: str,
        checkpoint_name: str,
        version_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a versioned model from a checkpoint

        Returns:
            Version metadata
        """
        checkpoint = self.load_checkpoint(run_id, checkpoint_name)
        if not checkpoint:
            raise ValueError(f"Checkpoint not found: {run_id}/{checkpoint_name}")

        version_name = version_name or f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        version_dir = self.base_dir / run_id / "versions" / version_name
        version_dir.mkdir(parents=True, exist_ok=True)

        # Copy checkpoint to version
        shutil.copytree(
            Path(checkpoint).parent, version_dir / "model", dirs_exist_ok=True
        )

        # Create version metadata
        version_metadata = {
            "version_name": version_name,
            "run_id": run_id,
            "checkpoint_name": checkpoint_name,
            "created_at": datetime.now().isoformat(),
            "tags": tags or [],
            "description": description,
            "model_path": str(version_dir / "model"),
        }

        metadata_file = version_dir / "version.json"
        with open(metadata_file, "w") as f:
            json.dump(version_metadata, f, indent=2)

        logger.info(f"✅ Created version: {version_name}")
        return version_metadata

    def list_versions(self, run_id: str) -> List[Dict[str, Any]]:
        """List all versions for a run"""
        versions_dir = self.base_dir / run_id / "versions"
        if not versions_dir.exists():
            return []

        versions = []
        for version_dir in versions_dir.iterdir():
            if version_dir.is_dir():
                metadata_file = version_dir / "version.json"
                if metadata_file.exists():
                    with open(metadata_file, "r") as f:
                        metadata = json.load(f)
                    versions.append(metadata)

        versions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return versions
