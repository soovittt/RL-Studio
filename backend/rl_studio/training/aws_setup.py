"""
AWS Infrastructure Setup for SkyPilot
Automatically configures AWS credentials from .env file
"""
import os
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def setup_aws_credentials_from_env() -> bool:
    """
    Set up AWS credentials for SkyPilot from .env file.
    
    Reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from .env
    and configures them for SkyPilot.
    
    Returns:
        True if setup successful, False otherwise
    """
    try:
        # Load .env file
        from dotenv import load_dotenv
        
        # Try multiple .env locations
        env_paths = [
            Path(__file__).parent.parent.parent / ".env",
            Path(__file__).parent.parent.parent.parent / ".env",
            Path.home() / ".env",
        ]
        
        env_loaded = False
        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(env_path)
                env_loaded = True
                logger.info(f"Loaded .env from {env_path}")
                break
        
        if not env_loaded:
            logger.warning("No .env file found, using environment variables")
        
        # Get AWS credentials from environment
        aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        aws_region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
        
        if not aws_access_key_id or not aws_secret_access_key:
            logger.warning("AWS credentials not found in .env or environment")
            logger.info("Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file")
            return False
        
        # Configure AWS credentials for SkyPilot
        # SkyPilot uses standard AWS CLI credentials location
        aws_creds_dir = Path.home() / ".aws"
        aws_creds_dir.mkdir(exist_ok=True)
        
        # Write credentials file
        creds_file = aws_creds_dir / "credentials"
        config_file = aws_creds_dir / "config"
        
        # Read existing credentials if they exist
        existing_creds = {}
        if creds_file.exists():
            with open(creds_file, "r") as f:
                content = f.read()
                # Simple parsing (not perfect but works for default profile)
                if "[default]" in content:
                    lines = content.split("[default]")[1].split("\n")
                    for line in lines:
                        if "=" in line:
                            key, value = line.split("=", 1)
                            existing_creds[key.strip()] = value.strip()
        
        # Only update if credentials are different or missing
        if (existing_creds.get("aws_access_key_id") != aws_access_key_id or
            existing_creds.get("aws_secret_access_key") != aws_secret_access_key):
            
            # Write credentials
            with open(creds_file, "w") as f:
                f.write("[default]\n")
                f.write(f"aws_access_key_id = {aws_access_key_id}\n")
                f.write(f"aws_secret_access_key = {aws_secret_access_key}\n")
            
            logger.info("✅ AWS credentials configured for SkyPilot")
        
        # Write config file
        with open(config_file, "w") as f:
            f.write("[default]\n")
            f.write(f"region = {aws_region}\n")
            f.write("output = json\n")
        
        logger.info(f"✅ AWS region configured: {aws_region}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to setup AWS credentials: {e}")
        return False


def verify_aws_setup() -> Dict[str, Any]:
    """
    Verify AWS and SkyPilot setup.
    
    Returns:
        Dict with setup status
    """
    result = {
        "skypilot_installed": False,
        "aws_configured": False,
        "aws_accessible": False,
        "errors": [],
    }
    
    # Check SkyPilot installation
    try:
        subprocess.run(
            ["sky", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        result["skypilot_installed"] = True
    except (FileNotFoundError, subprocess.TimeoutExpired, subprocess.CalledProcessError):
        result["errors"].append("SkyPilot not installed. Run: pip install 'skypilot[aws]'")
    
    # Check AWS credentials file
    aws_creds = Path.home() / ".aws" / "credentials"
    if aws_creds.exists():
        result["aws_configured"] = True
    else:
        result["errors"].append("AWS credentials file not found")
    
    # Check AWS access with sky check
    if result["skypilot_installed"]:
        try:
            check_result = subprocess.run(
                ["sky", "check", "aws"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            output = check_result.stdout.lower()
            if "enabled" in output or "aws" in output:
                result["aws_accessible"] = True
            else:
                result["errors"].append(f"AWS not accessible: {check_result.stdout}")
        except Exception as e:
            result["errors"].append(f"Failed to check AWS: {e}")
    
    return result


def install_skypilot() -> bool:
    """
    Install SkyPilot with AWS support.
    
    Returns:
        True if installation successful
    """
    # First check if already installed
    try:
        subprocess.run(
            ["sky", "--version"],
            capture_output=True,
            check=True,
            timeout=5,
        )
        logger.info("✅ SkyPilot already installed")
        return True
    except:
        pass
    
    try:
        logger.info("Installing SkyPilot with AWS support...")
        # Use python -m pip for better compatibility
        import sys
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "skypilot[aws]>=0.5.0"],
            capture_output=True,
            text=True,
            timeout=600,  # 10 minutes (installation can be slow)
        )
        
        if result.returncode == 0:
            logger.info("✅ SkyPilot installed successfully")
            return True
        else:
            logger.warning(f"Installation may have issues: {result.stderr[:200]}")
            # Still return True if we can verify it's installed
            try:
                subprocess.run(["sky", "--version"], check=True, timeout=5)
                return True
            except:
                return False
    except subprocess.TimeoutExpired:
        logger.warning("Installation timeout, but continuing...")
        # Check if it got installed anyway
        try:
            subprocess.run(["sky", "--version"], check=True, timeout=5)
            return True
        except:
            return False
    except Exception as e:
        logger.error(f"Failed to install SkyPilot: {e}")
        return False


def setup_infrastructure() -> Dict[str, Any]:
    """
    Complete infrastructure setup:
    1. Install SkyPilot if needed
    2. Configure AWS credentials from .env
    3. Verify setup
    
    Returns:
        Dict with setup status
    """
    result = {
        "skypilot_installed": False,
        "aws_configured": False,
        "aws_accessible": False,
        "errors": [],
        "warnings": [],
    }
    
    # Step 1: Install SkyPilot
    try:
        subprocess.run(["sky", "--version"], capture_output=True, check=True, timeout=5)
        result["skypilot_installed"] = True
        logger.info("✅ SkyPilot already installed")
    except:
        logger.info("Installing SkyPilot...")
        if install_skypilot():
            result["skypilot_installed"] = True
        else:
            result["errors"].append("Failed to install SkyPilot")
            return result
    
    # Step 2: Setup AWS credentials
    if setup_aws_credentials_from_env():
        result["aws_configured"] = True
    else:
        result["warnings"].append("AWS credentials not found in .env. Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
    
    # Step 3: Verify AWS access
    if result["skypilot_installed"] and result["aws_configured"]:
        verify_result = verify_aws_setup()
        result["aws_accessible"] = verify_result.get("aws_accessible", False)
        result["errors"].extend(verify_result.get("errors", []))
    
    return result

