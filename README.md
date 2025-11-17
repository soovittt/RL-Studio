# RL Studio

A full-stack platform for designing reinforcement learning environments, running GPU-backed training, and monitoring agents in real-time.

## 🚀 Features

- **Visual Environment Editor**: Design gridworld and continuous environments with drag-and-drop interface
- **Real-time Training**: Launch GPU-backed training jobs on AWS/GCP/Azure via SkyPilot
- **Live Metrics**: Monitor training progress with real-time metrics visualization
- **RL Analysis**: Advanced analysis including reward decomposition, trajectory visualization, policy entropy, and termination analysis
- **Multi-Agent Support**: Design and train multi-agent environments
- **Code Generation**: Auto-generate production-ready Gymnasium environments and training scripts
- **Paper Import**: Import environment specifications from arXiv/blog URLs via Firecrawl
- **Algorithm Support**: PPO, DQN, A2C, Behavior Cloning, Imitation Learning, and more

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

## 🚀 Deployment

### Quick Deploy

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for the fastest way to deploy.

### Full Deployment Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions.

**TL;DR:**
1. Deploy Convex: `npx convex deploy --prod`
2. Deploy to Netlify: Connect GitHub repo → Set `VITE_CONVEX_URL` → Deploy

## 📚 Documentation

- **[Deployment Guide](./DEPLOYMENT.md)**: Complete deployment instructions
- **[Quick Deploy](./QUICK_DEPLOY.md)**: Fast deployment guide
- **[Backend Architecture](./BACKEND.md)**: Detailed backend documentation
- **[Contributing](./CONTRIBUTING.md)**: Contribution guidelines

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
```

### Backend (Convex)

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

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📝 License

MIT

## 🙏 Acknowledgments

Built with:
- [Stable-Baselines3](https://github.com/DLR-RM/stable-baselines3)
- [Gymnasium](https://github.com/Farama-Foundation/Gymnasium)
- [SkyPilot](https://github.com/skypilot-org/skypilot)
- [TanStack Start](https://tanstack.com/start)
- [Convex](https://www.convex.dev/)
