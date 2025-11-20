#!/usr/bin/env python3
"""
Auto-seed script that seeds the database without requiring user_id
Uses system user automatically - assets/templates are available to ALL users
"""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from rl_studio.api.seed_database import seed_assets, seed_templates, seed_all

def main():
    print("🌱 RL Studio Auto-Seeding")
    print("=" * 60)
    print("Assets and templates will be available to ALL users")
    print("=" * 60)
    print()
    
    # Check backend connection
    try:
        from rl_studio.api.convex_client import get_client
        client = get_client()
        print("✅ Connected to Convex")
    except Exception as e:
        print(f"❌ Failed to connect to Convex: {e}")
        print("Make sure:")
        print("  1. Backend is running (python main.py)")
        print("  2. CONVEX_URL is set in environment")
        sys.exit(1)
    
    # Seed assets (no user_id needed - uses system user)
    print()
    print("📦 Seeding assets...")
    try:
        asset_results = seed_assets()  # No user_id - uses system user
        print("✅ Assets seeded successfully!")
        print(f"   Created: {len([r for r in asset_results.get('assets', []) if r.get('action') == 'created'])}")
        print(f"   Skipped: {len([r for r in asset_results.get('assets', []) if r.get('action') == 'skipped'])}")
    except Exception as e:
        print(f"❌ Error seeding assets: {e}")
        sys.exit(1)
    
    # Seed templates (requires project_id)
    project_id = os.getenv("SEED_PROJECT_ID")
    if project_id:
        print()
        print("📋 Seeding templates...")
        try:
            template_results = seed_templates(project_id)  # No user_id - uses system user
            print("✅ Templates seeded successfully!")
            print(f"   Created: {len([r for r in template_results if r.get('action') == 'created'])}")
            print(f"   Skipped: {len([r for r in template_results if r.get('action') == 'skipped'])}")
        except Exception as e:
            print(f"❌ Error seeding templates: {e}")
            print("   (This is okay - templates can be seeded separately)")
    else:
        print()
        print("⚠️  Skipping templates (no SEED_PROJECT_ID env var)")
        print("   To seed templates, set SEED_PROJECT_ID=<any_environment_id>")
        print("   Or seed them via API: curl -X POST http://localhost:8000/api/admin/seed/templates")
    
    print()
    print("=" * 60)
    print("🎉 Seeding complete!")
    print("=" * 60)
    print()
    print("What was seeded:")
    print("  ✅ Asset Types: 5 types (character, vehicle, prop, tile, prefab)")
    print("  ✅ Assets: 25+ assets (Agent, Goal, Wall, Key, Door, Car, etc.)")
    if project_id:
        print("  ✅ Templates: 8 templates (Gridworld, Cliff Walking, Maze, etc.)")
    print()
    print("Where to find them:")
    print("  📋 Templates: New Environment → From Template → 'Templates from Library'")
    print("  🎨 Assets: Top of canvas when editing (Asset Palette)")
    print()
    print("💾 Assets and templates are cached locally for offline access")

if __name__ == "__main__":
    main()

