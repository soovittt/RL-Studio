#!/bin/bash
# Deploy RL Studio Frontend to Google Cloud Run

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 RL Studio Frontend - Google Cloud Run Deployment${NC}"
echo "=================================================="
echo ""

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found${NC}"
    echo "Install it with: brew install --cask google-cloud-sdk"
    exit 1
fi

# Configuration
SERVICE_NAME="rl-studio-frontend"
REGION="us-central1"

# Try to get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -n "$CURRENT_PROJECT" ]; then
    PROJECT_ID="$CURRENT_PROJECT"
    echo -e "${GREEN}✅ Using current gcloud project: $PROJECT_ID${NC}"
else
    PROJECT_ID="${GCP_PROJECT_ID:-290319355713}"
    echo -e "${YELLOW}⚠️  No current project set, using: $PROJECT_ID${NC}"
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Service: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Project: $PROJECT_ID"
echo ""

# Check if user is authenticated
echo -e "${YELLOW}Checking gcloud authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not authenticated with gcloud${NC}"
    echo "Run: gcloud auth login"
    exit 1
fi
echo -e "${GREEN}✅ Authenticated${NC}"
echo ""

# Set project
gcloud config set project $PROJECT_ID 2>/dev/null || echo "⚠️  Could not set project, will use --project flag"
echo ""

# Environment variables (build-time for Vite)
BACKEND_URL="${BACKEND_URL:-https://rl-studio-backend-290319355713.us-central1.run.app}"
CONVEX_URL="${CONVEX_URL:-https://capable-goose-697.convex.cloud}"

echo -e "${GREEN}✅ Environment Variables:${NC}"
echo "  VITE_API_URL=$BACKEND_URL"
echo "  VITE_CONVEX_URL=$CONVEX_URL"
echo "  VITE_ROLLOUT_SERVICE_URL=$BACKEND_URL"
echo "  VITE_TRAINING_SERVICE_URL=$BACKEND_URL"
echo ""

# Deploy to Cloud Run
echo -e "${YELLOW}📦 Deploying to Google Cloud Run...${NC}"
echo "This may take a few minutes..."
echo ""

cd "$(dirname "$0")"

# Build the Docker image using Cloud Build with cloudbuild.yaml
echo -e "${YELLOW}Building Docker image with Cloud Build...${NC}"
TAG=$(date +%Y%m%d-%H%M%S)
gcloud builds submit \
    --config cloudbuild-frontend.yaml \
    --substitutions _VITE_API_URL=$BACKEND_URL,_VITE_CONVEX_URL=$CONVEX_URL,_VITE_ROLLOUT_SERVICE_URL=$BACKEND_URL,_VITE_TRAINING_SERVICE_URL=$BACKEND_URL,_TAG=$TAG \
    --project $PROJECT_ID

# Deploy the built image to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/rl-studio-frontend:latest \
    --region $REGION \
    --allow-unauthenticated \
    --platform managed \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --concurrency 80 \
    --project $PROJECT_ID

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""

# Get the service URL
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format="value(status.url)" 2>/dev/null || echo "")

if [ -n "$FRONTEND_URL" ]; then
    echo "Your frontend is available at:"
    echo -e "${GREEN}$FRONTEND_URL${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test the frontend:"
    echo "   curl $FRONTEND_URL"
    echo ""
    echo "2. Check logs:"
    echo "   gcloud run services logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID --limit 50"
    echo ""
    echo "3. Update CORS on backend to allow this origin:"
    echo "   $FRONTEND_URL"
else
    echo "Get the service URL with:"
    echo "   gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(status.url)'"
fi
echo ""

