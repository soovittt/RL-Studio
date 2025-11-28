#!/bin/bash
# Pre-PR Check Script - Run all CI checks locally before pushing
# This mirrors the CI Checklist workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Pre-PR Check - Running all CI checks locally${NC}"
echo "=================================================="
echo ""

FAILED=0
PASSED=0

# Function to run a check
run_check() {
    local name=$1
    local command=$2
    local dir=${3:-.}
    
    echo -e "${YELLOW}Running: ${name}${NC}"
    cd "$dir"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ ${name} passed${NC}"
        ((PASSED++))
        cd - > /dev/null
        return 0
    else
        echo -e "${RED}❌ ${name} failed${NC}"
        ((FAILED++))
        cd - > /dev/null
        return 1
    fi
}

# Frontend Checks
echo -e "${BLUE}=== Frontend Checks ===${NC}"
echo ""

run_check "Install Frontend Dependencies" "npm ci" . || FAILED=1

run_check "Lint Frontend (ESLint)" "npm run lint" . || FAILED=1

run_check "Check Frontend Formatting (Prettier)" "npm run format -- --check" . || FAILED=1

run_check "Type Check Frontend (TypeScript)" "npx tsc --noEmit" . || FAILED=1

run_check "Test Frontend (Vitest)" "npm test -- --run" . || FAILED=1

run_check "Build Frontend" "npm run build" . || FAILED=1

# Backend Checks
echo ""
echo -e "${BLUE}=== Backend Checks ===${NC}"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 not found. Skipping backend checks.${NC}"
    FAILED=1
else
    cd backend
    
    # Install backend dependencies
    if [ -f "requirements.txt" ]; then
        run_check "Install Backend Dependencies" "python3 -m pip install -q -r requirements.txt" backend || FAILED=1
    fi
    
    # Install linting tools
    run_check "Install Linting Tools" "python3 -m pip install -q flake8 black isort mypy" backend || FAILED=1
    
    # Run Flake8
    run_check "Lint Backend (Flake8)" "flake8 rl_studio --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics" backend || FAILED=1
    
    # Check Black formatting
    run_check "Check Backend Formatting (Black)" "black --check rl_studio" backend || FAILED=1
    
    # Check isort
    run_check "Check Import Sorting (isort)" "isort --check-only rl_studio" backend || FAILED=1
    
    # Type check with mypy
    run_check "Type Check Backend (mypy)" "mypy rl_studio --ignore-missing-imports --no-strict-optional || true" backend || FAILED=1
    
    # Run tests
    if [ -f "pytest.ini" ] || [ -d "rl_studio/api/tests" ]; then
        run_check "Test Backend (pytest)" "pytest --cov=rl_studio --cov-report=term" backend || FAILED=1
    else
        echo -e "${YELLOW}⚠️  No pytest config found, skipping backend tests${NC}"
    fi
    
    cd ..
fi

# Summary
echo ""
echo "=================================================="
echo -e "${BLUE}📊 Summary${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Ready to push.${NC}"
    exit 0
else
    echo -e "${RED}💥 Some checks failed. Please fix them before pushing.${NC}"
    echo ""
    echo "Quick fixes:"
    echo "  Frontend: npm run format"
    echo "  Backend:  cd backend && black rl_studio && isort rl_studio"
    exit 1
fi

