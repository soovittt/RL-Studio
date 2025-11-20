#!/bin/bash
# Complete seeding script with all checks and duplicate prevention

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🌱 RL Studio Database Seeding${NC}"
echo ""

# 1. Check CONVEX_URL
echo -e "${BLUE}Step 1: Checking CONVEX_URL...${NC}"

# Try to load from root .env
if [ -f .env ]; then
    # Load all CONVEX_URL variants
    export $(grep -v '^#' .env | grep -i "CONVEX_URL" | xargs)
    echo "   Loaded from root .env"
fi

# Try to load from backend .env
if [ -f backend/.env ]; then
    export $(grep -v '^#' backend/.env | grep -i "CONVEX_URL" | xargs)
    echo "   Loaded from backend/.env"
fi

# Check if VITE_CONVEX_URL exists and use it if CONVEX_URL doesn't
if [ -z "$CONVEX_URL" ] && [ -n "$VITE_CONVEX_URL" ]; then
    export CONVEX_URL="$VITE_CONVEX_URL"
    echo "   Using VITE_CONVEX_URL as CONVEX_URL"
fi

# Remove /api suffix if present (backend expects base URL)
CONVEX_URL="${CONVEX_URL%/api}"

if [ -z "$CONVEX_URL" ]; then
    echo -e "${RED}❌ CONVEX_URL not set${NC}"
    echo ""
    echo "   Checked:"
    echo "   - .env (root)"
    echo "   - backend/.env"
    echo "   - VITE_CONVEX_URL"
    echo ""
    echo "   Set it in .env file or export it:"
    echo "   export CONVEX_URL=https://your-deployment.convex.cloud"
    echo ""
    echo "   Or if you have VITE_CONVEX_URL, it will be used automatically"
    exit 1
fi

echo -e "${GREEN}✅ CONVEX_URL is set: ${CONVEX_URL:0:50}...${NC}"
echo ""

# 2. Check backend is running
echo -e "${BLUE}Step 2: Checking backend...${NC}"
if ! curl -s http://localhost:8000/api/admin/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend not running${NC}"
    echo "   Start it with:"
    echo "   cd backend && source venv/bin/activate && python main.py"
    exit 1
fi

HEALTH=$(curl -s http://localhost:8000/api/admin/health)
if echo "$HEALTH" | grep -q "unhealthy"; then
    echo -e "${RED}❌ Backend is unhealthy${NC}"
    echo "$HEALTH"
    exit 1
fi
echo -e "${GREEN}✅ Backend is running and healthy${NC}"
echo ""

# 3. Seed assets
echo -e "${BLUE}Step 3: Seeding assets...${NC}"
ASSET_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/assets \
    -H "Content-Type: application/json" \
    -d '{}')

if echo "$ASSET_RESULT" | grep -q "success"; then
    echo -e "${GREEN}✅ Assets seeded successfully!${NC}"
    # Count created vs skipped
    CREATED=$(echo "$ASSET_RESULT" | grep -o '"action":"created"' | wc -l | tr -d ' ')
    SKIPPED=$(echo "$ASSET_RESULT" | grep -o '"action":"skipped"' | wc -l | tr -d ' ')
    if [ "$CREATED" -gt 0 ]; then
        echo "   Created: $CREATED new assets"
    fi
    if [ "$SKIPPED" -gt 0 ]; then
        echo "   Skipped: $SKIPPED existing assets (no duplicates!)"
    fi
else
    echo -e "${RED}❌ Asset seeding failed${NC}"
    echo "$ASSET_RESULT" | head -5
    exit 1
fi
echo ""

# 4. Seed templates
echo -e "${BLUE}Step 4: Seeding templates...${NC}"
TEMPLATE_RESULT=$(curl -s -X POST http://localhost:8000/api/admin/seed/templates \
    -H "Content-Type: application/json" \
    -d '{}')

if echo "$TEMPLATE_RESULT" | grep -q "success"; then
    echo -e "${GREEN}✅ Templates seeded successfully!${NC}"
    # Count created vs skipped
    CREATED=$(echo "$TEMPLATE_RESULT" | grep -o '"action":"created"' | wc -l | tr -d ' ')
    SKIPPED=$(echo "$TEMPLATE_RESULT" | grep -o '"action":"skipped"' | wc -l | tr -d ' ')
    if [ "$CREATED" -gt 0 ]; then
        echo "   Created: $CREATED new templates"
    fi
    if [ "$SKIPPED" -gt 0 ]; then
        echo "   Skipped: $SKIPPED existing templates (no duplicates!)"
    fi
else
    echo -e "${RED}❌ Template seeding failed${NC}"
    echo "$TEMPLATE_RESULT" | head -5
    exit 1
fi
echo ""

# 5. Verify
echo -e "${BLUE}Step 5: Verifying...${NC}"
ASSET_COUNT=$(curl -s http://localhost:8000/api/assets/ 2>/dev/null | grep -o '"name"' | wc -l | tr -d ' ' || echo "0")
TEMPLATE_COUNT=$(curl -s "http://localhost:8000/api/templates/?is_public=true" 2>/dev/null | grep -o '"name"' | wc -l | tr -d ' ' || echo "0")

echo -e "${GREEN}✅ Verification complete!${NC}"
echo "   Assets in database: $ASSET_COUNT"
echo "   Templates in database: $TEMPLATE_COUNT"
echo ""

echo -e "${GREEN}🎉 Seeding complete!${NC}"
echo ""
echo "What's available:"
echo "  ✅ Asset Types: 5 types (character, vehicle, prop, tile, prefab)"
echo "  ✅ Assets: $ASSET_COUNT assets (Agent, Goal, Wall, Key, Door, etc.)"
echo "  ✅ Templates: $TEMPLATE_COUNT templates (Gridworld, Cliff Walking, Maze, etc.)"
echo ""
echo "Where to find them:"
echo "  📋 Templates: New Environment → From Template → 'Templates from Library'"
echo "  🎨 Assets: Top of canvas when editing (Asset Palette)"
echo ""
echo "💾 All resources are cached locally for offline access"
echo "🔄 Running again will skip existing items (no duplicates!)"

