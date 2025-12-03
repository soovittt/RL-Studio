/**
 * Code View Tab Component
 * Uses GPT API to generate production-ready code based on actual environment configuration
 * Allows editing code and configs with auto-save
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { generateCode, saveCode, getFileTypeMapping, getFileDisplayName } from '~/lib/codegenClient'
import type { EnvSpec } from '~/lib/envSpec'

interface CodeViewTabProps {
  envSpec: EnvSpec | null
}

const FILE_OPTIONS = [
  { value: 'environment', label: 'Environment (Python)' },
  { value: 'training', label: 'Training Script' },
  { value: 'config', label: 'Config YAML' },
  { value: 'skypilot', label: 'SkyPilot YAML' },
  { value: 'readme', label: 'README' },
  { value: 'env_spec', label: 'EnvSpec JSON' },
]

export function CodeViewTab({ envSpec }: CodeViewTabProps) {
  const [selectedFileType, setSelectedFileType] = useState<string>('environment')
  const [code, setCode] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [isCached, setIsCached] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  const [trainingConfig, setTrainingConfig] = useState({
    hyperparams: {
      learning_rate: 3e-4,
      gamma: 0.99,
      steps: 1000000,
    },
    concepts: {},
    num_runs: 1,
  })
  const [algorithm, setAlgorithm] = useState<'ppo' | 'dqn'>('ppo')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const originalCodeRef = useRef<string>('')

  // Generate code when file type or envSpec changes
  useEffect(() => {
    if (!envSpec) {
      setCode('No environment specification')
      setError(null)
      setIsCached(false)
      return
    }

    const loadCode = async () => {
      setLoading(true)
      setError(null)
      setIsCached(false)
      // Show "Loading..." only briefly - backend cache makes this fast
      setCode('Loading...')

      try {
        const startTime = performance.now()
        const response = await generateCode({
          env_spec: envSpec,
          file_type: selectedFileType as any,
          training_config: trainingConfig,
          algorithm: algorithm,
        })
        const loadTime = performance.now() - startTime

        if (response.success && response.code) {
          setCode(response.code)
          originalCodeRef.current = response.code
          setFileName(response.file_name || '')
          // If response was very fast (< 100ms), it was likely from cache
          setIsCached(loadTime < 100)
          setSaveStatus('idle')
        } else {
          throw new Error(response.error || 'Failed to generate code')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)

        // Better error messages
        const backendUrl = import.meta.env.VITE_ROLLOUT_SERVICE_URL || 'http://localhost:8000'
        let userMessage = `Unable to generate code: ${errorMessage}\n\n`
        if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
          userMessage += 'Backend connection issue. Please ensure:\n'
          userMessage += `1. Backend server is running at ${backendUrl}\n`
          userMessage += '2. Check backend logs for errors\n'
        } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          userMessage += 'API authentication failed. Please check:\n'
          userMessage += '1. OPENAI_API_KEY is set in backend/.env\n'
          userMessage += '2. API key is valid\n'
        } else {
          userMessage += 'Please check:\n'
          userMessage += '1. Backend is running\n'
          userMessage += '2. Environment configuration is valid\n'
        }

        setCode(userMessage)
      } finally {
        setLoading(false)
      }
    }

    loadCode()
  }, [envSpec, selectedFileType, trainingConfig, algorithm])

  // Auto-save code after user stops typing (debounced)
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode)
      setSaveStatus('idle')

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Only save if code actually changed
      if (newCode === originalCodeRef.current || !envSpec) {
        return
      }

      // Debounce: Save after 2 seconds of no typing
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setSaveStatus('saving')
          await saveCode({
            env_spec: envSpec,
            file_type: selectedFileType,
            code: newCode,
            file_name: fileName,
            training_config: trainingConfig,
            algorithm: algorithm,
          })
          setSaveStatus('saved')
          originalCodeRef.current = newCode
          // Clear saved status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (err) {
          setSaveStatus('error')
          console.error('Auto-save failed:', err)
        }
      }, 2000)
    },
    [envSpec, selectedFileType, fileName, trainingConfig, algorithm]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleDownload = () => {
    if (!code || code.startsWith('Error:') || code.startsWith('No environment')) {
      return
    }

    const fileMapping = getFileTypeMapping()
    const actualFileName = fileName || `${fileMapping[selectedFileType] || selectedFileType}`

    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = actualFileName
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!envSpec) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No environment specification available</p>
      </div>
    )
  }

  return (
    <div className="text-sm h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Generated Code</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Production-ready code from your environment configuration
            {isCached && !loading && (
              <span className="ml-2 text-green-600">⚡ Cached (instant)</span>
            )}
            {saveStatus === 'saving' && <span className="ml-2 text-blue-600">💾 Saving...</span>}
            {saveStatus === 'saved' && <span className="ml-2 text-green-600">✅ Saved</span>}
            {saveStatus === 'error' && <span className="ml-2 text-red-600">❌ Save failed</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfigEditor(!showConfigEditor)}
            className="px-3 py-1 text-xs border border-border rounded hover:bg-muted"
            title="Edit training configuration"
          >
            ⚙️ Config
          </button>
          <select
            value={selectedFileType}
            onChange={(e) => setSelectedFileType(e.target.value)}
            className="px-3 py-1 text-xs border border-border rounded bg-background"
            disabled={loading}
          >
            {FILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleDownload}
            disabled={
              loading || !code || code.startsWith('Error:') || code.startsWith('No environment')
            }
            className="px-3 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Download'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
          <strong>Error:</strong> {error}
        </div>
      )}

      {showConfigEditor && (
        <div className="mb-4 p-3 border border-border rounded bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold">Training Configuration</h4>
            <button
              onClick={() => setShowConfigEditor(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block mb-1 text-muted-foreground">Algorithm</label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as 'ppo' | 'dqn')}
                className="w-full px-2 py-1 border border-border rounded bg-background"
              >
                <option value="ppo">PPO</option>
                <option value="dqn">DQN</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-muted-foreground">Learning Rate</label>
              <input
                type="number"
                step="0.0001"
                value={trainingConfig.hyperparams.learning_rate}
                onChange={(e) =>
                  setTrainingConfig({
                    ...trainingConfig,
                    hyperparams: {
                      ...trainingConfig.hyperparams,
                      learning_rate: parseFloat(e.target.value) || 3e-4,
                    },
                  })
                }
                className="w-full px-2 py-1 border border-border rounded bg-background"
              />
            </div>
            <div>
              <label className="block mb-1 text-muted-foreground">Gamma</label>
              <input
                type="number"
                step="0.01"
                value={trainingConfig.hyperparams.gamma}
                onChange={(e) =>
                  setTrainingConfig({
                    ...trainingConfig,
                    hyperparams: {
                      ...trainingConfig.hyperparams,
                      gamma: parseFloat(e.target.value) || 0.99,
                    },
                  })
                }
                className="w-full px-2 py-1 border border-border rounded bg-background"
              />
            </div>
            <div>
              <label className="block mb-1 text-muted-foreground">Total Steps</label>
              <input
                type="number"
                step="100000"
                value={trainingConfig.hyperparams.steps}
                onChange={(e) =>
                  setTrainingConfig({
                    ...trainingConfig,
                    hyperparams: {
                      ...trainingConfig.hyperparams,
                      steps: parseInt(e.target.value) || 1000000,
                    },
                  })
                }
                className="w-full px-2 py-1 border border-border rounded bg-background"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto border border-border rounded bg-muted/20 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <div className="text-center">
              <div className="text-sm font-medium mb-2">
                {code === 'Loading...' ? 'Fetching code...' : 'Generating code...'}
              </div>
              <div className="text-xs text-muted-foreground">
                {code === 'Loading...'
                  ? 'Loading code'
                  : 'Creating production-ready code from your environment'}
              </div>
            </div>
          </div>
        )}
        <textarea
          className="w-full h-full p-4 text-xs font-mono bg-transparent resize-none focus:outline-none border-none"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          spellCheck={false}
          disabled={
            loading ||
            code === 'Loading...' ||
            code.startsWith('Error:') ||
            code.startsWith('No environment')
          }
        />
      </div>

      <div className="mt-2 text-xs text-muted-foreground space-y-1">
        <div>
          <strong>Note:</strong> Code is generated from your environment configuration:
        </div>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li>Reward rules and calculations</li>
          <li>Action space and dynamics</li>
          <li>Termination conditions</li>
          <li>World structure and objects</li>
          <li>Training hyperparameters</li>
        </ul>
      </div>
    </div>
  )
}
