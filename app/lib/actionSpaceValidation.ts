/**
 * Action Space Validation Utilities
 * Validates action space configurations and compatibility with environment types and dynamics
 */

import { ActionSpaceSpec, DynamicsSpec, EnvType } from './envSpec'

export interface ActionSpaceValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

/**
 * Validate action space configuration
 */
export function validateActionSpace(
  actionSpace: ActionSpaceSpec | undefined,
  envType: EnvType,
  dynamics?: DynamicsSpec
): ActionSpaceValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  // Check if action space exists
  if (!actionSpace) {
    errors.push('Action space is required')
    return { valid: false, errors, warnings, suggestions }
  }

  // Validate discrete action space
  if (actionSpace.type === 'discrete') {
    // Check actions array
    if (!Array.isArray(actionSpace.actions)) {
      errors.push('Discrete action space must have an actions array')
    } else if (actionSpace.actions.length === 0) {
      errors.push('At least one action is required')
    } else if (actionSpace.actions.length < 2) {
      warnings.push('Consider having at least 2 actions for meaningful control')
    }

    // Check for duplicate actions
    const duplicates = actionSpace.actions.filter(
      (action, index) => actionSpace.actions.indexOf(action) !== index
    )
    if (duplicates.length > 0) {
      errors.push(`Duplicate action names: ${[...new Set(duplicates)].join(', ')}`)
    }

    // Check for empty action names
    const emptyActions = actionSpace.actions.filter((action) => !action || action.trim() === '')
    if (emptyActions.length > 0) {
      errors.push('Action names cannot be empty')
    }

    // Check for invalid action names (spaces, special chars)
    const invalidActions = actionSpace.actions.filter(
      (action) => action && !/^[a-zA-Z0-9_]+$/.test(action)
    )
    if (invalidActions.length > 0) {
      errors.push(
        `Invalid action names (use letters, numbers, underscores only): ${invalidActions.join(', ')}`
      )
      suggestions.push('Use snake_case: e.g., "move_up" instead of "move up"')
    }

    // Environment compatibility
    if (envType === 'continuous2d') {
      warnings.push('Discrete actions in continuous environment - consider using continuous actions')
      suggestions.push('For continuous environments, continuous actions provide smoother control')
    }

    // Dynamics compatibility
    if (dynamics?.type === 'continuous-velocity') {
      warnings.push('Discrete actions with continuous velocity dynamics may be suboptimal')
      suggestions.push('Consider using continuous actions or grid-step dynamics')
    }
  }

  // Validate continuous action space
  if (actionSpace.type === 'continuous') {
    // Check dimensions
    if (typeof actionSpace.dimensions !== 'number') {
      errors.push('Continuous action space must have numeric dimensions')
    } else if (actionSpace.dimensions <= 0) {
      errors.push('Dimensions must be a positive integer')
    } else if (!Number.isInteger(actionSpace.dimensions)) {
      errors.push('Dimensions must be an integer')
    } else if (actionSpace.dimensions < 2 && envType === 'continuous2d') {
      warnings.push('For 2D environments, consider using 2 dimensions (X, Y velocity)')
    } else if (actionSpace.dimensions > 4) {
      warnings.push('High-dimensional action spaces may be harder to train')
    }

    // Check range
    if (!Array.isArray(actionSpace.range) || actionSpace.range.length !== 2) {
      errors.push('Continuous action space must have range [min, max]')
    } else {
      const [min, max] = actionSpace.range
      if (typeof min !== 'number' || typeof max !== 'number') {
        errors.push('Range values must be numbers')
      } else if (!isFinite(min) || !isFinite(max)) {
        errors.push('Range values must be finite numbers')
      } else if (min >= max) {
        errors.push('Range min must be less than max')
      } else if (Math.abs(min) > 10 || Math.abs(max) > 10) {
        warnings.push('Large action ranges may cause instability - consider normalizing to [-1, 1]')
      }
    }

    // Environment compatibility
    if (envType === 'grid') {
      warnings.push('Continuous actions in grid environment - consider using discrete actions')
      suggestions.push('Grid environments typically work better with discrete actions')
    }

    // Dynamics compatibility
    if (dynamics?.type === 'grid-step') {
      warnings.push('Continuous actions with grid-step dynamics may cause issues')
      suggestions.push('Consider using discrete actions or continuous-velocity dynamics')
    }
  }

  // General compatibility checks
  if (envType === 'grid' && actionSpace.type === 'continuous' && dynamics?.type === 'grid-step') {
    warnings.push('Mismatch: Continuous actions with grid-step dynamics')
    suggestions.push('For grid environments, use discrete actions with grid-step dynamics')
  }

  if (
    envType === 'continuous2d' &&
    actionSpace.type === 'discrete' &&
    dynamics?.type === 'continuous-velocity'
  ) {
    warnings.push('Mismatch: Discrete actions with continuous velocity dynamics')
    suggestions.push('For continuous environments, use continuous actions with continuous-velocity dynamics')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  }
}

/**
 * Validate dynamics configuration
 */
export function validateDynamics(
  dynamics: DynamicsSpec | undefined,
  actionSpace?: ActionSpaceSpec
): ActionSpaceValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  if (!dynamics) {
    errors.push('Dynamics configuration is required')
    return { valid: false, errors, warnings, suggestions }
  }

  if (dynamics.type === 'continuous-velocity') {
    if (typeof dynamics.maxSpeed !== 'number') {
      errors.push('Max speed must be a number')
    } else if (dynamics.maxSpeed <= 0) {
      errors.push('Max speed must be positive')
    } else if (dynamics.maxSpeed > 10) {
      warnings.push('Very high max speed may cause instability')
    }
  }

  if (dynamics.type === 'car-like') {
    if (typeof dynamics.maxSpeed !== 'number' || dynamics.maxSpeed <= 0) {
      errors.push('Max speed must be a positive number')
    }
    if (typeof dynamics.turnRate !== 'number' || dynamics.turnRate <= 0) {
      errors.push('Turn rate must be a positive number')
    }
  }

  // Compatibility with action space
  if (actionSpace) {
    if (actionSpace.type === 'discrete' && dynamics.type === 'continuous-velocity') {
      warnings.push('Discrete actions with continuous velocity - consider continuous actions')
    }
    if (actionSpace.type === 'continuous' && dynamics.type === 'grid-step') {
      warnings.push('Continuous actions with grid-step - consider discrete actions or continuous-velocity')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  }
}

/**
 * Get recommended action space for environment type
 */
export function getRecommendedActionSpace(envType: EnvType): ActionSpaceSpec {
  if (envType === 'grid') {
    return {
      type: 'discrete',
      actions: ['up', 'down', 'left', 'right'],
    }
  } else if (envType === 'continuous2d') {
    return {
      type: 'continuous',
      dimensions: 2,
      range: [-1, 1],
    }
  } else {
    // Default to discrete
    return {
      type: 'discrete',
      actions: ['up', 'down', 'left', 'right'],
    }
  }
}

/**
 * Get recommended dynamics for environment type
 */
export function getRecommendedDynamics(envType: EnvType): DynamicsSpec {
  if (envType === 'grid') {
    return { type: 'grid-step' }
  } else if (envType === 'continuous2d') {
    return { type: 'continuous-velocity', maxSpeed: 0.1 }
  } else {
    return { type: 'grid-step' }
  }
}

