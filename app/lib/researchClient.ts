/**
 * Research Client - API functions for research features via GraphQL
 * Hyperparameter sweeps, statistical analysis, model versioning, experiment tracking
 */

import { query, mutate } from './graphqlClient'

// ============================================================================
// Hyperparameter Sweep
// ============================================================================

export interface HyperparameterSweepRequest {
  algorithm: string
  env_spec: any
  base_config: Record<string, any>
  search_space: Record<string, any[]>
  search_type: 'grid' | 'random' | 'bayesian'
  n_trials: number
  seed?: number
}

export interface HyperparameterSweepResponse {
  success: boolean
  n_trials: number
  trials: Array<Record<string, any>>
  error?: string
}

export async function generateHyperparameterSweep(
  request: HyperparameterSweepRequest
): Promise<HyperparameterSweepResponse> {
  const gqlMutation = `
    mutation GenerateHyperparameterSweep($input: HyperparameterSweepInput!) {
      generateHyperparameterSweep(input: $input) {
        success
        nTrials
        trials {
          trialNumber
          hyperparameters
          expectedReward
        }
        error
      }
    }
  `

  const variables = {
    input: {
      algorithm: request.algorithm,
      envSpec: JSON.stringify(request.env_spec),
      baseConfig: JSON.stringify(request.base_config),
      searchSpace: JSON.stringify(request.search_space),
      searchType: request.search_type,
      nTrials: request.n_trials,
      seed: request.seed,
    },
  }

  try {
    const data = await mutate<{ generateHyperparameterSweep: any }>(gqlMutation, variables)

    if (!data?.generateHyperparameterSweep) {
      throw new Error('Failed to generate hyperparameter sweep')
    }

    const result = data.generateHyperparameterSweep

    // Convert GraphQL response to expected format
    const trials =
      result.trials?.map((trial: any) => ({
        ...JSON.parse(trial.hyperparameters),
        expected_reward: trial.expectedReward,
      })) || []

    return {
      success: result.success,
      n_trials: result.nTrials,
      trials,
      error: result.error,
    }
  } catch (error) {
    console.error('Hyperparameter sweep request failed:', error)
    throw error
  }
}

// ============================================================================
// Statistical Analysis
// ============================================================================

export interface CompareRunsRequest {
  run_results: Array<{
    run_id: string
    mean_reward?: number
    std_reward?: number
    success_rate?: number
    episode_rewards?: number[]
    [key: string]: any
  }>
  metric?: string
  alpha?: number
}

export interface StatisticalComparison {
  metric: string
  n_runs: number
  run_names: string[]
  means: Record<string, number>
  overall_mean: number
  overall_std: number
  best_run: string
  worst_run: string
  statistical_test: {
    test: string
    t_statistic?: number
    h_statistic?: number
    p_value: number
    significant: boolean
  }
}

export interface CompareRunsResponse {
  success: boolean
  comparison: StatisticalComparison
  error?: string
}

export async function compareRuns(request: CompareRunsRequest): Promise<CompareRunsResponse> {
  const gqlMutation = `
    mutation CompareRuns($input: CompareRunsInput!) {
      compareRuns(input: $input) {
        success
        comparison {
          metric
          nRuns
          runNames
          means
          overallMean
          overallStd
          bestRun
          worstRun
          statisticalTest
        }
        error
      }
    }
  `

  const variables = {
    input: {
      runResults: JSON.stringify(request.run_results),
      metric: request.metric,
      alpha: request.alpha,
    },
  }

  try {
    const data = await mutate<{ compareRuns: any }>(gqlMutation, variables)

    if (!data?.compareRuns) {
      throw new Error('Failed to compare runs')
    }

    const result = data.compareRuns
    const comparison = result.comparison

    return {
      success: result.success,
      comparison: {
        metric: comparison.metric,
        n_runs: comparison.nRuns,
        run_names: comparison.runNames,
        means: JSON.parse(comparison.means),
        overall_mean: comparison.overallMean,
        overall_std: comparison.overallStd,
        best_run: comparison.bestRun,
        worst_run: comparison.worstRun,
        statistical_test: JSON.parse(comparison.statisticalTest),
      },
      error: result.error,
    }
  } catch (error) {
    console.error('Compare runs request failed:', error)
    throw error
  }
}

export interface ConfidenceIntervalRequest {
  values: number[]
  confidence?: number
}

export interface ConfidenceIntervalResponse {
  success: boolean
  confidence_interval: {
    mean: number
    std: number
    n: number
    confidence: number
    lower: number
    upper: number
    margin: number
  }
  error?: string
}

export async function calculateConfidenceInterval(
  request: ConfidenceIntervalRequest
): Promise<ConfidenceIntervalResponse> {
  const gqlMutation = `
    mutation CalculateConfidenceInterval($input: ConfidenceIntervalInput!) {
      calculateConfidenceInterval(input: $input) {
        success
        confidenceInterval {
          mean
          std
          n
          confidence
          lower
          upper
          margin
        }
        error
      }
    }
  `

  const variables = {
    input: {
      values: request.values,
      confidence: request.confidence || 0.95,
    },
  }

  try {
    const data = await mutate<{ calculateConfidenceInterval: any }>(gqlMutation, variables)

    if (!data?.calculateConfidenceInterval) {
      throw new Error('Failed to calculate confidence interval')
    }

    const result = data.calculateConfidenceInterval

    return {
      success: result.success,
      confidence_interval: result.confidenceInterval,
      error: result.error,
    }
  } catch (error) {
    console.error('Confidence interval request failed:', error)
    throw error
  }
}

export interface EffectSizeRequest {
  group1: number[]
  group2: number[]
}

export interface EffectSizeResponse {
  success: boolean
  effect_size: {
    cohens_d: number
    interpretation: string
    mean_diff: number
  }
  error?: string
}

export async function calculateEffectSize(request: EffectSizeRequest): Promise<EffectSizeResponse> {
  const gqlMutation = `
    mutation CalculateEffectSize($input: EffectSizeInput!) {
      calculateEffectSize(input: $input) {
        success
        effectSize {
          cohensD
          interpretation
          meanDiff
        }
        error
      }
    }
  `

  const variables = {
    input: {
      group1: request.group1,
      group2: request.group2,
    },
  }

  try {
    const data = await mutate<{ calculateEffectSize: any }>(gqlMutation, variables)

    if (!data?.calculateEffectSize) {
      throw new Error('Failed to calculate effect size')
    }

    const result = data.calculateEffectSize

    return {
      success: result.success,
      effect_size: {
        cohens_d: result.effectSize.cohensD,
        interpretation: result.effectSize.interpretation,
        mean_diff: result.effectSize.meanDiff,
      },
      error: result.error,
    }
  } catch (error) {
    console.error('Effect size request failed:', error)
    throw error
  }
}

// ============================================================================
// Model Versioning
// ============================================================================

export interface Checkpoint {
  checkpoint_name: string
  path: string
  run_id: string
  created_at: string
  model_path?: string
  [key: string]: any
}

export interface ModelVersion {
  version_name: string
  run_id: string
  checkpoint_name: string
  created_at: string
  tags: string[]
  description?: string
  model_path: string
}

export async function listCheckpoints(runId: string): Promise<Checkpoint[]> {
  const gqlQuery = `
    query ListCheckpoints($runId: String!) {
      listCheckpoints(runId: $runId) {
        checkpointName
        path
        runId
        createdAt
        modelPath
        metadata
      }
    }
  `

  try {
    const data = await query<{ listCheckpoints: any[] }>(gqlQuery, { runId })

    if (!data?.listCheckpoints) {
      return []
    }

    return data.listCheckpoints.map((cp: any) => ({
      checkpoint_name: cp.checkpointName,
      path: cp.path,
      run_id: cp.runId,
      created_at: cp.createdAt,
      model_path: cp.modelPath,
      ...(cp.metadata ? JSON.parse(cp.metadata) : {}),
    }))
  } catch (error) {
    console.error('List checkpoints request failed:', error)
    throw error
  }
}

export async function listModelVersions(runId: string): Promise<ModelVersion[]> {
  const gqlQuery = `
    query ListModelVersions($runId: String!) {
      listModelVersions(runId: $runId) {
        versionName
        runId
        checkpointName
        createdAt
        tags
        description
        modelPath
      }
    }
  `

  try {
    const data = await query<{ listModelVersions: any[] }>(gqlQuery, { runId })

    if (!data?.listModelVersions) {
      return []
    }

    return data.listModelVersions.map((v: any) => ({
      version_name: v.versionName,
      run_id: v.runId,
      checkpoint_name: v.checkpointName,
      created_at: v.createdAt,
      tags: v.tags,
      description: v.description,
      model_path: v.modelPath,
    }))
  } catch (error) {
    console.error('List model versions request failed:', error)
    throw error
  }
}

export interface CreateVersionRequest {
  run_id: string
  checkpoint_name: string
  version_name?: string
  tags?: string[]
  description?: string
}

export interface CreateVersionResponse {
  success: boolean
  version: ModelVersion
  error?: string
}

export async function createModelVersion(
  request: CreateVersionRequest
): Promise<CreateVersionResponse> {
  const gqlMutation = `
    mutation CreateModelVersion($input: CreateVersionInput!) {
      createModelVersion(input: $input) {
        success
        version {
          versionName
          runId
          checkpointName
          createdAt
          tags
          description
          modelPath
        }
        error
      }
    }
  `

  const variables = {
    input: {
      runId: request.run_id,
      checkpointName: request.checkpoint_name,
      versionName: request.version_name,
      tags: request.tags,
      description: request.description,
    },
  }

  try {
    const data = await mutate<{ createModelVersion: any }>(gqlMutation, variables)

    if (!data?.createModelVersion) {
      throw new Error('Failed to create model version')
    }

    const result = data.createModelVersion
    const version = result.version

    return {
      success: result.success,
      version: {
        version_name: version.versionName,
        run_id: version.runId,
        checkpoint_name: version.checkpointName,
        created_at: version.createdAt,
        tags: version.tags,
        description: version.description,
        model_path: version.modelPath,
      },
      error: result.error,
    }
  } catch (error) {
    console.error('Create model version request failed:', error)
    throw error
  }
}

// ============================================================================
// Experiment Tracking Settings (localStorage-based)
// ============================================================================

export interface ExperimentTrackingSettings {
  backend: 'local' | 'wandb' | 'mlflow'
  wandbApiKey?: string
  mlflowTrackingUri?: string
  projectName?: string
  // Authentication status
  wandbAuthenticated?: boolean
  wandbAuthenticatedAt?: string // ISO timestamp
  mlflowAuthenticated?: boolean
  mlflowAuthenticatedAt?: string // ISO timestamp
}

const SETTINGS_KEY = 'rl_studio_experiment_tracking_settings'

export function getExperimentTrackingSettings(): ExperimentTrackingSettings {
  if (typeof window === 'undefined') {
    return { backend: 'local' }
  }

  const stored = localStorage.getItem(SETTINGS_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return { backend: 'local' }
    }
  }

  return { backend: 'local' }
}

export function saveExperimentTrackingSettings(settings: ExperimentTrackingSettings): void {
  if (typeof window === 'undefined') return

  // Don't store API keys in plain text in production - this is a demo
  // In production, these should be stored securely or sent to backend
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export async function testWandbConnection(
  apiKey: string
): Promise<{ success: boolean; message?: string }> {
  const gqlMutation = `
    mutation TestWandbConnection($input: TestWandbConnectionInput!) {
      testWandbConnection(input: $input) {
        success
        message
        wandbAuthenticated
      }
    }
  `

  const variables = {
    input: {
      apiKey,
    },
  }

  try {
    const data = await mutate<{ testWandbConnection: any }>(gqlMutation, variables)

    if (!data?.testWandbConnection) {
      throw new Error('Failed to test W&B connection')
    }

    const result = data.testWandbConnection

    // If successful, update authentication status
    if (result.success === true || result.wandbAuthenticated === true) {
      const settings = getExperimentTrackingSettings()
      settings.wandbAuthenticated = true
      settings.wandbAuthenticatedAt = new Date().toISOString()
      settings.wandbApiKey = apiKey // Store the key
      saveExperimentTrackingSettings(settings)
    }

    return { success: result.success === true, message: result.message }
  } catch (error) {
    console.error('Failed to test W&B connection:', error)
    return { success: false, message: (error as Error).message }
  }
}

export async function testMlflowConnection(
  trackingUri?: string
): Promise<{ success: boolean; message?: string }> {
  const gqlMutation = `
    mutation TestMlflowConnection($input: TestMlflowConnectionInput!) {
      testMlflowConnection(input: $input) {
        success
        message
      }
    }
  `

  const variables = {
    input: {
      trackingUri: trackingUri || null,
    },
  }

  try {
    const data = await mutate<{ testMlflowConnection: any }>(gqlMutation, variables)

    if (!data?.testMlflowConnection) {
      throw new Error('Failed to test MLflow connection')
    }

    const result = data.testMlflowConnection

    // If successful, update authentication status
    if (result.success === true) {
      const settings = getExperimentTrackingSettings()
      settings.mlflowAuthenticated = true
      settings.mlflowAuthenticatedAt = new Date().toISOString()
      settings.mlflowTrackingUri = trackingUri
      saveExperimentTrackingSettings(settings)
    }

    return { success: result.success === true, message: result.message }
  } catch (error) {
    console.error('Failed to test MLflow connection:', error)
    return { success: false, message: (error as Error).message }
  }
}

// ============================================================================
// W&B Metrics Fetching
// ============================================================================

export interface WandbRun {
  id: string
  name: string
  state: string
  config: Record<string, any>
  summary: Record<string, any>
  url: string
  createdAt: string
  updatedAt: string
}

export interface WandbMetrics {
  run_id: string
  run_name: string
  metrics: Record<string, number[]>
  config: Record<string, any>
  summary: Record<string, any>
  url: string
}

export async function fetchWandbRun(
  runId: string,
  project?: string,
  apiKey?: string
): Promise<WandbMetrics | null> {
  try {
    const settings = getExperimentTrackingSettings()
    const effectiveApiKey = apiKey || settings.wandbApiKey
    const effectiveProject = project || settings.projectName || 'rl-studio'

    if (!effectiveApiKey || !settings.wandbAuthenticated) {
      throw new Error('W&B not authenticated')
    }

    const gqlQuery = `
      query GetWandbRun($runId: String!, $project: String, $apiKey: String) {
        getWandbRun(runId: $runId, project: $project, apiKey: $apiKey) {
          runId
          runName
          metrics
          config
          summary
          url
          projectName
        }
      }
    `

    const data = await query<{ getWandbRun: any }>(gqlQuery, {
      runId,
      project: effectiveProject,
      apiKey: effectiveApiKey,
    })

    if (!data?.getWandbRun) {
      return null
    }

    const result = data.getWandbRun

    return {
      run_id: result.runId,
      run_name: result.runName,
      metrics: JSON.parse(result.metrics),
      config: JSON.parse(result.config),
      summary: JSON.parse(result.summary),
      url: result.url,
      project_name: result.projectName,
    }
  } catch (error) {
    console.error('Failed to fetch W&B run:', error)
    return null
  }
}

export async function listWandbRuns(projectName?: string): Promise<WandbRun[]> {
  try {
    const settings = getExperimentTrackingSettings()
    if (!settings.wandbApiKey || !settings.wandbAuthenticated) {
      throw new Error('W&B not authenticated')
    }

    const project = projectName || settings.projectName || 'rl-studio'

    const gqlQuery = `
      query ListWandbRuns($project: String, $apiKey: String) {
        listWandbRuns(project: $project, apiKey: $apiKey) {
          id
          name
          state
          config
          summary
          url
          createdAt
          updatedAt
        }
      }
    `

    const data = await query<{ listWandbRuns: any[] }>(gqlQuery, {
      project,
      apiKey: settings.wandbApiKey,
    })

    if (!data?.listWandbRuns) {
      return []
    }

    return data.listWandbRuns.map((run: any) => ({
      id: run.id,
      name: run.name,
      state: run.state,
      config: JSON.parse(run.config),
      summary: JSON.parse(run.summary),
      url: run.url,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }))
  } catch (error) {
    console.error('Failed to list W&B runs:', error)
    return []
  }
}
