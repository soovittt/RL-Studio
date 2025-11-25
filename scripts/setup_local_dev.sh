#!/bin/bash
# Local Development Setup Script
# Sets up Convex and seeds local data for open-source development

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔧 Local Development Setup${NC}"
echo "============================================================"
echo ""

# 1. Check Convex
echo -e "${BLUE}1. Setting up Convex...${NC}"
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js${NC}"
    exit 1
fi

# Check if Convex is initialized
if [ ! -f "convex/.env" ] && [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  Convex not initialized. Running 'npx convex dev' for the first time...${NC}"
    echo -e "${YELLOW}   This will create a new Convex deployment${NC}"
    echo ""
    echo "Press Enter to continue, or Ctrl+C to cancel..."
    read
    
    # Start Convex dev (this will create deployment)
    npx convex dev --once --url 2>&1 | head -20 || true
fi

# Get Convex URL
CONVEX_URL=$(grep -i "VITE_CONVEX_URL" .env.local 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
if [ -z "$CONVEX_URL" ]; then
    # Try to get from convex config
    CONVEX_URL=$(npx convex config get CONVEX_URL 2>/dev/null || echo "")
fi

if [ -z "$CONVEX_URL" ]; then
    echo -e "${RED}❌ Could not find Convex URL${NC}"
    echo "   Please run: npx convex dev"
    echo "   Then add VITE_CONVEX_URL to .env.local"
    exit 1
fi

echo -e "${GREEN}✅ Convex URL: $CONVEX_URL${NC}"
export CONVEX_URL

# 2. Seed local data
echo -e "${BLUE}2. Seeding local development data...${NC}"
echo -e "${YELLOW}   This creates sample environments, runs, and data${NC}"
echo ""

npx convex run seed_local_data:seedAll 2>&1 | grep -E "(success|count|error|✅|❌)" || {
    echo -e "${YELLOW}⚠️  Seeding may have failed or database already has data${NC}"
    echo "   This is OK - you can continue with existing data"
}

# 3. Create .env files if needed
echo -e "${BLUE}3. Setting up environment files...${NC}"

# Root .env.local
if [ ! -f ".env.local" ]; then
    cat > .env.local << EOF
# Convex Deployment (auto-generated)
VITE_CONVEX_URL=$CONVEX_URL
EOF
    echo -e "${GREEN}✅ Created .env.local${NC}"
else
    # Update if missing
    if ! grep -q "VITE_CONVEX_URL" .env.local; then
        echo "VITE_CONVEX_URL=$CONVEX_URL" >> .env.local
        echo -e "${GREEN}✅ Updated .env.local${NC}"
    else
        echo -e "${GREEN}✅ .env.local already configured${NC}"
    fi
fi

# Backend .env
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << EOF
# Backend Configuration
CONVEX_URL=$CONVEX_URL

# Storage (optional - defaults to local)
# STORAGE_PROVIDER=local
# LOCAL_STORAGE_PATH=/tmp/rl-studio-models

# Compute (optional - defaults to local)
# COMPUTE_PROVIDER=local

# AWS (optional - uncomment to use S3/EC2)
# STORAGE_PROVIDER=s3
# S3_BUCKET_NAME=rl-studio-models
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
# AWS_DEFAULT_REGION=us-east-1
EOF
    echo -e "${GREEN}✅ Created backend/.env${NC}"
else
    # Update if missing
    if ! grep -q "CONVEX_URL" backend/.env; then
        echo "" >> backend/.env
        echo "CONVEX_URL=$CONVEX_URL" >> backend/.env
        echo -e "${GREEN}✅ Updated backend/.env${NC}"
    else
        echo -e "${GREEN}✅ backend/.env already configured${NC}"
    fi
fi

# 4. Summary
echo ""
echo -e "${BLUE}4. Setup Summary:${NC}"
echo ""
echo -e "${GREEN}✅ Convex configured: $CONVEX_URL${NC}"
echo -e "${GREEN}✅ Local data seeded${NC}"
echo -e "${GREEN}✅ Environment files created${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo ""
echo "1. Start backend:"
echo "   cd backend && source venv/bin/activate && python main.py"
echo ""
echo "2. Start frontend:"
echo "   npm run dev"
echo ""
echo "3. Configure cloud storage (optional):"
echo "   See INFRASTRUCTURE_SETUP.md for details"
echo ""
echo -e "${GREEN}✅ Local development setup complete!${NC}"

