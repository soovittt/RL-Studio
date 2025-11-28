# Pre-PR Checks

Before pushing your code, run the pre-PR checks locally to catch issues early:

## Quick Check (All Checks)

```bash
npm run pre-pr
```

This runs all frontend and backend checks that CI will run.

## Individual Checks

### Frontend Only
```bash
npm run pre-pr:frontend
# Or use the script directly:
bash scripts/pre-pr-frontend.sh
```

### Backend Only
```bash
npm run pre-pr:backend
# Or use the script directly:
bash scripts/pre-pr-backend.sh
```

## What Gets Checked

### Frontend
- ✅ Install dependencies (`npm ci`)
- ✅ Lint with ESLint
- ✅ Format check with Prettier
- ✅ Type check with TypeScript
- ✅ Run tests with Vitest
- ✅ Build verification

### Backend
- ✅ Install dependencies (`pip install -r requirements.txt`)
- ✅ Lint with Flake8
- ✅ Format check with Black
- ✅ Import sorting check with isort
- ✅ Type check with mypy
- ✅ Run tests with pytest

## Quick Fixes

If checks fail:

**Frontend:**
```bash
npm run format  # Fix formatting
```

**Backend:**
```bash
cd backend
black rl_studio      # Fix formatting
isort rl_studio      # Fix import sorting
```
