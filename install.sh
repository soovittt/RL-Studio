#!/bin/bash

# RL Studio - Super Easy Installation Script
# One command to install everything: ./install.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

print_header "🚀 RL Studio Installation"
echo "Installing RL Studio - High-Performance RL Platform"
echo "OS Detected: $OS"
echo ""

# Check prerequisites
print_header "📋 Checking Prerequisites"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
    
    # Check version (need >= 18)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_error "Node.js version 18+ required. Found: $NODE_VERSION"
        exit 1
    fi
else
    print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python found: $PYTHON_VERSION"
    
    # Check version (need >= 3.9)
    PYTHON_MAJOR=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1)
    PYTHON_MINOR=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f2)
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
        print_error "Python 3.9+ required. Found: $PYTHON_VERSION"
        exit 1
    fi
else
    print_error "Python 3 not found. Please install Python 3.9+"
    exit 1
fi

# Check pip
if command_exists pip3; then
    print_success "pip3 found"
else
    print_warning "pip3 not found. Installing..."
    if [ "$OS" == "macos" ]; then
        python3 -m ensurepip --upgrade
    else
        print_error "Please install pip3 manually"
        exit 1
    fi
fi

# Check git
if command_exists git; then
    print_success "Git found: $(git --version)"
else
    print_warning "Git not found (optional, but recommended)"
fi

print_success "All prerequisites met!"
echo ""

# Install Frontend Dependencies
print_header "📦 Installing Frontend Dependencies"

if [ -f "package.json" ]; then
    print_info "Installing npm packages..."
    npm install
    print_success "Frontend dependencies installed"
else
    print_error "package.json not found"
    exit 1
fi

# Install Backend Dependencies
print_header "🐍 Installing Backend Dependencies"

if [ -f "backend/requirements.txt" ]; then
    print_info "Installing Python packages..."
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "backend/venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv backend/venv
    fi
    
    # Activate virtual environment
    if [ "$OS" == "windows" ]; then
        source backend/venv/Scripts/activate
    else
        source backend/venv/bin/activate
    fi
    
    # Upgrade pip
    print_info "Upgrading pip..."
    pip install --upgrade pip --quiet
    
    # Install requirements
    print_info "Installing Python packages (this may take a few minutes)..."
    pip install -r backend/requirements.txt --quiet
    
    print_success "Backend dependencies installed"
else
    print_error "backend/requirements.txt not found"
    exit 1
fi

# Setup Convex
print_header "🔧 Setting Up Convex"

if command_exists npx; then
    print_info "Checking Convex CLI..."
    
    if ! npx convex --version >/dev/null 2>&1; then
        print_warning "Convex CLI not found. Installing..."
        npm install -g convex
    fi
    
    print_info "Convex CLI ready"
    print_warning "You'll need to configure Convex separately:"
    echo "  1. Sign up at https://convex.dev"
    echo "  2. Run: npx convex dev"
    echo "  3. Follow the prompts to create a project"
else
    print_warning "npx not available. Install Convex CLI manually: npm install -g convex"
fi

# Create .env files
print_header "⚙️  Creating Environment Files"

# Frontend .env
if [ ! -f ".env" ]; then
    print_info "Creating .env file..."
    cat > .env << EOF
# Frontend Environment Variables
VITE_CONVEX_URL=
VITE_ROLLOUT_SERVICE_URL=http://localhost:8000
VITE_SENTRY_DSN=
EOF
    print_success "Created .env file"
    print_warning "Please set VITE_CONVEX_URL in .env"
else
    print_info ".env file already exists"
fi

# Backend .env
if [ ! -f "backend/.env" ]; then
    print_info "Creating backend/.env file..."
    cat > backend/.env << EOF
# Backend Environment Variables

# Convex
CONVEX_URL=

# OpenAI (for LLM features)
OPENAI_API_KEY=

# AWS (optional - for GPU training)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# GCP (optional - alternative to AWS)
GOOGLE_APPLICATION_CREDENTIALS=

# Azure (optional - alternative to AWS)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
AZURE_SUBSCRIPTION_ID=

# Storage (S3/GCS/Azure Blob - optional)
STORAGE_PROVIDER=local
S3_BUCKET=
GCS_BUCKET=
AZURE_STORAGE_ACCOUNT=

# SkyPilot (optional - for GPU training)
SKYPILOT_CONFIG_PATH=
EOF
    print_success "Created backend/.env file"
    print_warning "Please configure backend/.env with your credentials"
else
    print_info "backend/.env file already exists"
fi

# Setup local development data
print_header "🌱 Setting Up Local Development Data"

if command_exists npx; then
    print_info "Local data seeding will be handled by Convex"
    print_info "Run 'npx convex dev' to start Convex and seed data"
else
    print_warning "Convex CLI not available. Skip local data seeding."
fi

# Create install summary
print_header "✅ Installation Complete!"

echo "RL Studio has been installed successfully!"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Configure Convex:"
echo "   cd $(pwd)"
echo "   npx convex dev"
echo "   (Follow prompts to create/connect project)"
echo ""
echo "2. Set environment variables:"
echo "   - Edit .env (frontend)"
echo "   - Edit backend/.env (backend)"
echo ""
echo "3. Start the development servers:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   cd backend"
echo "   source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo "   python -m rl_studio.main"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   npm run dev"
echo ""
echo "   Terminal 3 (Convex):"
echo "   npx convex dev"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Documentation: See README.md for more details"
echo ""
echo "🚀 Happy Training!"

# Make install script executable
chmod +x install.sh

print_success "Installation script is ready!"

