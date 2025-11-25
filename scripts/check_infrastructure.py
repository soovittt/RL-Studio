#!/usr/bin/env python3
"""
Infrastructure Configuration Checker
Quick script to verify your infrastructure setup.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

try:
    from rl_studio.utils.infrastructure_config import get_infrastructure_config
    import json
    
    print("🔍 Checking Infrastructure Configuration...")
    print("=" * 60)
    print()
    
    config = get_infrastructure_config()
    summary = config.get_config_summary()
    
    # Storage
    print("📦 Storage Configuration:")
    print(f"   Provider: {summary['storage']['provider']}")
    print(f"   Status: {'✅ Valid' if summary['storage']['valid'] else '❌ Invalid'}")
    if not summary['storage']['valid']:
        valid, error = config.validate_storage_config()
        if error:
            print(f"   Error: {error}")
    print()
    
    # Compute
    print("🖥️  Compute Configuration:")
    print(f"   Provider: {summary['compute']['provider']}")
    print(f"   Status: {'✅ Valid' if summary['compute']['valid'] else '❌ Invalid'}")
    if not summary['compute']['valid']:
        valid, error = config.validate_compute_config()
        if error:
            print(f"   Error: {error}")
    print()
    
    # Summary
    print("=" * 60)
    if summary['storage']['valid'] and summary['compute']['valid']:
        print("✅ All infrastructure configured!")
    elif summary['storage']['valid'] or summary['compute']['valid']:
        print("⚠️  Partial configuration (some features may not work)")
    else:
        print("ℹ️  Using local storage and compute (no cloud configured)")
        print("   This is fine for local development!")
    print()
    
    # Show config (safe)
    print("Configuration Details:")
    print(json.dumps(summary, indent=2))
    
except ImportError as e:
    print(f"❌ Could not import infrastructure config: {e}")
    print("   Make sure you're in the backend directory or have it in PYTHONPATH")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

