#!/bin/bash
# Deploy RL Studio Backend to Google Cloud Run
# Automatically reads from .env if available, otherwise prompts for input

set -e

echo "🚀 Deploying to Google Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found!"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No Google Cloud project set!"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Project: $PROJECT_ID"

# Try to load from .env file
if [ -f ".env" ]; then
    echo ""
    echo "📝 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
    echo "✅ Loaded .env file"
else
    echo ""
    echo "📝 .env file not found. Enter environment variables:"
    echo ""
fi

# Get required variables (prompt if not in .env)
if [ -z "$CONVEX_URL" ]; then
    read -p "Convex URL (required): " CONVEX_URL
    if [ -z "$CONVEX_URL" ]; then
        echo "❌ Convex URL is required!"
        exit 1
    fi
fi

if [ -z "$OPENAI_API_KEY" ]; then
    read -p "OpenAI API Key (required): " OPENAI_API_KEY
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "❌ OpenAI API Key is required!"
        exit 1
    fi
fi

if [ -z "$FIRECRAWL_API_KEY" ]; then
    read -p "Firecrawl API Key (required): " FIRECRAWL_API_KEY
    if [ -z "$FIRECRAWL_API_KEY" ]; then
        echo "❌ Firecrawl API Key is required!"
        exit 1
    fi
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    read -p "AWS Access Key ID (required): " AWS_ACCESS_KEY_ID
    if [ -z "$AWS_ACCESS_KEY_ID" ]; then
        echo "❌ AWS Access Key ID is required!"
        exit 1
    fi
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    read -p "AWS Secret Access Key (required): " AWS_SECRET_ACCESS_KEY
    if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo "❌ AWS Secret Access Key is required!"
        exit 1
    fi
fi

if [ -z "$AWS_DEFAULT_REGION" ]; then
    read -p "AWS Default Region (required, default: us-east-1): " AWS_DEFAULT_REGION
    AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
fi

# Build environment variables string (all required)
ENV_VARS="CONVEX_URL=$CONVEX_URL,OPENAI_API_KEY=$OPENAI_API_KEY,FIRECRAWL_API_KEY=$FIRECRAWL_API_KEY,AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY,AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION"

# Deploy to Cloud Run
echo ""
echo "📦 Deploying with environment variables..."
gcloud run deploy rl-studio-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "$ENV_VARS" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Getting backend URL..."
BACKEND_URL=$(gcloud run services describe rl-studio-backend --region us-central1 --format 'value(status.url)')
echo "Backend URL: $BACKEND_URL"
echo ""

# Update frontend .env file with backend URL
FRONTEND_ENV="../.env"
if [ -f "$FRONTEND_ENV" ]; then
    echo "🔧 Updating frontend .env with backend URL..."
    # Remove existing VITE_ROLLOUT_SERVICE_URL if present
    sed -i.bak '/^VITE_ROLLOUT_SERVICE_URL=/d' "$FRONTEND_ENV" 2>/dev/null || sed -i '' '/^VITE_ROLLOUT_SERVICE_URL=/d' "$FRONTEND_ENV" 2>/dev/null
    # Add new VITE_ROLLOUT_SERVICE_URL
    echo "" >> "$FRONTEND_ENV"
    echo "# Backend API URL (auto-set by deploy script)" >> "$FRONTEND_ENV"
    echo "VITE_ROLLOUT_SERVICE_URL=$BACKEND_URL" >> "$FRONTEND_ENV"
    echo "✅ Updated frontend .env with: VITE_ROLLOUT_SERVICE_URL=$BACKEND_URL"
    rm -f "$FRONTEND_ENV.bak" 2>/dev/null
else
    echo "⚠️  Frontend .env not found at $FRONTEND_ENV"
    echo "   Please manually add: VITE_ROLLOUT_SERVICE_URL=$BACKEND_URL"
fi

# Also update backend .env with the URL (for reference)
if [ -f ".env" ]; then
    echo "🔧 Updating backend .env with backend URL..."
    # Remove existing BACKEND_URL if present
    sed -i.bak '/^BACKEND_URL=/d' ".env" 2>/dev/null || sed -i '' '/^BACKEND_URL=/d' ".env" 2>/dev/null
    # Add new BACKEND_URL
    echo "" >> ".env"
    echo "# Backend URL (auto-set by deploy script)" >> ".env"
    echo "BACKEND_URL=$BACKEND_URL" >> ".env"
    echo "✅ Updated backend .env with: BACKEND_URL=$BACKEND_URL"
    rm -f ".env.bak" 2>/dev/null
fi

echo ""
echo "🎉 Deployment and configuration complete!"
echo ""
echo "📋 Summary:"
echo "   Backend URL: $BACKEND_URL"
echo "   Frontend .env: Updated with VITE_ROLLOUT_SERVICE_URL"
echo "   Backend .env: Updated with BACKEND_URL"
echo ""
echo "💡 Next steps:"
echo "   1. Restart your frontend dev server to pick up the new URL"
echo "   2. Add VITE_ROLLOUT_SERVICE_URL to Netlify environment variables if deploying"

