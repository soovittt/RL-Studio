"""
Infrastructure Configuration Helper
Makes it easy for open-source users to configure their own infrastructure.

Supports:
- AWS (S3, EC2, GPU instances)
- GCP (GCS, Compute Engine)
- Azure (Blob Storage, VMs)
- Local development (no cloud required)
"""

import os
import json
from typing import Dict, Any, Optional, Literal
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

StorageProvider = Literal["s3", "gcs", "azure", "local"]
ComputeProvider = Literal["aws", "gcp", "azure", "local"]


class InfrastructureConfig:
    """Centralized infrastructure configuration"""
    
    def __init__(self):
        self.storage_provider = self._get_storage_provider()
        self.compute_provider = self._get_compute_provider()
        self.config = self._load_config()
    
    def _get_storage_provider(self) -> StorageProvider:
        """Detect storage provider from environment"""
        provider = os.getenv("STORAGE_PROVIDER", "").lower()
        
        # Auto-detect from credentials
        if not provider:
            if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
                provider = "s3"
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                provider = "gcs"
            elif os.getenv("AZURE_STORAGE_CONNECTION_STRING"):
                provider = "azure"
            else:
                provider = "local"
        
        return provider  # type: ignore
    
    def _get_compute_provider(self) -> ComputeProvider:
        """Detect compute provider from environment"""
        provider = os.getenv("COMPUTE_PROVIDER", "").lower()
        
        # Auto-detect from credentials
        if not provider:
            if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
                provider = "aws"
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                provider = "gcp"
            elif os.getenv("AZURE_CLIENT_ID") and os.getenv("AZURE_CLIENT_SECRET"):
                provider = "azure"
            else:
                provider = "local"
        
        return provider  # type: ignore
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or environment"""
        config_file = Path(os.getenv("INFRA_CONFIG_FILE", "infra_config.json"))
        
        if config_file.exists():
            try:
                with open(config_file, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not load config file: {e}")
        
        return {}
    
    def get_storage_config(self) -> Dict[str, Any]:
        """Get storage configuration for current provider"""
        if self.storage_provider == "s3":
            return {
                "provider": "s3",
                "bucket_name": os.getenv("S3_BUCKET_NAME") or os.getenv("MODEL_BUCKET_NAME"),
                "region": os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
                "access_key_id": os.getenv("AWS_ACCESS_KEY_ID"),
                "secret_access_key": os.getenv("AWS_SECRET_ACCESS_KEY"),
                "endpoint_url": os.getenv("S3_ENDPOINT_URL"),  # For S3-compatible services
            }
        elif self.storage_provider == "gcs":
            return {
                "provider": "gcs",
                "bucket_name": os.getenv("GCS_BUCKET_NAME") or os.getenv("MODEL_BUCKET_NAME"),
                "credentials_path": os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
                "project_id": os.getenv("GCP_PROJECT_ID"),
            }
        elif self.storage_provider == "azure":
            return {
                "provider": "azure",
                "container_name": os.getenv("AZURE_CONTAINER_NAME") or os.getenv("MODEL_BUCKET_NAME"),
                "connection_string": os.getenv("AZURE_STORAGE_CONNECTION_STRING"),
                "account_name": os.getenv("AZURE_STORAGE_ACCOUNT_NAME"),
                "account_key": os.getenv("AZURE_STORAGE_ACCOUNT_KEY"),
            }
        else:  # local
            return {
                "provider": "local",
                "base_path": os.getenv("LOCAL_STORAGE_PATH", "/tmp/rl-studio-models"),
            }
    
    def get_compute_config(self) -> Dict[str, Any]:
        """Get compute configuration for current provider"""
        if self.compute_provider == "aws":
            return {
                "provider": "aws",
                "region": os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
                "access_key_id": os.getenv("AWS_ACCESS_KEY_ID"),
                "secret_access_key": os.getenv("AWS_SECRET_ACCESS_KEY"),
                "instance_type": os.getenv("AWS_INSTANCE_TYPE", "g4dn.xlarge"),
                "use_spot": os.getenv("AWS_USE_SPOT", "true").lower() == "true",
            }
        elif self.compute_provider == "gcp":
            return {
                "provider": "gcp",
                "project_id": os.getenv("GCP_PROJECT_ID"),
                "zone": os.getenv("GCP_ZONE", "us-central1-a"),
                "machine_type": os.getenv("GCP_MACHINE_TYPE", "n1-standard-4"),
                "credentials_path": os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
            }
        elif self.compute_provider == "azure":
            return {
                "provider": "azure",
                "subscription_id": os.getenv("AZURE_SUBSCRIPTION_ID"),
                "resource_group": os.getenv("AZURE_RESOURCE_GROUP"),
                "location": os.getenv("AZURE_LOCATION", "eastus"),
                "vm_size": os.getenv("AZURE_VM_SIZE", "Standard_NC6"),
            }
        else:  # local
            return {
                "provider": "local",
                "use_docker": os.getenv("USE_DOCKER", "false").lower() == "true",
            }
    
    def validate_storage_config(self) -> tuple[bool, Optional[str]]:
        """Validate storage configuration"""
        config = self.get_storage_config()
        
        if config["provider"] == "s3":
            if not config.get("bucket_name"):
                return False, "S3_BUCKET_NAME or MODEL_BUCKET_NAME must be set"
            if not config.get("access_key_id") or not config.get("secret_access_key"):
                return False, "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set"
        elif config["provider"] == "gcs":
            if not config.get("bucket_name"):
                return False, "GCS_BUCKET_NAME or MODEL_BUCKET_NAME must be set"
            if not config.get("credentials_path"):
                return False, "GOOGLE_APPLICATION_CREDENTIALS must be set"
        elif config["provider"] == "azure":
            if not config.get("container_name"):
                return False, "AZURE_CONTAINER_NAME or MODEL_BUCKET_NAME must be set"
            if not config.get("connection_string") and not (config.get("account_name") and config.get("account_key")):
                return False, "AZURE_STORAGE_CONNECTION_STRING or (AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY) must be set"
        
        return True, None
    
    def validate_compute_config(self) -> tuple[bool, Optional[str]]:
        """Validate compute configuration"""
        config = self.get_compute_config()
        
        if config["provider"] == "aws":
            if not config.get("access_key_id") or not config.get("secret_access_key"):
                return False, "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set"
        elif config["provider"] == "gcp":
            if not config.get("project_id"):
                return False, "GCP_PROJECT_ID must be set"
            if not config.get("credentials_path"):
                return False, "GOOGLE_APPLICATION_CREDENTIALS must be set"
        elif config["provider"] == "azure":
            if not config.get("subscription_id"):
                return False, "AZURE_SUBSCRIPTION_ID must be set"
            if not config.get("resource_group"):
                return False, "AZURE_RESOURCE_GROUP must be set"
        
        return True, None
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get human-readable configuration summary"""
        storage_config = self.get_storage_config()
        compute_config = self.get_compute_config()
        
        # Hide sensitive info
        safe_storage = {k: ("***" if "key" in k.lower() or "secret" in k.lower() else v) 
                       for k, v in storage_config.items()}
        safe_compute = {k: ("***" if "key" in k.lower() or "secret" in k.lower() else v) 
                       for k, v in compute_config.items()}
        
        return {
            "storage": {
                "provider": self.storage_provider,
                "config": safe_storage,
                "valid": self.validate_storage_config()[0],
            },
            "compute": {
                "provider": self.compute_provider,
                "config": safe_compute,
                "valid": self.validate_compute_config()[0],
            }
        }


def get_infrastructure_config() -> InfrastructureConfig:
    """Get singleton infrastructure config instance"""
    if not hasattr(get_infrastructure_config, "_instance"):
        get_infrastructure_config._instance = InfrastructureConfig()
    return get_infrastructure_config._instance

