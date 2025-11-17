#!/bin/bash
# Deploy RL Studio Backend to Google Cloud Run

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

# Get Convex URL
read -p "Enter your Convex URL (e.g., https://capable-goose-697.convex.cloud): " CONVEX_URL

if [ -z "$CONVEX_URL" ]; then
    echo "❌ Convex URL is required!"
    exit 1
fi

# Deploy to Cloud Run
echo "📦 Deploying..."
gcloud run deploy rl-studio-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "CONVEX_URL=$CONVEX_URL,PORT=8080" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Your backend URL:"
gcloud run services describe rl-studio-backend --region us-central1 --format 'value(status.url)'
echo ""
echo "🔗 Add this URL to Netlify as VITE_ROLLOUT_SERVICE_URL"

