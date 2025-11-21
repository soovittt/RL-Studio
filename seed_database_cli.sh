#!/bin/bash
# Seed database using Convex CLI directly (workaround for HTTP routes not working)
# Usage: ./seed_database_cli.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 RL Studio Database Seeding (via CLI)${NC}"
echo ""
echo -e "${GREEN}Note: Assets and templates will be available to ALL users${NC}"
echo ""

# Check if CONVEX_DEPLOY_KEY is set
if [ -z "$CONVEX_DEPLOY_KEY" ]; then
    echo -e "${YELLOW}⚠️  CONVEX_DEPLOY_KEY not set, checking .env.local...${NC}"
    if [ -f .env.local ]; then
        export $(grep CONVEX_DEPLOY_KEY .env.local | xargs)
    fi
fi

if [ -z "$CONVEX_DEPLOY_KEY" ]; then
    echo -e "${YELLOW}⚠️  CONVEX_DEPLOY_KEY not found. Please set it in .env.local or as an environment variable.${NC}"
    exit 1
fi

# Seed asset types
echo -e "${BLUE}📦 Seeding asset types...${NC}"
npx convex run seed:seedAssetTypes 2>&1 | grep -E "(created|skipped|error)" || true
echo ""

# Seed assets
echo -e "${BLUE}📦 Seeding assets...${NC}"
npx convex run seed:seedAssets 2>&1 | tail -20
echo ""

# Seed templates
echo -e "${BLUE}📋 Seeding templates...${NC}"
npx convex run seedTemplates:seedTemplates 2>&1 | tail -20
echo ""

echo -e "${GREEN}🎉 Seeding complete!${NC}"
echo ""
echo "What was seeded:"
echo "  ✅ Asset Types: character, vehicle, prop, tile, prefab"
echo "  ✅ Assets: ~20+ assets (Agent, Goal, Wall, Key, Door, etc.)"
echo "  ✅ Templates: 8 templates (Gridworld, Cliff Walking, Maze, etc.)"
echo ""
echo "Where to find them:"
echo "  📋 Templates: Click 'New Environment' → 'From Template' → 'Templates from Library'"
echo "  🎨 Assets: Top of canvas when editing (Asset Palette)"
echo ""

