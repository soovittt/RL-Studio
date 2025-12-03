import { useState, useEffect } from 'react'
import {
  getExperimentTrackingSettings,
  saveExperimentTrackingSettings,
  testWandbConnection,
  testMlflowConnection,
  type ExperimentTrackingSettings,
} from '~/lib/researchClient'

interface ExperimentTrackingSettingsProps {
  onClose: () => void
}

export function ExperimentTrackingSettings({ onClose }: ExperimentTrackingSettingsProps) {
  const [settings, setSettings] = useState<ExperimentTrackingSettings>(() =>
    getExperimentTrackingSettings()
  )
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleBackendChange = (backend: 'local' | 'wandb' | 'mlflow') => {
    setSettings((prev) => ({ ...prev, backend }))
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      if (settings.backend === 'wandb') {
        if (!settings.wandbApiKey) {
          setTestResult({ success: false, message: 'Please enter a W&B API key' })
          return
        }
        const result = await testWandbConnection(settings.wandbApiKey)
        setTestResult({
          success: result.success,
          message: result.success
            ? '✅ Connected to Weights & Biases'
            : result.message || '❌ Failed to connect. Please check your API key.',
        })
        // Update settings to reflect authentication status
        if (result.success) {
          setSettings((prev) => ({
            ...prev,
            wandbAuthenticated: true,
            wandbAuthenticatedAt: new Date().toISOString(),
          }))
        }
      } else if (settings.backend === 'mlflow') {
        const result = await testMlflowConnection(settings.mlflowTrackingUri)
        setTestResult({
          success: result.success,
          message: result.success
            ? '✅ Connected to MLflow'
            : result.message || '❌ Failed to connect. Please check your tracking URI.',
        })
        // Update settings to reflect authentication status
        if (result.success) {
          setSettings((prev) => ({
            ...prev,
            mlflowAuthenticated: true,
            mlflowAuthenticatedAt: new Date().toISOString(),
          }))
        }
      } else {
        setTestResult({ success: true, message: '✅ Local tracking enabled' })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection test failed: ${(error as Error).message}`,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    setSaving(true)
    saveExperimentTrackingSettings(settings)
    setTimeout(() => {
      setSaving(false)
      onClose()
    }, 300)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto text-foreground">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Experiment Tracking Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Backend Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2">Tracking Backend</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="backend"
                  value="local"
                  checked={settings.backend === 'local'}
                  onChange={() => handleBackendChange('local')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Local File Tracking</div>
                  <div className="text-xs text-muted-foreground">
                    Save experiments to local files (no account needed)
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="backend"
                  value="wandb"
                  checked={settings.backend === 'wandb'}
                  onChange={() => handleBackendChange('wandb')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Weights & Biases</div>
                  <div className="text-xs text-muted-foreground">
                    Cloud-based experiment tracking (requires free W&B account)
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="backend"
                  value="mlflow"
                  checked={settings.backend === 'mlflow'}
                  onChange={() => handleBackendChange('mlflow')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">MLflow</div>
                  <div className="text-xs text-muted-foreground">
                    Open-source ML lifecycle platform (local or remote)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* W&B Configuration */}
          {settings.backend === 'wandb' && (
            <div className="space-y-4 border border-border rounded-lg p-4">
              {/* Authentication Status */}
              {settings.wandbAuthenticated && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <span>✅</span>
                    <span className="font-semibold">Authenticated with Weights & Biases</span>
                  </div>
                  {settings.wandbAuthenticatedAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Connected on {new Date(settings.wandbAuthenticatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2">W&B API Key</label>
                <input
                  type="password"
                  value={settings.wandbApiKey || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      wandbApiKey: e.target.value,
                      wandbAuthenticated: false,
                    }))
                  }
                  placeholder="wandb-..."
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://wandb.ai/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    wandb.ai/settings
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Project Name (optional)</label>
                <input
                  type="text"
                  value={settings.projectName || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                  placeholder="rl-studio"
                  className="w-full px-3 py-2 border border-border rounded bg-background"
                />
              </div>
            </div>
          )}

          {/* MLflow Configuration */}
          {settings.backend === 'mlflow' && (
            <div className="space-y-4 border border-border rounded-lg p-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  MLflow Tracking URI (optional)
                </label>
                <input
                  type="text"
                  value={settings.mlflowTrackingUri || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, mlflowTrackingUri: e.target.value }))
                  }
                  placeholder="http://localhost:5000 or leave empty for local"
                  className="w-full px-3 py-2 border border-border rounded bg-background"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Leave empty to use local file-based tracking, or provide a remote MLflow server
                  URI
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Project Name (optional)</label>
                <input
                  type="text"
                  value={settings.projectName || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                  placeholder="rl-studio"
                  className="w-full px-3 py-2 border border-border rounded bg-background"
                />
              </div>
            </div>
          )}

          {/* Test Connection */}
          {settings.backend !== 'local' && (
            <div>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <div
                  className={`mt-2 text-sm ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="text-sm">
              <div className="font-semibold mb-2">About Experiment Tracking</div>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Tracks training metrics, hyperparameters, and model checkpoints</li>
                <li>• Enables experiment comparison and reproducibility</li>
                <li>• Local tracking: No account needed, files saved to `experiments/`</li>
                <li>• W&B: Free account, cloud-based, great for collaboration</li>
                <li>• MLflow: Open-source, can run locally or on your own server</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
