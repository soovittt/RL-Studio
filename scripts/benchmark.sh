#!/bin/bash

# RL Studio Benchmarking Script
# Runs all performance benchmarks

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 RL Studio Performance Benchmarks${NC}"
echo ""

# Check if backend is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "⚠️  Backend not running. Starting benchmarks without API tests..."
    API_BENCHMARK=false
else
    API_BENCHMARK=true
fi

# Activate virtual environment
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
fi

# Run simulation benchmarks
echo -e "${GREEN}1. Running Simulation Benchmarks...${NC}"
python benchmarks/benchmark_simulation.py

# Run API benchmarks (if backend is running)
if [ "$API_BENCHMARK" = true ]; then
    echo -e "\n${GREEN}2. Running API Benchmarks...${NC}"
    python benchmarks/benchmark_api.py
else
    echo -e "\n${GREEN}2. Skipping API Benchmarks (backend not running)${NC}"
fi

# Run training benchmarks
echo -e "\n${GREEN}3. Running Training Benchmarks...${NC}"
python benchmarks/benchmark_training.py

echo -e "\n${GREEN}✅ All Benchmarks Complete!${NC}"
echo ""
echo "Results saved in benchmarks/ directory:"
echo "  - benchmark_results.json"
echo "  - api_benchmark_results.json"
echo "  - training_benchmark_results.json"

