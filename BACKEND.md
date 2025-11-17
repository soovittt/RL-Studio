# Backend Architecture

## Overview

RL Studio backend consists of three main components:

1. **Convex Backend** - Database, realtime queries, HTTP endpoints
2. **Training Service** - Python service running on GPU instances
3. **Job Orchestrator** - Manages SkyPilot job lifecycle

## Convex Backend

### Schema
- `users` - User accounts
- `environments` - RL environment definitions
- `runs` - Training run metadata
- `metrics` - Time-series training metrics
- `rolloutFrames` - Training visualization frames

### Functions

#### Queries
- `environments:listRecent` - List recent environments
- `environments:get` - Get environment by ID
- `runs:listRecent` - List recent runs
- `runs:get` - Get run by ID
- `runs:getConfig` - Get full run config for training
- `metrics:get` - Get metrics for a run

#### Mutations
- `environments:create` - Create new environment
- `environments:update` - Update environment
- `runs:create` - Create new training run
- `runs:updateStatus` - Update run status
- `metrics:append` - Append training metrics

#### Actions
- `import:fromPaper` - Import environment from paper URL (Firecrawl)

#### HTTP Endpoints
- `POST /metrics` - Receive training metrics from training service
- `GET /health` - Health check

## Training Service

Located in `training/` directory. Runs on SkyPilot-managed GPU instances.

### Entry Point
`train.py` - Main training script

### Flow
1. Reads `RUN_ID` and `CONVEX_URL` from environment
2. Fetches run configuration from Convex
3. Creates Gym environment from spec
4. Trains using PPO or DQN (Stable-Baselines3)
5. Sends metrics to Convex HTTP endpoint every N steps

### Environment Variables
- `RUN_ID` - Training run ID
- `CONVEX_URL` - Convex deployment URL
- `METRICS_INTERVAL` - Steps between metric sends (default: 100)
- `FRAME_INTERVAL` - Steps between frame captures (default: 1000)

### Dependencies
- PyTorch
- Stable-Baselines3
- Gymnasium
- Requests

## Job Orchestrator

Located in `backend/` directory. Manages SkyPilot job lifecycle.

### Functions
- `launch_training_job(run_id, config)` - Launch new training job
- `get_job_status(job_id)` - Get job status
- `stop_job(job_id)` - Stop running job

### Usage

```python
from backend.job_orchestrator import launch_training_job

job_id = launch_training_job(
    run_id="abc123",
    config={
        "accelerator": "A10:1",
        "metrics_interval": 100,
    }
)
```

## API Endpoints

### Frontend API (TanStack Start)

#### `POST /api/training/launch`
Launch a new training job.

Request:
```json
{
  "runId": "run_id",
  "config": {
    "accelerator": "A10:1",
    "metrics_interval": 100
  }
}
```

Response:
```json
{
  "jobId": "sky-job-123456",
  "yaml": "..."
}
```

### Convex HTTP

#### `POST /metrics`
Receive training metrics from training service.

Request:
```json
{
  "runId": "run_id",
  "step": 1000,
  "reward": 0.5,
  "loss": 0.1,
  "entropy": 0.8
}
```

Response:
```json
{
  "success": true
}
```

## Data Flow

1. **User creates run** → Frontend calls `runs:create` mutation
2. **Launch job** → Frontend calls `/api/training/launch`
3. **Job orchestrator** → Generates SkyPilot YAML, launches job
4. **Training service** → Fetches config, starts training
5. **Metrics streaming** → Training service POSTs to `/metrics` endpoint
6. **Frontend** → Subscribes to Convex reactive query for live updates

## Deployment

### Convex
```bash
npx convex deploy
```

### Training Service
Deployed automatically via SkyPilot when jobs are launched.

### Job Orchestrator
Can run as:
- Separate service (Docker container)
- Serverless function (AWS Lambda, Cloudflare Workers)
- Called directly from API endpoint

## Environment Variables

### Training Service
- `CONVEX_URL` - Convex deployment URL
- `RUN_ID` - Training run ID
- `METRICS_INTERVAL` - Metrics send interval

### Job Orchestrator
- `CONVEX_URL` - Convex deployment URL
- SkyPilot cloud credentials (configured via `sky check`)

