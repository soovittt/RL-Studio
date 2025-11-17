# RL Studio Backend

Modular Python backend API for RL Studio, combining rollout service and job orchestration.

## Structure

```
backend/
├── rl_studio/              # Main package
│   ├── __init__.py
│   ├── main.py            # FastAPI app
│   ├── rollout/           # Rollout service module
│   │   ├── __init__.py
│   │   └── simulator.py
│   ├── training/          # Training job orchestration
│   │   ├── __init__.py
│   │   └── orchestrator.py
│   └── api/              # API routes
│       ├── __init__.py
│       ├── routes.py      # Main API routes
│       ├── health.py      # Health check
│       └── models.py      # Pydantic models
├── main.py                # Entry point
├── requirements.txt       # Dependencies
├── start.sh              # Startup script
└── Dockerfile            # Docker config
```

## Quick Start

### 1. Setup Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the Backend

```bash
# Option 1: Use startup script
./start.sh

# Option 2: Direct Python
python main.py

# Option 3: Uvicorn directly
uvicorn rl_studio.main:app --host 0.0.0.0 --port 8000 --reload
```

The service will start on `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Rollout Endpoints
```
POST /api/rollout          # Run rollout (HTTP)
WS   /ws/rollout           # Run rollout (WebSocket streaming)
```

### Training Job Endpoints
```
POST /api/training/launch          # Launch training job
GET  /api/training/status/{job_id}  # Get job status
POST /api/training/stop/{job_id}   # Stop job
```

## Environment Variables

Create a `.env` file:

```bash
PORT=8000
HOST=0.0.0.0
DEBUG=false
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
CONVEX_URL=your_convex_url
```

## Development

```bash
# Run with auto-reload
DEBUG=true python main.py

# Or with uvicorn
uvicorn rl_studio.main:app --reload
```

## Docker

```bash
# Build
docker build -f Dockerfile -t rl-studio-backend .

# Run
docker run -p 8000:8000 rl-studio-backend
```

## Testing

```bash
# Run test suite
python test_rollout.py

# Or manually test health
curl http://localhost:8000/health
```

## Frontend Integration

Add to your frontend `.env`:
```
VITE_ROLLOUT_SERVICE_URL=http://localhost:8000
```

The frontend `rolloutClient.ts` will automatically connect to this backend.
