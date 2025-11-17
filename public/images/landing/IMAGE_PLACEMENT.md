# Image Placement Instructions

## Required Images

Place the following 4 images in this directory (`public/images/landing/`):

### 1. `environment-builder.png`
**Description:** Main RL Studio interface showing:
- Environment editor with 3D grid canvas
- Object palette (Wall, Agent, Goal, Obstacle, etc.)
- Left panel with environment management
- Right panel with structure settings
- Bottom panel with rollout preview

**Use for:** "Universal Environment Builder" section

### 2. `rollout-visualizer.png`
**Description:** Rollout preview showing:
- 3D grid environment visualization
- Agent navigation path
- Rollout controls (Random Policy, Max Steps, Run Rollout)
- Real-time metrics (Reward, Steps, Success)
- Step-by-step action details

**Use for:** "Live Rollout Visualizer" section

### 3. `training-config.png`
**Description:** New Training Run modal showing:
- Algorithm selection (PPO, DQN)
- RL Concepts checkboxes
- Hyperparameters (Learning Rate, Gamma, Total Steps, etc.)
- GPU Accelerator selection
- Training configuration options

**Use for:** "One-Click Training" section

### 4. `export-dialog.png`
**Description:** File save dialog showing:
- Export functionality
- File browser interface
- Save options for exporting environments and code

**Use for:** "Export Everything" section

## Image Requirements

- **Format:** PNG (recommended) or JPG
- **Optimization:** Compress images for web (aim for < 500KB each)
- **Aspect Ratio:** Flexible, but maintain original proportions
- **Resolution:** At least 1200px width for best quality on retina displays

## How to Add Images

1. Take screenshots of the RL Studio application for each feature
2. Save them with the exact filenames listed above
3. Place them in: `public/images/landing/`
4. The landing page will automatically display them

## Fallback

If images are missing, the landing page will show placeholder text instead.

