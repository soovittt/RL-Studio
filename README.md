# RL Studio

<div align="center">

**A full-stack platform for designing reinforcement learning environments, running GPU-backed training, and monitoring agents in real-time.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)

</div>

---

## 🚀 Features

- **Visual Environment Editor**: Design gridworld and continuous environments with drag-and-drop interface
- **Real-time Training**: Launch GPU-backed training jobs on AWS/GCP/Azure via SkyPilot
- **Live Metrics**: Monitor training progress with real-time metrics visualization
- **RL Analysis**: Advanced analysis including reward decomposition, trajectory visualization, policy entropy, and termination analysis
- **Multi-Agent Support**: Design and train multi-agent environments
- **Code Generation**: Auto-generate production-ready Gymnasium environments and training scripts
- **Paper Import**: Import environment specifications from arXiv/blog URLs via Firecrawl
- **Algorithm Support**: PPO, DQN, A2C, Behavior Cloning, Imitation Learning, and more

## 🎯 What It Can Do

### Universal Environment Builder

Design grid worlds, 2D continuous environments, custom geometry, and multi-agent setups — all powered by the same SceneGraph engine.

<div align="center">
  <img src="public/images/landing/environment-builder.png" alt="RL Studio environment editor" width="800" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>
</div>

### Live Rollout Visualizer

Step through episodes, inspect state transitions, debug reward triggers, and preview learned policies in real-time.

<div align="center">
  <img src="public/images/landing/rollout-visualizer.png" alt="RL Studio rollout preview" width="800" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>
</div>

### One-Click Training

Launch GPU training jobs with PPO, DQN, A2C, or other algorithms. Monitor progress in real time with metrics, logs, and rollouts streamed back into the studio.

<div align="center">
  <img src="public/images/landing/training-config.png" alt="RL Studio training configuration" width="800" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>
</div>

### Export Everything

Generate Gymnasium-compatible Python code, training scripts, config files, and complete project bundles.

<div align="center">
  <img src="public/images/landing/export-dialog.png" alt="RL Studio export functionality" width="800" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>
</div>

---

## 🛠️ Tech Stack

- **Frontend**: TanStack Start (React SSR), TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), Convex (realtime DB)
- **Training**: SkyPilot (GPU orchestration), Stable-Baselines3, PyTorch
- **RL Libraries**: Gymnasium, NumPy, SciPy, scikit-learn
- **Deployment**: Netlify (frontend), Convex Cloud (backend), AWS/GCP/Azure (training)

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Convex account (free tier available)
- AWS account (for GPU training jobs)
- OpenAI API key (optional, for code generation)

## 🏃 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd "RL Studio"
npm install
```

### 2. Set Up Convex

```bash
npx convex dev
```

This will:
- Create a Convex account if needed
- Set up your local development environment
- Generate a deployment URL

### 3. Configure Environment Variables

Create `.env` in the root directory:

```bash
# Convex (required)
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# OpenAI (optional, for code generation)
OPENAI_API_KEY=sk-your-api-key-here

# Firecrawl (optional, for paper import)
FIRECRAWL_API_KEY=your-firecrawl-key
```

### 4. Set Up Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set up AWS credentials for training (add to backend/.env)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_DEFAULT_REGION=us-east-1

# Start backend server
python main.py
```

The backend will automatically:
- Install SkyPilot if needed
- Configure AWS credentials from `.env`
- Set up infrastructure for training jobs

### 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser!

## 🎯 Core Workflows

### Creating an Environment

1. Click "New Environment" in the dashboard
2. Choose environment type (Grid or Continuous)
3. Design your environment:
   - Add agents, goals, obstacles
   - Define reward rules
   - Set termination conditions
   - Configure action/observation spaces
4. Save your environment

### Running Rollouts

1. Open your environment
2. Go to "Rollout Preview" tab
3. Configure rollout settings (max steps, policy)
4. Click "Run Rollout"
5. View results and analysis in real-time

### Launching Training

1. Open your environment
2. Click "Launch Training"
3. Configure training settings:
   - **Algorithm**: PPO, DQN, A2C, BC, Imitation, or Random
   - **Hyperparameters**: Learning rate, gamma, total steps, etc.
   - **GPU**: Select GPU type (A10:1 recommended)
   - **Parallel Environments**: Number of parallel envs
4. Click "Launch Training"
5. Monitor progress in real-time

### RL Analysis

After running rollouts, use the "RL Analysis" tab to:
- **Reward Decomposition**: See which rules contribute most to rewards
- **Trajectory Visualization**: View agent paths and detect attractors
- **Policy Entropy**: Measure exploration vs exploitation
- **Termination Analysis**: Understand why episodes end

## 🏗️ Project Structure

```
RL Studio/
├── app/                    # Frontend (TanStack Start)
│   ├── components/         # React components
│   ├── lib/               # Utilities and clients
│   └── routes/            # Page routes
├── backend/               # Python backend
│   ├── rl_studio/        # Core RL logic
│   │   ├── api/          # FastAPI endpoints
│   │   ├── rollout/      # Rollout simulator
│   │   ├── training/     # Training orchestration
│   │   ├── analysis/     # RL analysis (NumPy/SciPy)
│   │   └── codegen/      # Code generation
│   └── main.py           # Backend entry point
├── convex/               # Convex backend
│   ├── environments.ts   # Environment schema
│   ├── runs.ts           # Training runs
│   └── metrics.ts        # Training metrics
└── training/             # Training scripts
    └── train.py          # Main training script
```

## 🔧 Development

```bash
# Frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run linter

# Backend
cd backend
python main.py  # Start FastAPI server

# Convex
npx convex dev   # Start Convex dev server
```

## 🚢 Deployment

### Frontend (Netlify)

```bash
npm run build
# Deploy dist/ to Netlify
# Set environment variable: VITE_CONVEX_URL
```

### Backend (Multiple Options)

#### Option 1: Google Cloud Run (Recommended)

```bash
cd backend
./deploy-gcp.sh
```

Or manually:
```bash
gcloud run deploy rl-studio-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "CONVEX_URL=$CONVEX_URL,PORT=8080"
```

#### Option 2: AWS (ECS/Fargate)

```bash
cd backend
./aws-deploy.sh
```

#### Option 3: Railway (Easiest)

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo
4. Add Service → Empty Service
5. Root Directory: `backend`
6. Build Command: `pip install -r requirements.txt`
7. Start Command: `python main.py`
8. Add environment variable: `CONVEX_URL`

### Convex

```bash
npx convex deploy
```

### Training Infrastructure

Training jobs are automatically deployed via SkyPilot when launched from the UI. No manual deployment needed!

## 💰 Cost Estimates

- **A10:1 GPU**: ~$1.00/hour (on-demand) or ~$0.30/hour (spot)
- **1M training steps**: ~2-4 hours = ~$2-4 (on-demand) or ~$0.60-1.20 (spot)

**Recommendation**: Enable spot instances for 70% cost savings!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT

## 🙏 Acknowledgments

Built with:
- [Stable-Baselines3](https://github.com/DLR-RM/stable-baselines3)
- [Gymnasium](https://github.com/Farama-Foundation/Gymnasium)
- [SkyPilot](https://github.com/skypilot-org/skypilot)
- [TanStack Start](https://tanstack.com/start)
- [Convex](https://www.convex.dev/)

---

<div align="center">

**Made with ❤️ for the RL community**

[Get Started](#-quick-start) • [View Features](#-features) • [Deploy](#-deployment)

</div>
