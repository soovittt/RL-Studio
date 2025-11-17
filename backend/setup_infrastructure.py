#!/usr/bin/env python3
"""
Quick infrastructure setup script for RL Studio
Installs SkyPilot and configures AWS credentials from .env
"""
import sys
import subprocess
from pathlib import Path

def main():
    print("🚀 RL Studio Infrastructure Setup")
    print("=" * 50)
    
    # Check .env file
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        print("❌ .env file not found!")
        print(f"   Please create {env_file} with:")
        print("   AWS_ACCESS_KEY_ID=your-key")
        print("   AWS_SECRET_ACCESS_KEY=your-secret")
        print("   AWS_DEFAULT_REGION=us-east-1")
        sys.exit(1)
    
    # Load .env
    from dotenv import load_dotenv
    import os
    load_dotenv(env_file)
    
    aws_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
    
    if not aws_key or not aws_secret:
        print("❌ AWS credentials not found in .env!")
        print("   Please add:")
        print("   AWS_ACCESS_KEY_ID=your-key")
        print("   AWS_SECRET_ACCESS_KEY=your-secret")
        print("   AWS_DEFAULT_REGION=us-east-1")
        sys.exit(1)
    
    print("✅ AWS credentials found in .env")
    
    # Install SkyPilot
    print("\n📦 Installing SkyPilot...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "skypilot[aws]>=0.5.0"],
            capture_output=True,
            text=True,
            timeout=600,  # 10 minutes
        )
        if result.returncode == 0:
            print("✅ SkyPilot installed successfully")
        else:
            print(f"⚠️  Installation warning: {result.stderr[:200]}")
    except subprocess.TimeoutExpired:
        print("⚠️  Installation taking longer than expected, but continuing...")
    except Exception as e:
        print(f"⚠️  Installation error: {e}")
    
    # Setup AWS credentials
    print("\n🔧 Configuring AWS credentials...")
    try:
        from rl_studio.training.aws_setup import setup_aws_credentials_from_env
        if setup_aws_credentials_from_env():
            print("✅ AWS credentials configured")
        else:
            print("❌ Failed to configure AWS credentials")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Error configuring AWS: {e}")
        sys.exit(1)
    
    # Verify setup
    print("\n🔍 Verifying setup...")
    try:
        from rl_studio.training.aws_setup import verify_aws_setup
        result = verify_aws_setup()
        
        print(f"   SkyPilot installed: {'✅' if result['skypilot_installed'] else '❌'}")
        print(f"   AWS configured: {'✅' if result['aws_configured'] else '❌'}")
        print(f"   AWS accessible: {'✅' if result['aws_accessible'] else '❌'}")
        
        if result.get("errors"):
            print("\n⚠️  Warnings:")
            for error in result["errors"]:
                print(f"   - {error}")
        
        if result['skypilot_installed'] and result['aws_configured']:
            print("\n🎉 Infrastructure setup complete!")
            print("   You can now launch training jobs from the UI.")
            return 0
        else:
            print("\n⚠️  Setup incomplete. Please check errors above.")
            return 1
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())

