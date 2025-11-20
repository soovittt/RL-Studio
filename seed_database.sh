#!/bin/bash
# Quick script to seed the database with assets and templates
# Assets and templates are created as GLOBAL/PUBLIC (available to ALL users)
# Usage: ./seed_database.sh [user_id] [project_id]
# If user_id not provided, uses system user automatically

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 RL Studio Database Seeding${NC}"
echo ""
echo -e "${GREEN}Note: Assets and templates will be available to ALL users${NC}"
echo ""

USER_ID=${1:-""}
PROJECT_ID=${2:-""}

if [ -n "$USER_ID" ]; then
    echo -e "${GREEN}Using provided user ID:${NC} $USER_ID"
else
    echo -e "${GREEN}No user ID provided - will use system user${NC}"
fi

if [ -n "$PROJECT_ID" ]; then
    echo -e "${GREEN}Project ID:${NC} $PROJECT_ID"
else
    echo -e "${GREEN}No project ID - templates will be created as GLOBAL (like assets)${NC}"
fi
echo ""

# Check if backend is running
if ! curl -s http://localhost:8000/api/admin/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend not running on localhost:8000${NC}"
    echo "Please start the backend first:"
    echo "  cd backend && source venv/bin/activate && python main.py"
    exit 1
fi

# Seed assets
echo -e "${BLUE}📦 Seeding assets...${NC}"
if [ -n "$USER_ID" ]; then
    ASSET_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/assets \
        -H "Content-Type: application/json" \
        -d "{\"created_by\": \"$USER_ID\"}")
else
    ASSET_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/assets \
        -H "Content-Type: application/json" \
        -d "{}")
fi

if echo "$ASSET_RESULT" | grep -q "success"; then
    echo -e "${GREEN}✅ Assets seeded successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Asset seeding may have issues:${NC}"
    echo "$ASSET_RESULT" | head -20
fi
echo ""

# Seed templates (project_id is optional - templates can be global)
echo -e "${BLUE}📋 Seeding templates...${NC}"
if [ -n "$USER_ID" ] && [ -n "$PROJECT_ID" ]; then
    TEMPLATE_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/templates \
        -H "Content-Type: application/json" \
        -d "{\"created_by\": \"$USER_ID\", \"project_id\": \"$PROJECT_ID\"}")
elif [ -n "$PROJECT_ID" ]; then
    TEMPLATE_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/templates \
        -H "Content-Type: application/json" \
        -d "{\"project_id\": \"$PROJECT_ID\"}")
elif [ -n "$USER_ID" ]; then
    TEMPLATE_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/templates \
        -H "Content-Type: application/json" \
        -d "{\"created_by\": \"$USER_ID\"}")
else
    TEMPLATE_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/templates \
        -H "Content-Type: application/json" \
        -d "{}")
fi

if echo "$TEMPLATE_RESULT" | grep -q "success"; then
    echo -e "${GREEN}✅ Templates seeded successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Template seeding may have issues:${NC}"
    echo "$TEMPLATE_RESULT" | head -20
fi
echo ""

echo -e "${GREEN}🎉 Seeding complete!${NC}"
echo ""
echo "What was seeded:"
echo "  ✅ Asset Types: character, vehicle, prop, tile, prefab"
echo "  ✅ Assets: ~20+ assets (Agent, Goal, Wall, Key, Door, etc.)"
if [ -n "$PROJECT_ID" ]; then
    echo "  ✅ Templates: 8 templates (Gridworld, Cliff Walking, Maze, etc.)"
fi
echo ""
echo "Where to find them:"
echo "  📋 Templates: Click 'New Environment' → 'From Template' → 'Templates from Library'"
echo "  🎨 Assets: Top of canvas when editing (Asset Palette)"
echo ""

