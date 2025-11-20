#!/bin/bash
# Deploy RL Studio Backend to Google Cloud Run

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 RL Studio Backend - Google Cloud Run Deployment${NC}"
echo "=================================================="
echo ""

# Check if gcloud CLI is installed and activate if needed
if ! command -v gcloud &> /dev/null; then
    # Try to source Google Cloud SDK if installed but not in PATH
    if [ -f ~/google-cloud-sdk/path.zsh.inc ]; then
        echo -e "${YELLOW}Activating Google Cloud SDK...${NC}"
        source ~/google-cloud-sdk/path.zsh.inc
        source ~/google-cloud-sdk/completion.zsh.inc
    elif [ -f ~/google-cloud-sdk/path.bash.inc ]; then
        echo -e "${YELLOW}Activating Google Cloud SDK...${NC}"
        source ~/google-cloud-sdk/path.bash.inc
        source ~/google-cloud-sdk/completion.bash.inc
    fi
    
    # Check again after sourcing
    if ! command -v gcloud &> /dev/null; then
        # Try adding to PATH manually
        if [ -f ~/google-cloud-sdk/bin/gcloud ]; then
            export PATH="$PATH:$HOME/google-cloud-sdk/bin"
        elif [ -f /usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud ]; then
            export PATH="$PATH:/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin"
        fi
    fi
    
    # Final check
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}❌ gcloud CLI not found${NC}"
        echo "Install it with: brew install --cask google-cloud-sdk"
        echo "Or if already installed, add to your shell:"
        echo "  source ~/google-cloud-sdk/path.zsh.inc"
        exit 1
    fi
fi

# Configuration
SERVICE_NAME="rl-studio-backend"
REGION="us-central1"
PROJECT_ID="290319355713"  # Update this if needed

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

# Set project (PROJECT_ID might be a project number, so we'll use --project flag)
echo -e "${YELLOW}Setting GCP project...${NC}"
# Try to get project ID from project number if it's numeric
if [[ $PROJECT_ID =~ ^[0-9]+$ ]]; then
    # It's a project number, try to get the project ID
    ACTUAL_PROJECT_ID=$(gcloud projects describe $PROJECT_ID --format="value(projectId)" 2>/dev/null || echo "")
    if [ -n "$ACTUAL_PROJECT_ID" ]; then
        echo "   Found project ID: $ACTUAL_PROJECT_ID (from project number $PROJECT_ID)"
        PROJECT_ID=$ACTUAL_PROJECT_ID
    else
        echo "   ⚠️  Using project number $PROJECT_ID (will use --project flag)"
    fi
fi
gcloud config set project $PROJECT_ID 2>/dev/null || echo "⚠️  Could not set project, will use --project flag"
echo ""

# Get CONVEX_URL from environment or prompt
if [ -z "$CONVEX_URL" ]; then
    echo -e "${YELLOW}Enter your Convex URL (or press Enter to skip):${NC}"
    read -p "CONVEX_URL: " CONVEX_URL
fi

# Build environment variables
ENV_VARS=""
if [ -n "$CONVEX_URL" ]; then
    ENV_VARS="--set-env-vars CONVEX_URL=$CONVEX_URL"
    echo -e "${GREEN}✅ CONVEX_URL will be set${NC}"
else
    echo -e "${YELLOW}⚠️  CONVEX_URL not provided (some features may not work)${NC}"
fi

# Optional: Set CORS_ORIGINS if provided
if [ -n "$CORS_ORIGINS" ]; then
    ENV_VARS="$ENV_VARS --set-env-vars CORS_ORIGINS=$CORS_ORIGINS"
    echo -e "${GREEN}✅ CORS_ORIGINS will be set${NC}"
fi

echo ""

# Deploy to Cloud Run
echo -e "${YELLOW}📦 Deploying to Google Cloud Run...${NC}"
echo "This may take a few minutes..."
echo ""

cd "$(dirname "$0")"

# Use --project flag to handle project number vs project ID
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --platform managed \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --project 290319355713 \
    $ENV_VARS

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Your backend is available at:"
gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
echo ""
echo "Next steps:"
echo "1. Update Netlify environment variables with the backend URL"
echo "2. Test the backend: curl https://rl-studio-backend-290319355713.us-central1.run.app/health"
echo "3. Check logs: gcloud run services logs read $SERVICE_NAME --region $REGION"
echo ""

