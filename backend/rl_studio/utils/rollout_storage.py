"""
Rollout Storage Utility
Saves and loads rollout data to/from S3
Uses credentials from .env file, NOT default AWS profile
"""

import gzip
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

# Load .env file before importing other modules
try:
    from dotenv import load_dotenv
    
    env_paths = [
        Path(__file__).parent.parent.parent / ".env",  # backend/.env
        Path(__file__).parent.parent.parent.parent / ".env",  # root/.env
        Path(__file__).parent.parent.parent / "tokens" / "prod.txt",
        Path(__file__).parent.parent.parent / "tokens" / "dev.txt",
    ]
    
    for env_path in env_paths:
        if env_path.exists():
            load_dotenv(env_path, override=True)
            break
except ImportError:
    pass

from .infrastructure_config import get_infrastructure_config
from .storage import get_storage_client

logger = logging.getLogger(__name__)


def save_rollout_to_s3(
    rollout_data: Dict[str, Any], env_id: str, rollout_id: Optional[str] = None
) -> str:
    """
    Save rollout data to S3 with compression.

    Args:
        rollout_data: Full rollout data (SimulatorResult)
        env_id: Environment ID
        rollout_id: Optional rollout ID (generated if not provided)

    Returns:
        S3 URL (s3://bucket/key)
    """
    if not rollout_id:
        rollout_id = str(uuid.uuid4())

    config = get_infrastructure_config()
    storage_config = config.get_storage_config()
    provider = storage_config["provider"]

    if provider != "s3":
        raise ValueError(
            f"Rollout storage requires S3. Current provider: {provider}"
        )

    bucket_name = storage_config.get("bucket_name")
    if not bucket_name:
        raise ValueError(
            "S3_BUCKET_NAME or MODEL_BUCKET_NAME must be set in environment"
        )

    # Compress rollout data
    rollout_json = json.dumps(rollout_data, default=str)
    compressed_data = gzip.compress(rollout_json.encode("utf-8"))

    # S3 key: rollouts/{env_id}/{rollout_id}.json.gz
    s3_key = f"rollouts/{env_id}/{rollout_id}.json.gz"

    try:
        client, provider = get_storage_client()

        # Upload to S3
        if provider == "s3":
            # boto3.client is a function, not a type - check provider instead
            client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=compressed_data,
                ContentType="application/json",
                ContentEncoding="gzip",
                Metadata={
                    "env_id": env_id,
                    "rollout_id": rollout_id,
                    "episode_length": str(rollout_data.get("episodeLength", 0)),
                    "total_reward": str(rollout_data.get("totalReward", 0)),
                },
            )
            s3_url = f"s3://{bucket_name}/{s3_key}"
            logger.info(f"✅ Saved rollout to S3: {s3_url}")
            return s3_url
        else:
            raise ValueError(f"S3 client not properly initialized. Provider: {provider}")
    except Exception as e:
        logger.error(f"Failed to save rollout to S3: {e}")
        raise


def load_rollout_from_s3(s3_url: str) -> Dict[str, Any]:
    """
    Load rollout data from S3.

    Args:
        s3_url: S3 URL (s3://bucket/key)

    Returns:
        Full rollout data (SimulatorResult)
    """
    if not s3_url.startswith("s3://"):
        raise ValueError(f"Invalid S3 URL: {s3_url}")

    # Parse s3://bucket/key
    parts = s3_url.replace("s3://", "").split("/", 1)
    bucket_name = parts[0]
    s3_key = parts[1] if len(parts) > 1 else ""

    try:
        client, provider = get_storage_client()

        if provider == "s3":
            # Download from S3
            response = client.get_object(Bucket=bucket_name, Key=s3_key)
            compressed_data = response["Body"].read()

            # Decompress
            decompressed_data = gzip.decompress(compressed_data)
            rollout_data = json.loads(decompressed_data.decode("utf-8"))

            logger.info(f"✅ Loaded rollout from S3: {s3_url}")
            return rollout_data
        else:
            raise ValueError(f"S3 client not properly initialized. Provider: {provider}")
    except Exception as e:
        logger.error(f"Failed to load rollout from S3: {e}")
        raise


def delete_rollout_from_s3(s3_url: str) -> bool:
    """
    Delete rollout data from S3.

    Args:
        s3_url: S3 URL (s3://bucket/key)

    Returns:
        True if successful
    """
    if not s3_url.startswith("s3://"):
        raise ValueError(f"Invalid S3 URL: {s3_url}")

    # Parse s3://bucket/key
    parts = s3_url.replace("s3://", "").split("/", 1)
    bucket_name = parts[0]
    s3_key = parts[1] if len(parts) > 1 else ""

    try:
        client, provider = get_storage_client()

        if provider == "s3":
            client.delete_object(Bucket=bucket_name, Key=s3_key)
            logger.info(f"✅ Deleted rollout from S3: {s3_url}")
            return True
        else:
            raise ValueError(f"S3 client not properly initialized. Provider: {provider}")
    except Exception as e:
        logger.error(f"Failed to delete rollout from S3: {e}")
        return False


def get_rollout_size(s3_url: str) -> int:
    """
    Get size of rollout file in S3 (in bytes).

    Args:
        s3_url: S3 URL (s3://bucket/key)

    Returns:
        Size in bytes
    """
    if not s3_url.startswith("s3://"):
        raise ValueError(f"Invalid S3 URL: {s3_url}")

    # Parse s3://bucket/key
    parts = s3_url.replace("s3://", "").split("/", 1)
    bucket_name = parts[0]
    s3_key = parts[1] if len(parts) > 1 else ""

    try:
        client, provider = get_storage_client()

        if provider == "s3":
            response = client.head_object(Bucket=bucket_name, Key=s3_key)
            return response.get("ContentLength", 0)
        else:
            raise ValueError(f"S3 client not properly initialized. Provider: {provider}")
    except Exception as e:
        logger.error(f"Failed to get rollout size: {e}")
        return 0

