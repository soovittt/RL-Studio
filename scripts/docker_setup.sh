#!/bin/bash

# Docker Setup Script for RL Studio
# Sets up Docker environment for development or production

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

MODE=${1:-dev}

echo -e "${BLUE}🐳 RL Studio Docker Setup${NC}"
echo ""

if [ "$MODE" = "prod" ]; then
    echo -e "${YELLOW}Production Mode${NC}"
    COMPOSE_FILE="docker-compose.prod.yml"
else
    echo -e "${GREEN}Development Mode${NC}"
    COMPOSE_FILE="docker-compose.yml"
fi

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker not found. Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose not found. Please install Docker Compose"
    exit 1
fi

# Create .env files if they don't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
VITE_CONVEX_URL=
VITE_ROLLOUT_SERVICE_URL=http://localhost:8000
EOF
fi

if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env file..."
    cat > backend/.env << EOF
CONVEX_URL=
OPENAI_API_KEY=
STORAGE_PROVIDER=local
EOF
fi

echo -e "${GREEN}✅ Environment files ready${NC}"
echo ""
echo "Starting Docker containers..."
echo ""

# Build and start
docker-compose -f $COMPOSE_FILE up --build -d

echo ""
echo -e "${GREEN}✅ Docker containers started!${NC}"
echo ""
echo "Services:"
echo "  - Backend: http://localhost:8000"
echo "  - Frontend: http://localhost:3000"
echo "  - Redis: localhost:6379"
echo ""
echo "Commands:"
echo "  View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "  Stop: docker-compose -f $COMPOSE_FILE down"
echo "  Restart: docker-compose -f $COMPOSE_FILE restart"

