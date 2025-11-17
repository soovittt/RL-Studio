/**
 * Firecrawl Converter
 * Converts extracted environment data from Firecrawl into EnvSpec format
 */

import { EnvSpec, createDefaultEnvSpec, ObjectSpec, AgentSpec, RewardRule, TerminationRule } from './envSpec'
import type { ExtractedEnvironment } from '../../convex/firecrawl'

export function convertToEnvSpec(extracted: ExtractedEnvironment): EnvSpec {
  const envType = extracted.envType === 'continuous' ? 'continuous2d' : 
                  extracted.envType === 'custom' ? 'custom2d' : 'grid'
  
  const envSpec = createDefaultEnvSpec(envType, extracted.name)

  // Update world dimensions if provided
  if (extracted.world) {
    envSpec.world = {
      ...envSpec.world,
      width: extracted.world.width || envSpec.world.width,
      height: extracted.world.height || envSpec.world.height,
      coordinateSystem: extracted.world.coordinateSystem || envSpec.world.coordinateSystem,
    }
  }

  // Convert objects
  if (extracted.objects && extracted.objects.length > 0) {
    envSpec.objects = extracted.objects.map((obj, idx) => {
      const objectSpec: ObjectSpec = {
        id: `obj_${idx}`,
        type: (obj.type as any) || 'custom',
        position: obj.position || [0, 0],
        size: { type: 'point' },
        collision: {
          enabled: true,
          shape: 'circle',
          size: { type: 'circle', radius: 0.5 },
        },
        properties: obj.properties || {},
      }

      // Set appropriate size based on type
      if (obj.type === 'wall' || obj.type === 'obstacle') {
        objectSpec.size = { type: 'rect', width: 1, height: 1 }
        objectSpec.collision.size = { type: 'rect', width: 1, height: 1 }
        objectSpec.collision.shape = 'rect'
      } else if (obj.type === 'goal') {
        objectSpec.size = { type: 'circle', radius: 0.5 }
        objectSpec.collision.size = { type: 'circle', radius: 0.5 }
      }

      return objectSpec
    })
  }

  // Convert agents
  if (extracted.agents && extracted.agents.length > 0) {
    envSpec.agents = extracted.agents.map((agent, idx) => {
      const agentSpec: AgentSpec = {
        id: `agent_${idx}`,
        name: agent.name || `Agent ${idx + 1}`,
        position: agent.position || [0, 0],
        dynamics: envType === 'grid' 
          ? { type: 'grid-step' }
          : { type: 'continuous-velocity', maxSpeed: 1.0 },
        sensors: [],
      }
      return agentSpec
    })
  }

  // Convert action space
  if (extracted.actionSpace) {
    if (extracted.actionSpace.type === 'discrete' && extracted.actionSpace.actions) {
      envSpec.actionSpace = {
        type: 'discrete',
        actions: extracted.actionSpace.actions,
      }
    } else if (extracted.actionSpace.type === 'continuous') {
      envSpec.actionSpace = {
        type: 'continuous',
        dimensions: extracted.actionSpace.dimensions || 2,
        range: [-1, 1],
      }
    }
  }

  // Convert reward rules
  if (extracted.rewards && extracted.rewards.length > 0) {
    envSpec.rules.rewards = extracted.rewards.map((reward, idx) => {
      const rule: RewardRule = {
        id: `reward_${idx}`,
        condition: parseRewardCondition(reward.condition),
        value: reward.value,
      }
      return rule
    })
  }

  // Convert termination rules
  if (extracted.terminations && extracted.terminations.length > 0) {
    envSpec.rules.terminations = extracted.terminations.map((term, idx) => {
      const rule: TerminationRule = {
        id: `termination_${idx}`,
        condition: parseTerminationCondition(term.condition),
      }
      return rule
    })
  }

  // Add metadata
  if (extracted.metadata) {
    envSpec.metadata = {
      ...envSpec.metadata,
      tags: extracted.metadata.tags || [],
      notes: extracted.metadata.notes || extracted.description,
    }
  }

  return envSpec
}

function parseRewardCondition(condition: string): any {
  const lower = condition.toLowerCase()
  
  if (lower.includes('agent_at_object') || lower.includes('goal')) {
    // Find goal object
    return {
      type: 'agent_at_object',
      objectId: 'goal',
    }
  }
  
  if (lower.includes('timeout') || lower.includes('step')) {
    return {
      type: 'timeout',
      steps: 1,
    }
  }
  
  if (lower.includes('collision')) {
    return {
      type: 'collision',
    }
  }
  
  // Default custom condition
  return {
    type: 'custom',
    script: condition,
  }
}

function parseTerminationCondition(condition: string): any {
  const lower = condition.toLowerCase()
  
  if (lower.includes('timeout') || lower.includes('max_step')) {
    const stepMatch = condition.match(/(\d+)/)
    return {
      type: 'timeout',
      steps: stepMatch ? parseInt(stepMatch[1]) : 100,
    }
  }
  
  if (lower.includes('agent_at_object') || lower.includes('goal')) {
    return {
      type: 'agent_at_object',
      objectId: 'goal',
    }
  }
  
  if (lower.includes('collision')) {
    return {
      type: 'collision',
    }
  }
  
  // Default timeout
  return {
    type: 'timeout',
    steps: 100,
  }
}

