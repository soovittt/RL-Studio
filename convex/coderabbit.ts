/**
 * CodeRabbit Integration Service
 * Provides code review, validation, and hyperparameter suggestions
 */

import { action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'

// CodeRabbit API types
interface CodeRabbitReviewRequest {
  files: Array<{
    path: string
    content: string
  }>
  language?: string
  context?: string
}

interface CodeRabbitReviewResponse {
  success: boolean
  review?: {
    score: number
    issues: Array<{
      severity: 'error' | 'warning' | 'info'
      file: string
      line?: number
      message: string
      suggestion?: string
      category: string
    }>
    summary: string
    suggestions: Array<{
      title: string
      description: string
      priority: 'high' | 'medium' | 'low'
    }>
  }
  error?: string
}

interface CodeRabbitHyperparameterResponse {
  success: boolean
  recommendations?: {
    learning_rate: number
    gamma: number
    entropy_coef?: number
    batch_size?: number
    n_steps?: number
    justification: string
    confidence: number
  }
  error?: string
}

/**
 * CodeRabbit Service Client
 */
class CodeRabbitService {
  private apiKey: string
  private baseUrl = 'https://api.coderabbit.ai/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async reviewCode(
    files: Array<{ path: string; content: string }>,
    context?: string
  ): Promise<CodeRabbitReviewResponse> {
    // CodeRabbit API integration
    // Note: This is a placeholder - actual CodeRabbit API may differ
    const response = await fetch(`${this.baseUrl}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        files,
        language: 'python',
        context: context || 'RL environment code',
      }),
    })

    if (!response.ok) {
      throw new Error(`CodeRabbit API error: ${response.statusText}`)
    }

    return await response.json()
  }

  async suggestHyperparameters(
    envSpec: any,
    algorithm: string
  ): Promise<CodeRabbitHyperparameterResponse> {
    // Analyze environment and suggest hyperparameters
    const response = await fetch(`${this.baseUrl}/suggest-hyperparameters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        envSpec,
        algorithm,
      }),
    })

    if (!response.ok) {
      throw new Error(`CodeRabbit API error: ${response.statusText}`)
    }

    return await response.json()
  }

  async reviewScript(
    script: string,
    scriptType: 'reward' | 'termination' | 'custom'
  ): Promise<CodeRabbitReviewResponse> {
    const response = await fetch(`${this.baseUrl}/review-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        script,
        scriptType,
        language: 'python',
      }),
    })

    if (!response.ok) {
      throw new Error(`CodeRabbit API error: ${response.statusText}`)
    }

    return await response.json()
  }
}

/**
 * Local code analyzer (fallback when CodeRabbit API unavailable)
 */
class LocalCodeAnalyzer {
  analyzePythonCode(code: string): NonNullable<CodeRabbitReviewResponse['review']> {
    const issues: Array<{
      severity: 'error' | 'warning' | 'info'
      file: string
      line?: number
      message: string
      suggestion?: string
      category: string
    }> = []
    const suggestions: Array<{
      title: string
      description: string
      priority: 'high' | 'medium' | 'low'
    }> = []
    let score = 100

    // Check for common RL environment issues
    const lines = code.split('\n')

    // Check for missing docstrings
    if (!code.includes('"""') && !code.includes("'''")) {
      issues.push({
        severity: 'info',
        file: 'environment.py',
        message: 'Missing docstring for environment class',
        category: 'documentation',
        suggestion: 'Add a docstring describing the environment',
      })
      score -= 5
    }

    // Check for reward-related issues
    if (code.includes('reward') && !code.includes('reward =')) {
      issues.push({
        severity: 'warning',
        file: 'environment.py',
        message: 'Reward calculation may be incomplete',
        category: 'logic',
        suggestion: 'Ensure reward is properly initialized and calculated',
      })
      score -= 10
    }

    // Check for termination issues
    if (!code.includes('terminated') && !code.includes('done')) {
      issues.push({
        severity: 'error',
        file: 'environment.py',
        message: 'Missing termination condition',
        category: 'logic',
        suggestion: 'Add termination conditions to prevent infinite episodes',
      })
      score -= 20
    }

    // Check for step counter
    if (!code.includes('self.step') && !code.includes('step_count')) {
      issues.push({
        severity: 'warning',
        file: 'environment.py',
        message: 'No step counter found - may cause infinite episodes',
        category: 'logic',
        suggestion: 'Add a step counter and max_steps limit',
      })
      score -= 15
    }

    // Check for reset method
    if (!code.includes('def reset')) {
      issues.push({
        severity: 'error',
        file: 'environment.py',
        message: 'Missing reset() method - required by Gymnasium API',
        category: 'api_compliance',
        suggestion: 'Implement reset() method that returns initial observation',
      })
      score -= 25
    }

    // Check for step method
    if (!code.includes('def step')) {
      issues.push({
        severity: 'error',
        file: 'environment.py',
        message: 'Missing step() method - required by Gymnasium API',
        category: 'api_compliance',
        suggestion: 'Implement step(action) method',
      })
      score -= 25
    }

    // Check for PEP8 issues (basic)
    lines.forEach((line, idx) => {
      if (line.length > 100) {
        issues.push({
          severity: 'info',
          file: 'environment.py',
          line: idx + 1,
          message: 'Line exceeds 100 characters (PEP8)',
          category: 'style',
          suggestion: 'Break long lines for better readability',
        })
        score -= 1
      }
    })

    // Check for potential infinite loops
    if (code.includes('while True') && !code.includes('break') && !code.includes('return')) {
      issues.push({
        severity: 'warning',
        file: 'environment.py',
        message: 'Potential infinite loop detected',
        category: 'logic',
        suggestion: 'Ensure loop has proper exit conditions',
      })
      score -= 15
    }

    // Check for reward hacking vulnerabilities
    if (code.includes('reward') && code.includes('+=') && code.match(/reward\s*\+=\s*reward/)) {
      issues.push({
        severity: 'warning',
        file: 'environment.py',
        message: 'Potential reward hacking - reward depends on itself',
        category: 'security',
        suggestion: 'Review reward calculation logic',
      })
      score -= 10
    }

    // Generate suggestions
    if (score < 80) {
      suggestions.push({
        title: 'Improve Code Quality',
        description: 'Address the issues found to improve code quality and reliability',
        priority: 'high',
      })
    }

    if (issues.some((i: { category: string }) => i.category === 'api_compliance')) {
      suggestions.push({
        title: 'Fix API Compliance',
        description: 'Ensure all required Gymnasium API methods are implemented',
        priority: 'high',
      })
    }

    if (issues.some((i: { category: string }) => i.category === 'logic')) {
      suggestions.push({
        title: 'Review Logic',
        description: 'Check for potential bugs in environment logic',
        priority: 'medium',
      })
    }

    return {
      score: Math.max(0, score),
      issues,
      summary: `Found ${issues.length} issues. Code quality score: ${Math.max(0, score)}/100`,
      suggestions,
    }
  }

  suggestHyperparameters(
    envSpec: any,
    algorithm: string
  ): CodeRabbitHyperparameterResponse['recommendations'] {
    const isGrid = envSpec.envType === 'grid'
    const isContinuous = envSpec.envType === 'continuous2d'
    const worldSize = envSpec.world?.width * (envSpec.world?.height || 1) || 100
    const hasSparseReward =
      (envSpec.rules?.rewards || []).length === 0 ||
      (envSpec.rules?.rewards || []).every((r: { value?: number }) => r.value === 0 || !r.value)

    let learningRate = 3e-4
    let gamma = 0.99
    let entropyCoef = 0.01
    let batchSize = 64
    let nSteps = 256

    // Adjust based on environment type
    if (isContinuous) {
      learningRate = 3e-4
      gamma = 0.995
      entropyCoef = 0.01
      batchSize = 64
      nSteps = 256
    } else if (isGrid) {
      learningRate = 1e-3
      gamma = 0.99
      entropyCoef = 0.01
      batchSize = 32
      nSteps = 128
    }

    // Adjust for sparse rewards
    if (hasSparseReward) {
      learningRate *= 0.5 // Lower LR for sparse rewards
      gamma = 0.99 // Keep gamma high for sparse rewards
      entropyCoef = 0.05 // Higher entropy for exploration
    }

    // Adjust for large world
    if (worldSize > 400) {
      nSteps = 512
      batchSize = 128
    }

    // Algorithm-specific adjustments
    if (algorithm === 'dqn') {
      learningRate = 1e-4
      gamma = 0.99
      batchSize = 32
      nSteps = 1 // DQN doesn't use n_steps
    }

    const justification = [
      `Learning rate ${learningRate}: ${isContinuous ? 'Good for continuous control' : 'Standard for discrete actions'}`,
      `Gamma ${gamma}: ${hasSparseReward ? 'High discount for sparse rewards' : 'Standard discount factor'}`,
      `Entropy ${entropyCoef}: ${hasSparseReward ? 'Higher for exploration with sparse rewards' : 'Standard exploration bonus'}`,
      `Batch size ${batchSize}: ${worldSize > 400 ? 'Larger for complex environments' : 'Standard batch size'}`,
    ].join('; ')

    return {
      learning_rate: learningRate,
      gamma,
      entropy_coef: entropyCoef,
      batch_size: batchSize,
      n_steps: nSteps,
      justification,
      confidence: 0.75, // Local analyzer has moderate confidence
    }
  }
}

// Convex Actions
export const reviewExportedCode = action({
  args: {
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
      })
    ),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const codeRabbitApiKey = process.env.CODERABBIT_API_KEY
    const analyzer = new LocalCodeAnalyzer()

    // Try CodeRabbit API if available
    if (codeRabbitApiKey) {
      try {
        const service = new CodeRabbitService(codeRabbitApiKey)
        const result = await service.reviewCode(args.files, args.context)
        if (result.success && result.review) {
          return result
        }
      } catch (error) {
        console.warn('CodeRabbit API unavailable, using local analyzer:', error)
      }
    }

    // Fallback to local analyzer
    const reviews = args.files.map((file) => ({
      file: file.path,
      review: analyzer.analyzePythonCode(file.content),
    }))

    // Combine reviews
    const allIssues = reviews.flatMap((r) =>
      r.review.issues.map((i: any) => ({ ...i, file: r.file }))
    )
    const allSuggestions = reviews.flatMap((r) => r.review.suggestions)
    const avgScore = reviews.reduce((sum, r) => sum + r.review.score, 0) / reviews.length

    return {
      success: true,
      review: {
        score: Math.round(avgScore),
        issues: allIssues,
        summary: `Found ${allIssues.length} issues across ${reviews.length} files. Average score: ${Math.round(avgScore)}/100`,
        suggestions: allSuggestions,
      },
    }
  },
})

export const validateEnvironmentCode = action({
  args: {
    envSpec: v.any(),
  },
  handler: async (ctx, args) => {
    // Generate temporary code
    const { exportProject } = await import('../app/lib/universalExporter')
    const files = exportProject({
      envSpec: args.envSpec,
      algorithm: 'ppo',
      hyperparams: {
        learning_rate: 3e-4,
        gamma: 0.99,
        steps: 1000000,
      },
    })

    // Review the generated code directly (avoid circular dependency)
    const analyzer = new LocalCodeAnalyzer()
    const reviews = Object.entries(files).map(([path, content]) => ({
      file: path,
      review: analyzer.analyzePythonCode(content as string),
    }))

    // Combine reviews
    const allIssues = reviews.flatMap((r) =>
      r.review.issues.map((i: any) => ({ ...i, file: r.file }))
    )
    const allSuggestions = reviews.flatMap((r) => r.review.suggestions)
    const avgScore = reviews.reduce((sum, r) => sum + r.review.score, 0) / reviews.length

    return {
      success: true,
      review: {
        score: Math.round(avgScore),
        issues: allIssues,
        summary: `Found ${allIssues.length} issues across ${reviews.length} files. Code quality score: ${Math.round(avgScore)}/100`,
        suggestions: allSuggestions,
      },
    }
  },
})

export const suggestHyperparameters = action({
  args: {
    envSpec: v.any(),
    algorithm: v.string(),
  },
  handler: async (ctx, args) => {
    const codeRabbitApiKey = process.env.CODERABBIT_API_KEY
    const analyzer = new LocalCodeAnalyzer()

    // Try CodeRabbit API if available
    if (codeRabbitApiKey) {
      try {
        const service = new CodeRabbitService(codeRabbitApiKey)
        const result = await service.suggestHyperparameters(args.envSpec, args.algorithm)
        if (result.success && result.recommendations) {
          return result
        }
      } catch (error) {
        console.warn('CodeRabbit API unavailable, using local analyzer:', error)
      }
    }

    // Fallback to local analyzer
    const recommendations = analyzer.suggestHyperparameters(args.envSpec, args.algorithm)

    return {
      success: true,
      recommendations,
    }
  },
})

export const analyzeFailure = action({
  args: {
    runId: v.id('runs'),
  },
  handler: async (ctx, args) => {
    // Load run, evaluation, and metrics
    const run = await ctx.runQuery(api.runs.get, { id: args.runId })
    if (!run) {
      return {
        success: false,
        error: 'Run not found',
      }
    }

    const evaluation = await ctx.runQuery(api.evaluations.get, { runId: args.runId })

    const metrics = await ctx.runQuery(api.metrics.get, { runId: args.runId })

    // Analyze patterns
    const analysis: {
      issues: Array<{
        type: string
        severity: 'high' | 'medium' | 'low'
        message: string
        suggestion: string
      }>
      summary: string
      recommendations: Array<{
        action: string
        description: string
        priority: 'high' | 'medium' | 'low'
      }>
    } = {
      issues: [],
      summary: '',
      recommendations: [],
    }

    // Check evaluation results
    if (evaluation) {
      const meanReward = evaluation.meanReward
      const successRate = evaluation.successRate || 0
      const stdReward = evaluation.stdReward
      const meanLength = evaluation.meanLength

      // Low reward analysis
      if (meanReward < 0) {
        analysis.issues.push({
          type: 'low_reward',
          severity: 'high',
          message: `Mean reward is negative (${meanReward.toFixed(2)}). The agent is performing worse than random.`,
          suggestion:
            'Check reward function - rewards may be misaligned or too sparse. Consider reward shaping.',
        })
        analysis.recommendations.push({
          action: 'adjust_reward',
          description:
            'Review and adjust reward function. Consider adding intermediate rewards for progress.',
          priority: 'high',
        })
      } else if (meanReward < 10 && successRate < 0.1) {
        analysis.issues.push({
          type: 'poor_performance',
          severity: 'high',
          message: `Low mean reward (${meanReward.toFixed(2)}) and success rate (${(successRate * 100).toFixed(1)}%).`,
          suggestion:
            'Agent is not learning effectively. Try lower learning rate or different algorithm.',
        })
        analysis.recommendations.push({
          action: 'lower_learning_rate',
          description: `Try reducing learning rate from ${(run.hyperparams as any)?.learning_rate || 3e-4} to ${((run.hyperparams as any)?.learning_rate || 3e-4) * 0.5}`,
          priority: 'high',
        })
      }

      // High variance analysis
      if (stdReward > Math.abs(meanReward) * 2) {
        analysis.issues.push({
          type: 'high_variance',
          severity: 'medium',
          message: `High variance in rewards (std: ${stdReward.toFixed(2)} vs mean: ${meanReward.toFixed(2)}).`,
          suggestion:
            'High variance suggests exploration issues. Try increasing entropy coefficient or using curriculum learning.',
        })
        analysis.recommendations.push({
          action: 'increase_exploration',
          description:
            'Increase entropy coefficient or add exploration bonus to improve stability.',
          priority: 'medium',
        })
      }

      // Success rate analysis
      if (successRate < 0.2 && meanReward > 0) {
        analysis.issues.push({
          type: 'low_success_rate',
          severity: 'medium',
          message: `Low success rate (${(successRate * 100).toFixed(1)}%) despite positive rewards.`,
          suggestion:
            'Reward function may not align with goal. Consider adding large terminal reward for success.',
        })
        analysis.recommendations.push({
          action: 'adjust_reward',
          description:
            'Add large terminal reward (e.g., +100) when goal is reached to align rewards with success.',
          priority: 'medium',
        })
      }

      // Episode length analysis
      if (meanLength < 10) {
        analysis.issues.push({
          type: 'early_termination',
          severity: 'medium',
          message: `Episodes terminate very early (avg: ${meanLength.toFixed(1)} steps).`,
          suggestion: 'Environment may be too difficult or termination conditions too strict.',
        })
        analysis.recommendations.push({
          action: 'review_termination',
          description:
            'Review termination conditions. Consider making environment easier or increasing max steps.',
          priority: 'medium',
        })
      } else if (meanLength > 1000) {
        analysis.issues.push({
          type: 'long_episodes',
          severity: 'low',
          message: `Episodes are very long (avg: ${meanLength.toFixed(1)} steps).`,
          suggestion:
            'Agent may be stuck or environment too large. Consider reducing world size or adding time limits.',
        })
      }
    }

    // Analyze training metrics
    if (metrics && metrics.length > 0) {
      const rewards = metrics.map((m: any) => m.reward || 0).filter((r: any) => r !== undefined)
      if (rewards.length > 10) {
        const earlyReward =
          rewards
            .slice(0, Math.floor(rewards.length / 3))
            .reduce((a: number, b: number) => a + b, 0) / Math.floor(rewards.length / 3)
        const lateReward =
          rewards
            .slice(-Math.floor(rewards.length / 3))
            .reduce((a: number, b: number) => a + b, 0) / Math.floor(rewards.length / 3)

        // No convergence analysis
        if (lateReward <= earlyReward * 1.1) {
          analysis.issues.push({
            type: 'no_convergence',
            severity: 'high',
            message:
              'Training shows no improvement. Reward did not increase significantly during training.',
            suggestion:
              'Learning rate may be too high or too low. Try different hyperparameters or algorithm.',
          })
          analysis.recommendations.push({
            action: 'try_different_hyperparams',
            description:
              'Try different learning rate or switch algorithm (e.g., PPO to DQN or vice versa).',
            priority: 'high',
          })
        }
      }
    }

    // Generate summary
    if (analysis.issues.length === 0) {
      analysis.summary = 'No major issues detected. Training appears to be progressing normally.'
    } else {
      const highIssues = analysis.issues.filter((i) => i.severity === 'high').length
      const mediumIssues = analysis.issues.filter((i) => i.severity === 'medium').length
      analysis.summary = `Found ${analysis.issues.length} issue(s): ${highIssues} high priority, ${mediumIssues} medium priority.`
    }

    return {
      success: true,
      analysis,
    }
  },
})

export const suggestRewardFunction = action({
  args: {
    runId: v.id('runs'),
    envSpec: v.any(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.runQuery(api.runs.get, { id: args.runId })
    if (!run) {
      return {
        success: false,
        error: 'Run not found',
      }
    }

    const evaluation = await ctx.runQuery(api.evaluations.get, { runId: args.runId })

    const suggestions: Array<{ type: string; description: string; example: string }> = []

    if (evaluation) {
      const successRate = evaluation.successRate || 0
      const meanReward = evaluation.meanReward

      // If low success rate, suggest terminal reward
      if (successRate < 0.3) {
        suggestions.push({
          type: 'terminal_reward',
          description:
            'Add large terminal reward when goal is reached to align rewards with success.',
          example: 'if goal_reached: reward += 100.0',
        })
      }

      // If negative rewards, suggest shaping
      if (meanReward < 0) {
        suggestions.push({
          type: 'reward_shaping',
          description:
            'Add intermediate rewards for progress (e.g., distance to goal, steps taken).',
          example: 'reward += -0.1 * distance_to_goal  # Closer = better',
        })
      }

      // If high variance, suggest smoothing
      if (evaluation.stdReward > Math.abs(meanReward) * 2) {
        suggestions.push({
          type: 'reward_smoothing',
          description: 'Consider reward normalization or clipping to reduce variance.',
          example: 'reward = np.clip(reward, -1.0, 1.0)  # Clip rewards',
        })
      }
    }

    return {
      success: true,
      suggestions,
    }
  },
})

export const reviewCustomScript = action({
  args: {
    script: v.string(),
    scriptType: v.union(v.literal('reward'), v.literal('termination'), v.literal('custom')),
  },
  handler: async (ctx, args) => {
    const codeRabbitApiKey = process.env.CODERABBIT_API_KEY
    const analyzer = new LocalCodeAnalyzer()

    // Try CodeRabbit API if available
    if (codeRabbitApiKey) {
      try {
        const service = new CodeRabbitService(codeRabbitApiKey)
        const result = await service.reviewScript(args.script, args.scriptType)
        if (result.success && result.review) {
          return result
        }
      } catch (error) {
        console.warn('CodeRabbit API unavailable, using local analyzer:', error)
      }
    }

    // Fallback to local analyzer
    const review = analyzer.analyzePythonCode(args.script)

    // Add script-specific checks
    const scriptIssues = [...review.issues] as Array<{
      severity: 'error' | 'warning' | 'info'
      file: string
      line?: number
      message: string
      suggestion?: string
      category: string
    }>

    if (args.scriptType === 'reward') {
      // Check for reward-specific issues
      if (!args.script.includes('return')) {
        scriptIssues.push({
          severity: 'error',
          file: 'reward_script.py',
          message: 'Reward script must return a value',
          category: 'logic',
          suggestion: 'Add return statement with reward value',
        })
      }

      if (args.script.includes('reward') && args.script.match(/reward\s*=\s*reward/)) {
        scriptIssues.push({
          severity: 'warning',
          file: 'reward_script.py',
          message: 'Potential reward hacking - reward depends on itself',
          category: 'security',
          suggestion: 'Review reward calculation logic',
        })
      }
    }

    if (args.scriptType === 'termination') {
      // Check for termination-specific issues
      if (
        !args.script.includes('return') ||
        (!args.script.includes('True') && !args.script.includes('False'))
      ) {
        scriptIssues.push({
          severity: 'error',
          file: 'termination_script.py',
          message: 'Termination script must return True or False',
          category: 'logic',
          suggestion: 'Add return True or return False statement',
        })
      }
    }

    return {
      success: true,
      review: {
        ...review,
        issues: scriptIssues,
        summary: `Found ${scriptIssues.length} issues in ${args.scriptType} script`,
      },
    }
  },
})
