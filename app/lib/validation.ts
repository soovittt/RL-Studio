/**
 * Input Validation Utilities
 * Comprehensive validation for environment specs, training configs, etc.
 */

import { EnvSpec } from './envSpec'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate environment specification
 */
export function validateEnvSpec(envSpec: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!envSpec) {
    return { valid: false, errors: ['Environment specification is required'], warnings: [] }
  }

  if (typeof envSpec !== 'object') {
    return { valid: false, errors: ['Environment specification must be an object'], warnings: [] }
  }

  // Validate world
  if (!envSpec.world) {
    errors.push('Missing required field: world')
  } else {
    const world = envSpec.world
    if (typeof world.width !== 'number' || world.width <= 0) {
      errors.push('World width must be a positive number')
    }
    if (typeof world.height !== 'number' || world.height <= 0) {
      errors.push('World height must be a positive number')
    }
    if (
      !world.coordinateSystem ||
      !['grid', 'cartesian', 'continuous'].includes(world.coordinateSystem)
    ) {
      errors.push('World coordinateSystem must be "grid", "cartesian", or "continuous"')
    }
  }

  // Validate agents
  if (!Array.isArray(envSpec.agents) || envSpec.agents.length === 0) {
    errors.push('Environment must have at least one agent')
  } else {
    envSpec.agents.forEach((agent: any, index: number) => {
      if (!agent.id) {
        errors.push(`Agent ${index} missing required field: id`)
      }
      if (!Array.isArray(agent.position) || agent.position.length < 2) {
        errors.push(`Agent ${index} must have a valid position [x, y]`)
      } else {
        const [x, y] = agent.position
        if (typeof x !== 'number' || typeof y !== 'number') {
          errors.push(`Agent ${index} position must be numeric`)
        }
        // Check bounds
        if (envSpec.world) {
          if (x < 0 || x >= envSpec.world.width || y < 0 || y >= envSpec.world.height) {
            warnings.push(`Agent ${index} position (${x}, ${y}) is out of bounds`)
          }
        }
      }
    })
  }

  // Validate action space
  if (!envSpec.actionSpace) {
    errors.push('Missing required field: actionSpace')
  } else {
    const actionSpace = envSpec.actionSpace
    if (actionSpace.type === 'discrete') {
      if (!Array.isArray(actionSpace.actions) || actionSpace.actions.length === 0) {
        errors.push('Discrete action space must have non-empty actions array')
      }
    } else if (actionSpace.type === 'continuous') {
      if (typeof actionSpace.dimensions !== 'number' || actionSpace.dimensions <= 0) {
        errors.push('Continuous action space must have positive dimensions')
      }
      if (!Array.isArray(actionSpace.range) || actionSpace.range.length < 2) {
        errors.push('Continuous action space must have range [min, max]')
      }
    }
  }

  // Validate rules
  if (!envSpec.rules) {
    warnings.push('No rules defined - environment may not have rewards or terminations')
  } else {
    if (!Array.isArray(envSpec.rules.rewards) || envSpec.rules.rewards.length === 0) {
      warnings.push('No reward rules defined')
    }
    if (!Array.isArray(envSpec.rules.terminations) || envSpec.rules.terminations.length === 0) {
      warnings.push('No termination rules defined')
    }
  }

  // Validate objects
  if (Array.isArray(envSpec.objects)) {
    envSpec.objects.forEach((obj: any, index: number) => {
      if (!obj.id) {
        warnings.push(`Object ${index} missing id (may cause issues)`)
      }
      if (Array.isArray(obj.position) && obj.position.length >= 2) {
        const [x, y] = obj.position
        if (typeof x === 'number' && typeof y === 'number' && envSpec.world) {
          if (
            x < -envSpec.world.width ||
            x > envSpec.world.width * 2 ||
            y < -envSpec.world.height ||
            y > envSpec.world.height * 2
          ) {
            warnings.push(`Object ${index} position (${x}, ${y}) is way out of bounds`)
          }
        }
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate training configuration
 */
export function validateTrainingConfig(config: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config) {
    return { valid: false, errors: ['Training configuration is required'], warnings: [] }
  }

  // Validate algorithm
  const validAlgorithms = ['ppo', 'dqn', 'a2c', 'bc', 'imitation', 'random']
  if (!config.algorithm || !validAlgorithms.includes(config.algorithm.toLowerCase())) {
    errors.push(`Algorithm must be one of: ${validAlgorithms.join(', ')}`)
  }

  // Validate hyperparameters
  if (config.hyperparams) {
    const hp = config.hyperparams

    if (hp.learning_rate !== undefined) {
      if (typeof hp.learning_rate !== 'number' || hp.learning_rate <= 0 || hp.learning_rate > 1) {
        errors.push('Learning rate must be a number between 0 and 1')
      }
    }

    if (hp.gamma !== undefined) {
      if (typeof hp.gamma !== 'number' || hp.gamma < 0 || hp.gamma > 1) {
        errors.push('Gamma (discount factor) must be between 0 and 1')
      }
    }

    if (hp.steps !== undefined) {
      if (typeof hp.steps !== 'number' || hp.steps <= 0 || hp.steps > 100000000) {
        errors.push('Training steps must be a positive number (max 100M)')
      }
      if (hp.steps < 1000) {
        warnings.push('Training steps is very low - may not converge')
      }
    }
  }

  // Validate accelerator
  if (config.accelerator) {
    const validAccelerators = ['A10:1', 'A100:1', 'T4:1', 'V100:1']
    if (!validAccelerators.includes(config.accelerator)) {
      warnings.push(`Accelerator ${config.accelerator} may not be available or optimal`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 1000) // Limit length
}

/**
 * Validate and sanitize environment name
 */
export function validateEnvironmentName(name: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!name || typeof name !== 'string') {
    errors.push('Environment name is required and must be a string')
    return { valid: false, errors, warnings }
  }

  if (name.length === 0) {
    errors.push('Environment name cannot be empty')
  }

  if (name.length > 100) {
    errors.push('Environment name must be 100 characters or less')
  }

  // Check for potentially dangerous content
  const sanitized = sanitizeInput(name)
  if (sanitized !== name) {
    warnings.push('Environment name contained potentially unsafe characters and was sanitized')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate rollout request
 */
export function validateRolloutRequest(request: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!request) {
    return { valid: false, errors: ['Rollout request is required'], warnings: [] }
  }

  // Validate envSpec
  if (!request.envSpec) {
    errors.push('Missing required field: envSpec')
  } else {
    const envValidation = validateEnvSpec(request.envSpec)
    errors.push(...envValidation.errors)
    warnings.push(...envValidation.warnings)
  }

  // Validate policy
  const validPolicies = ['random', 'greedy', 'trained_model']
  if (!request.policy || !validPolicies.includes(request.policy)) {
    errors.push(`Policy must be one of: ${validPolicies.join(', ')}`)
  }

  // Validate maxSteps
  if (request.maxSteps !== undefined) {
    if (typeof request.maxSteps !== 'number' || request.maxSteps < 1 || request.maxSteps > 10000) {
      errors.push('maxSteps must be a number between 1 and 10000')
    }
  }

  // Validate batchSize if provided
  if (request.batchSize !== undefined) {
    if (typeof request.batchSize !== 'number' || request.batchSize < 1 || request.batchSize > 100) {
      errors.push('batchSize must be a number between 1 and 100')
    }
  }

  // Validate trained_model policy requirements
  if (request.policy === 'trained_model') {
    if (!request.runId && !request.modelUrl) {
      errors.push('trained_model policy requires either runId or modelUrl')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
