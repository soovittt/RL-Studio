#!/bin/bash
# Frontend Pre-PR Check - Run frontend CI checks locally

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Frontend Pre-PR Check${NC}"
echo "=================================================="
echo ""

FAILED=0

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
if npm ci; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Running checks...${NC}"
echo ""

# ESLint
echo -e "${YELLOW}Running ESLint...${NC}"
if npm run lint; then
    echo -e "${GREEN}✅ ESLint passed${NC}"
else
    echo -e "${RED}❌ ESLint found issues${NC}"
    FAILED=1
fi

# Prettier
echo -e "${YELLOW}Checking formatting...${NC}"
if npm run format -- --check; then
    echo -e "${GREEN}✅ Formatting OK${NC}"
else
    echo -e "${RED}❌ Code needs formatting. Run: npm run format${NC}"
    FAILED=1
fi

# TypeScript
echo -e "${YELLOW}Running TypeScript check...${NC}"
if npx tsc --noEmit; then
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
else
    echo -e "${RED}❌ TypeScript errors found${NC}"
    FAILED=1
fi

# Tests
echo -e "${YELLOW}Running tests...${NC}"
if npm test -- --run; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    FAILED=1
fi

# Build
echo -e "${YELLOW}Building...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All frontend checks passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some frontend checks failed${NC}"
    exit 1
fi

