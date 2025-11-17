#!/bin/bash
# Start RL Studio Backend

set -e

cd "$(dirname "$0")"

echo "🚀 Starting RL Studio Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start the unified backend
echo "✅ Starting backend on port ${PORT:-8000}..."
python main.py

