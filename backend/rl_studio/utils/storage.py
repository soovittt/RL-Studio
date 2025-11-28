"""
Cloud storage utility for saving and loading trained models.
Supports AWS S3, Google Cloud Storage, Azure Blob Storage, and local storage.

Easy configuration via environment variables - perfect for open-source setup.
"""

import logging
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Optional, Union

from .infrastructure_config import get_infrastructure_config

logger = logging.getLogger(__name__)


def get_storage_client():
    """Get cloud storage client based on infrastructure configuration."""
    config = get_infrastructure_config()
    storage_config = config.get_storage_config()
    provider = storage_config["provider"]

    if provider == "s3":
        try:
            import boto3

            client = boto3.client(
                "s3",
                aws_access_key_id=storage_config.get("access_key_id"),
                aws_secret_access_key=storage_config.get("secret_access_key"),
                region_name=storage_config.get("region", "us-east-1"),
                endpoint_url=storage_config.get(
                    "endpoint_url"
                ),  # For S3-compatible services
            )
            logger.info(
                f"✅ Initialized S3 client (bucket: {storage_config.get('bucket_name')})"
            )
            return client, "s3"
        except ImportError:
            logger.warning("boto3 not installed. Install with: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}")
            raise

    elif provider == "gcs":
        try:
            from google.cloud import storage as gcs_storage

            client = gcs_storage.Client.from_service_account_json(
                storage_config.get("credentials_path")
            )
            logger.info(
                f"✅ Initialized GCS client (bucket: {storage_config.get('bucket_name')})"
            )
            return client, "gcs"
        except ImportError:
            logger.warning(
                "google-cloud-storage not installed. Install with: pip install google-cloud-storage"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
            raise

    elif provider == "azure":
        try:
            from azure.storage.blob import BlobServiceClient

            if storage_config.get("connection_string"):
                client = BlobServiceClient.from_connection_string(
                    storage_config["connection_string"]
                )
            else:
                account_url = (
                    f"https://{storage_config['account_name']}.blob.core.windows.net"
                )
                client = BlobServiceClient(
                    account_url=account_url, credential=storage_config["account_key"]
                )
            logger.info(
                f"✅ Initialized Azure Blob client (container: {storage_config.get('container_name')})"
            )
            return client, "azure"
        except ImportError:
            logger.warning(
                "azure-storage-blob not installed. Install with: pip install azure-storage-blob"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Azure client: {e}")
            raise

    else:  # local
        base_path = Path(storage_config.get("base_path", "/tmp/rl-studio-models"))
        base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"✅ Using local storage (path: {base_path})")
        return base_path, "local"


def upload_model(model_path: Union[str, Path], run_id: str, algorithm: str) -> str:
    """
    Upload model to configured storage provider.

    Args:
        model_path: Local path to model directory
        run_id: Training run ID
        algorithm: Algorithm name (ppo, dqn, etc.)

    Returns:
        Storage URL (s3://, gs://, azure://, or file://)
    """
    config = get_infrastructure_config()
    storage_config = config.get_storage_config()
    provider = storage_config["provider"]

    model_path = Path(model_path)
    if not model_path.exists():
        raise ValueError(f"Model path does not exist: {model_path}")

    # Create zip file
    zip_path = tempfile.mktemp(suffix=".zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in model_path.rglob("*"):
            if file.is_file():
                zipf.write(file, file.relative_to(model_path))

    try:
        if provider == "s3":
            client, _ = get_storage_client()
            bucket_name = storage_config["bucket_name"]
            key = f"models/{run_id}/{algorithm}_model.zip"

            client.upload_file(zip_path, bucket_name, key)
            url = f"s3://{bucket_name}/{key}"
            logger.info(f"✅ Uploaded model to S3: {url}")
            return url

        elif provider == "gcs":
            client, _ = get_storage_client()
            bucket_name = storage_config["bucket_name"]
            bucket = client.bucket(bucket_name)
            blob_name = f"models/{run_id}/{algorithm}_model.zip"
            blob = bucket.blob(blob_name)

            blob.upload_from_filename(zip_path)
            url = f"gs://{bucket_name}/{blob_name}"
            logger.info(f"✅ Uploaded model to GCS: {url}")
            return url

        elif provider == "azure":
            client, _ = get_storage_client()
            container_name = storage_config["container_name"]
            blob_name = f"models/{run_id}/{algorithm}_model.zip"

            with open(zip_path, "rb") as data:
                client.upload_blob(
                    name=blob_name, data=data, container=container_name, overwrite=True
                )
            url = f"azure://{container_name}/{blob_name}"
            logger.info(f"✅ Uploaded model to Azure: {url}")
            return url

        else:  # local
            base_path = Path(storage_config.get("base_path", "/tmp/rl-studio-models"))
            dest_path = base_path / run_id / f"{algorithm}_model.zip"
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            import shutil

            shutil.copy(zip_path, dest_path)
            url = f"file://{dest_path}"
            logger.info(f"✅ Saved model locally: {url}")
            return url

    finally:
        # Clean up temp zip
        if os.path.exists(zip_path):
            os.remove(zip_path)


def download_model(model_url: str, local_path: Union[str, Path]) -> Path:
    """
    Download model from configured storage provider.

    Args:
        model_url: Storage URL (s3://, gs://, azure://, or file://)
        local_path: Local path to save model

    Returns:
        Path to downloaded model
    """
    local_path = Path(local_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)

    config = get_infrastructure_config()
    storage_config = config.get_storage_config()

    if model_url.startswith("s3://"):
        client, _ = get_storage_client()
        # Parse s3://bucket/key
        parts = model_url.replace("s3://", "").split("/", 1)
        bucket_name = parts[0]
        key = parts[1] if len(parts) > 1 else ""

        client.download_file(bucket_name, key, str(local_path))
        logger.info(f"✅ Downloaded model from S3: {model_url}")

    elif model_url.startswith("gs://"):
        client, _ = get_storage_client()
        # Parse gs://bucket/blob
        parts = model_url.replace("gs://", "").split("/", 1)
        bucket_name = parts[0]
        blob_name = parts[1] if len(parts) > 1 else ""

        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.download_to_filename(str(local_path))
        logger.info(f"✅ Downloaded model from GCS: {model_url}")

    elif model_url.startswith("azure://"):
        client, _ = get_storage_client()
        # Parse azure://container/blob
        parts = model_url.replace("azure://", "").split("/", 1)
        container_name = parts[0]
        blob_name = parts[1] if len(parts) > 1 else ""

        blob_client = client.get_blob_client(container=container_name, blob=blob_name)
        with open(local_path, "wb") as f:
            f.write(blob_client.download_blob().readall())
        logger.info(f"✅ Downloaded model from Azure: {model_url}")

    elif model_url.startswith("file://"):
        # Local file
        source_path = Path(model_url.replace("file://", ""))
        import shutil

        shutil.copy(source_path, local_path)
        logger.info(f"✅ Copied model from local: {model_url}")

    else:
        raise ValueError(f"Unsupported model URL format: {model_url}")

    return local_path


def get_file_size(file_path: Union[str, Path]) -> int:
    """Get file size in bytes"""
    return Path(file_path).stat().st_size
