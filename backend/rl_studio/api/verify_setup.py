"""
Verification script to test the Figma-style world builder setup
Checks that all services, endpoints, and data are properly configured
"""

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from rl_studio.api.convex_client import get_client

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


class VerificationResult:
    """Track verification results"""

    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []

    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append({"test": test_name, "details": details})
        logger.info(f"✓ {test_name}: {details}")

    def add_fail(self, test_name: str, error: str):
        self.failed.append({"test": test_name, "error": error})
        logger.error(f"✗ {test_name}: {error}")

    def add_warning(self, test_name: str, warning: str):
        self.warnings.append({"test": test_name, "warning": warning})
        logger.warning(f"⚠ {test_name}: {warning}")

    def print_summary(self):
        """Print verification summary"""
        print("\n" + "=" * 60)
        print("VERIFICATION SUMMARY")
        print("=" * 60)
        print(f"Passed: {len(self.passed)}")
        print(f"Failed: {len(self.failed)}")
        print(f"Warnings: {len(self.warnings)}")
        print("=" * 60)

        if self.passed:
            print("\n✓ PASSED TESTS:")
            for item in self.passed:
                print(f"  - {item['test']}")
                if item["details"]:
                    print(f"    {item['details']}")

        if self.warnings:
            print("\n⚠ WARNINGS:")
            for item in self.warnings:
                print(f"  - {item['test']}: {item['warning']}")

        if self.failed:
            print("\n✗ FAILED TESTS:")
            for item in self.failed:
                print(f"  - {item['test']}: {item['error']}")

        print("\n" + "=" * 60)

        return len(self.failed) == 0


def verify_convex_connection(result: VerificationResult) -> bool:
    """Verify Convex connection"""
    try:
        client = get_client()
        result.add_pass("Convex Connection", f"Connected to {client.convex_url}")
        return True
    except Exception as e:
        result.add_fail("Convex Connection", str(e))
        return False


def verify_asset_types(result: VerificationResult, client) -> bool:
    """Verify asset types are seeded"""
    try:
        # Query asset types via HTTP
        asset_types = client.query("assetTypes/list", {})

        if not asset_types:
            result.add_warning("Asset Types", "No asset types found - run seed script")
            return False

        expected_types = ["tile", "character", "vehicle", "prop", "prefab"]
        found_types = [at.get("key") for at in asset_types if isinstance(at, dict)]

        missing = set(expected_types) - set(found_types)
        if missing:
            result.add_warning("Asset Types", f"Missing types: {missing}")
        else:
            result.add_pass(
                "Asset Types",
                f"Found {len(asset_types)} types: {', '.join(found_types)}",
            )

        return len(missing) == 0
    except Exception as e:
        result.add_fail("Asset Types", str(e))
        return False


def verify_assets(result: VerificationResult, client) -> bool:
    """Verify assets are seeded"""
    try:
        assets = client.query("assets/list", {})

        if not assets or len(assets) == 0:
            result.add_warning("Assets", "No assets found - run seed script")
            return False

        expected_assets = ["Wall", "Agent", "Goal", "Key", "Door", "Trap", "Checkpoint"]
        found_names = [a.get("name") for a in assets if isinstance(a, dict)]

        found_count = sum(1 for name in expected_assets if name in found_names)
        result.add_pass(
            "Assets",
            f"Found {len(assets)} assets ({found_count}/{len(expected_assets)} expected)",
        )

        return found_count >= len(expected_assets) * 0.7  # At least 70% of expected
    except Exception as e:
        result.add_fail("Assets", str(e))
        return False


def verify_templates(result: VerificationResult, client) -> bool:
    """Verify templates are available"""
    try:
        templates = client.query("templates/list", {"isPublic": True})

        if not templates or len(templates) == 0:
            result.add_warning(
                "Templates", "No templates found - run seed script with project_id"
            )
            return False

        expected_templates = [
            "Basic Gridworld",
            "Cliff Walking",
            "Key & Door Grid",
            "Maze Generator",
            "Multi-Agent Grid (Cooperative)",
        ]
        found_names = [t.get("name") for t in templates if isinstance(t, dict)]

        found_count = sum(1 for name in expected_templates if name in found_names)
        result.add_pass(
            "Templates",
            f"Found {len(templates)} templates ({found_count}/{len(expected_templates)} expected)",
        )

        return found_count >= len(expected_templates) * 0.7
    except Exception as e:
        result.add_fail("Templates", str(e))
        return False


def verify_http_endpoints(result: VerificationResult) -> bool:
    """Verify HTTP endpoints are accessible"""
    try:
        client = get_client()

        # Test a simple query endpoint
        try:
            asset_types = client.query("assetTypes/list", {})
            result.add_pass("HTTP Endpoints", "Query endpoints accessible")
            return True
        except Exception as e:
            result.add_fail("HTTP Endpoints", f"Query failed: {str(e)}")
            return False
    except Exception as e:
        result.add_fail("HTTP Endpoints", str(e))
        return False


def verify_schema(result: VerificationResult, client) -> bool:
    """Verify database schema tables exist"""
    # This is harder to verify without direct DB access
    # We'll check by trying to query each table
    tables_to_check = [
        ("assetTypes", "assetTypes/list"),
        ("assets", "assets/list"),
        ("templates", "templates/list"),
    ]

    all_passed = True
    for table_name, query_path in tables_to_check:
        try:
            result_data = client.query(query_path, {})
            result.add_pass(f"Schema: {table_name}", "Table accessible")
        except Exception as e:
            result.add_fail(f"Schema: {table_name}", str(e))
            all_passed = False

    return all_passed


def run_verification() -> bool:
    """Run all verification checks"""
    result = VerificationResult()

    print("=" * 60)
    print("RL STUDIO - FIGMA-STYLE WORLD BUILDER VERIFICATION")
    print("=" * 60)
    print()

    # 1. Verify Convex connection
    if not verify_convex_connection(result):
        print(
            "\n⚠ Cannot connect to Convex. Please check CONVEX_URL environment variable."
        )
        result.print_summary()
        return False

    client = get_client()

    # 2. Verify schema
    verify_schema(result, client)

    # 3. Verify HTTP endpoints
    verify_http_endpoints(result, client)

    # 4. Verify asset types
    verify_asset_types(result, client)

    # 5. Verify assets
    verify_assets(result, client)

    # 6. Verify templates
    verify_templates(result, client)

    # Print summary
    all_passed = result.print_summary()

    if all_passed:
        print("\n✅ All critical checks passed!")
    else:
        print("\n⚠ Some checks failed or have warnings.")

    return all_passed


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
