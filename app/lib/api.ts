/**
 * API client for backend endpoints
 */
import { generateSkyPilotYAML } from './skypilot'

export async function launchTrainingJob(runId: string, config: any): Promise<{ jobId: string; yaml: string }> {
  // In production, this would call a backend API
  // For now, generate YAML and return mock job ID
  const yaml = generateSkyPilotYAML({ runId, ...config })
  const jobId = `sky-job-${Date.now()}-${runId.slice(0, 8)}`
  
  // TODO: In production, POST to backend API endpoint
  // const response = await fetch('/api/training/launch', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ runId, config }),
  // })
  // return response.json()
  
  return { jobId, yaml }
}


