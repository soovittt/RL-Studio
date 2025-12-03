/**
 * SkyPilot YAML generation utilities
 */
export function generateSkyPilotYAML(config: any): string {
  return `name: rl-studio-training-${config.runId}

resources:
  accelerators: ${config.accelerator || 'A10:1'}

setup: |
  pip install -r requirements.txt

run: |
  python train.py

envs:
  RUN_ID: ${config.runId}
  CONVEX_URL: ${process.env.VITE_CONVEX_URL}
`
}
