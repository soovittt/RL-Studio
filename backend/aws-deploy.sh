#!/bin/bash
# AWS Deployment Script for RL Studio Rollout Service
# Deploys to AWS ECS/Fargate or EC2

set -e

# Configuration
SERVICE_NAME="rl-studio-rollout"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-rl-studio-rollout}"
CLUSTER_NAME="${CLUSTER_NAME:-rl-studio-cluster}"

echo "🚀 Deploying RL Studio Rollout Service to AWS..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -f Dockerfile.rollout -t ${SERVICE_NAME}:latest .

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

# Create ECR repository if it doesn't exist
echo "📋 Creating ECR repository..."
aws ecr describe-repositories --repository-names ${ECR_REPO} --region ${AWS_REGION} || \
aws ecr create-repository --repository-name ${ECR_REPO} --region ${AWS_REGION}

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Tag and push image
echo "🏷️  Tagging and pushing image..."
docker tag ${SERVICE_NAME}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

echo "✅ Deployment complete!"
echo "📝 Image URI: ${ECR_URI}:latest"
echo ""
echo "Next steps:"
echo "1. Create ECS task definition using the image: ${ECR_URI}:latest"
echo "2. Deploy to ECS Fargate or EC2"
echo "3. Configure load balancer (optional)"
echo ""
echo "For ECS Fargate deployment, use the provided task-definition.json"

