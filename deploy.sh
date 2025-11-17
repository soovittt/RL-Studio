#!/bin/bash

# RL Studio Deployment Script
# This script helps deploy RL Studio to Netlify and Convex

set -e

echo "🚀 RL Studio Deployment Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Convex is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js${NC}"
    exit 1
fi

# Step 1: Deploy Convex
echo -e "${YELLOW}📦 Step 1: Deploying Convex backend...${NC}"
echo ""
read -p "Deploy to production? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying Convex to production..."
    npx convex deploy --prod
    echo -e "${GREEN}✅ Convex deployed!${NC}"
else
    echo "Skipping Convex deployment. Run 'npx convex deploy --prod' manually."
fi

echo ""

# Step 2: Get Convex URL
echo -e "${YELLOW}🔗 Step 2: Configure Convex URL${NC}"
echo ""
echo "Please enter your Convex deployment URL:"
echo "(You can find this in the Convex dashboard or after deploying)"
read -p "Convex URL: " CONVEX_URL

if [ -z "$CONVEX_URL" ]; then
    echo -e "${RED}❌ Convex URL is required!${NC}"
    exit 1
fi

echo ""

# Step 3: Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo -e "${YELLOW}⚠️  Netlify CLI not found.${NC}"
    echo "Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Step 4: Set Netlify environment variable
echo -e "${YELLOW}🌐 Step 3: Setting Netlify environment variables...${NC}"
echo ""
netlify env:set VITE_CONVEX_URL "$CONVEX_URL" --prod

echo ""
echo -e "${GREEN}✅ Environment variable set!${NC}"
echo ""

# Step 5: Build and deploy
echo -e "${YELLOW}🏗️  Step 4: Building application...${NC}"
npm run build

echo ""
echo -e "${YELLOW}🚀 Step 5: Deploying to Netlify...${NC}"
echo ""
read -p "Deploy to production? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    netlify deploy --prod
    echo -e "${GREEN}✅ Deployment complete!${NC}"
else
    echo "Skipping Netlify deployment. Run 'netlify deploy --prod' manually."
fi

echo ""
echo -e "${GREEN}🎉 Deployment process complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your site is working at the Netlify URL"
echo "2. Check Convex dashboard for any errors"
echo "3. Test all features (create env, train, etc.)"
echo ""

