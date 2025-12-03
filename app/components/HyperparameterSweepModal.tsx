import { useState } from 'react'
import { generateHyperparameterSweep, type HyperparameterSweepRequest } from '~/lib/researchClient'
import type { EnvSpec } from '~/lib/envSpec'

interface HyperparameterSweepModalProps {
  envSpec: EnvSpec
  envId: string
  onClose: () => void
  onLaunchSweep: (trials: Array<Record<string, any>>) => void
}

export function HyperparameterSweepModal({
  envSpec,
  envId,
  onClose,
  onLaunchSweep,
}: HyperparameterSweepModalProps) {
  const [algorithm, setAlgorithm] = useState('PPO')
  const [searchType, setSearchType] = useState<'grid' | 'random' | 'bayesian'>('grid')
  const [nTrials, setNTrials] = useState(10)
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [searchSpace, setSearchSpace] = useState<Record<string, string>>({
    learning_rate: '[1e-4, 3e-4, 1e-3]',
    gamma: '[0.95, 0.99, 0.999]',
    batch_size: '[32, 64, 128]',
  })
  const [generating, setGenerating] = useState(false)
  const [trials, setTrials] = useState<Array<Record<string, any>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parseSearchSpace = (): Record<string, any[]> => {
    const parsed: Record<string, any[]> = {}
    for (const [key, value] of Object.entries(searchSpace)) {
      if (!value.trim()) continue
      try {
        // Parse array-like strings: "[1, 2, 3]" or "1, 2, 3"
        const cleaned = value.trim().replace(/^\[|\]$/g, '')
        const items = cleaned.split(',').map((s) => {
          const trimmed = s.trim()
          // Try to parse as number first
          const num = Number(trimmed)
          if (!isNaN(num)) return num
          // Otherwise return as string
          return trimmed.replace(/^["']|["']$/g, '')
        })
        parsed[key] = items
      } catch (e) {
        console.error(`Failed to parse ${key}:`, e)
      }
    }
    return parsed
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setTrials(null)

    try {
      const parsedSpace = parseSearchSpace()
      if (Object.keys(parsedSpace).length === 0) {
        throw new Error('Please define at least one hyperparameter in the search space')
      }

      const request: HyperparameterSweepRequest = {
        algorithm,
        env_spec: envSpec,
        base_config: {
          total_timesteps: 1000000,
        },
        search_space: parsedSpace,
        search_type: searchType,
        n_trials: nTrials,
        seed: seed || undefined,
      }

      const result = await generateHyperparameterSweep(request)
      setTrials(result.trials)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const handleLaunch = () => {
    if (trials && trials.length > 0) {
      onLaunchSweep(trials)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto text-foreground">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Hyperparameter Sweep</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Algorithm Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded bg-background"
            >
              <option value="PPO">PPO</option>
              <option value="DQN">DQN</option>
              <option value="A2C">A2C</option>
              <option value="TD3">TD3</option>
              <option value="SAC">SAC</option>
            </select>
          </div>

          {/* Search Type */}
          <div>
            <label className="block text-sm font-semibold mb-2">Search Type</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="searchType"
                  value="grid"
                  checked={searchType === 'grid'}
                  onChange={() => setSearchType('grid')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Grid Search</div>
                  <div className="text-xs text-muted-foreground">
                    Exhaustive search over all combinations
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="searchType"
                  value="random"
                  checked={searchType === 'random'}
                  onChange={() => setSearchType('random')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Random Search</div>
                  <div className="text-xs text-muted-foreground">
                    Random sampling from search space
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="searchType"
                  value="bayesian"
                  checked={searchType === 'bayesian'}
                  onChange={() => setSearchType('bayesian')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Bayesian Optimization</div>
                  <div className="text-xs text-muted-foreground">
                    Smart search using Optuna (requires optuna package)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Number of Trials */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Number of Trials</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={nTrials}
                onChange={(e) => setNTrials(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-border rounded bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Seed (optional)</label>
              <input
                type="number"
                value={seed || ''}
                onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Random"
                className="w-full px-3 py-2 border border-border rounded bg-background"
              />
            </div>
          </div>

          {/* Search Space */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Search Space (comma-separated values or array format)
            </label>
            <div className="space-y-2">
              {Object.entries(searchSpace).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="w-32 text-sm text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}:
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setSearchSpace((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="[1, 2, 3] or 1, 2, 3"
                    className="flex-1 px-3 py-2 border border-border rounded bg-background font-mono text-sm"
                  />
                  <button
                    onClick={() => {
                      const newSpace = { ...searchSpace }
                      delete newSpace[key]
                      setSearchSpace(newSpace)
                    }}
                    className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newKey = prompt('Enter hyperparameter name (e.g., learning_rate):')
                  if (newKey) {
                    setSearchSpace((prev) => ({ ...prev, [newKey]: '' }))
                  }
                }}
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
              >
                + Add Hyperparameter
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Trials'}
            </button>
          </div>

          {/* Trials Preview */}
          {trials && trials.length > 0 && (
            <div className="border-t border-border pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Generated {trials.length} Trial{trials.length !== 1 ? 's' : ''}
                </h3>
                <button
                  onClick={handleLaunch}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Launch All Trials
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium">Trial</th>
                      {Object.keys(trials[0]).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-2 text-left text-xs font-medium capitalize"
                        >
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trials.slice(0, 20).map((trial, idx) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-xs">{idx + 1}</td>
                        {Object.values(trial).map((value, vIdx) => (
                          <td key={vIdx} className="px-3 py-2 font-mono text-xs">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trials.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                    Showing first 20 of {trials.length} trials
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
