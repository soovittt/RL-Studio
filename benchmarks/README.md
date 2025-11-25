# RL Studio Benchmarking Suite

Performance benchmarks for RL Studio to track performance over time and ensure we meet our targets.

## Targets

- **Simulation**: 1M+ steps/second for simple environments
- **API Response**: < 50ms (p95)
- **Frontend**: 60 FPS rendering
- **Training Setup**: < 100ms environment creation

## Running Benchmarks

### Quick Run

```bash
./scripts/benchmark.sh
```

### Individual Benchmarks

```bash
# Simulation benchmarks
python benchmarks/benchmark_simulation.py

# API benchmarks (requires backend running)
python benchmarks/benchmark_api.py http://localhost:8000

# Training benchmarks
python benchmarks/benchmark_training.py
```

## Results

Results are saved as JSON files:
- `benchmark_results.json` - Simulation performance
- `api_benchmark_results.json` - API response times
- `training_benchmark_results.json` - Training setup times

## CI Integration

Add to CI/CD pipeline to track performance regressions:

```yaml
- name: Run Benchmarks
  run: ./scripts/benchmark.sh
```

