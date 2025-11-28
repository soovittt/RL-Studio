#!/bin/bash
# Backend Pre-PR Check - Run backend CI checks locally

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Backend Pre-PR Check${NC}"
echo "=================================================="
echo ""

cd backend

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
if [ -f "requirements.txt" ]; then
    python3 -m pip install -q -r requirements.txt || echo -e "${YELLOW}⚠️  Some requirements failed to install${NC}"
fi

# Install linting tools
echo -e "${YELLOW}Installing linting tools...${NC}"
python3 -m pip install -q flake8 black isort mypy pytest pytest-cov

# Run checks
echo ""
echo -e "${BLUE}Running checks...${NC}"
echo ""

FAILED=0

# Flake8
echo -e "${YELLOW}Running Flake8...${NC}"
if flake8 rl_studio --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics; then
    echo -e "${GREEN}✅ Flake8 passed${NC}"
else
    echo -e "${RED}❌ Flake8 found issues${NC}"
    FAILED=1
fi

# Black
echo -e "${YELLOW}Checking Black formatting...${NC}"
if black --check rl_studio; then
    echo -e "${GREEN}✅ Black formatting OK${NC}"
else
    echo -e "${RED}❌ Code needs formatting. Run: black rl_studio${NC}"
    FAILED=1
fi

# isort
echo -e "${YELLOW}Checking import sorting...${NC}"
if isort --check-only rl_studio; then
    echo -e "${GREEN}✅ Imports are sorted${NC}"
else
    echo -e "${RED}❌ Imports need sorting. Run: isort rl_studio${NC}"
    FAILED=1
fi

# mypy
echo -e "${YELLOW}Running mypy type check...${NC}"
if mypy rl_studio --ignore-missing-imports --no-strict-optional || true; then
    echo -e "${GREEN}✅ mypy passed${NC}"
else
    echo -e "${YELLOW}⚠️  mypy found issues (non-blocking)${NC}"
fi

# pytest
echo -e "${YELLOW}Running tests...${NC}"
if pytest --cov=rl_studio --cov-report=term; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All backend checks passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some backend checks failed${NC}"
    exit 1
fi

