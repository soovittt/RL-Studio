import { useState } from 'react'

interface BanditCanvasProps {
  envSpec: any
  onSpecChange: (spec: any) => void
}

interface Arm {
  id: string
  mean: number
  std: number
  label: string
}

export function BanditCanvas({ envSpec, onSpecChange }: BanditCanvasProps) {
  const arms: Arm[] = envSpec?.visuals?.arms || []

  const addArm = () => {
    const newArm: Arm = {
      id: `arm_${Date.now()}`,
      mean: 0.5,
      std: 0.1,
      label: `Arm ${arms.length + 1}`,
    }
    onSpecChange({
      ...envSpec,
      visuals: {
        ...envSpec?.visuals,
        arms: [...arms, newArm],
      },
    })
  }

  const removeArm = (id: string) => {
    onSpecChange({
      ...envSpec,
      visuals: {
        ...envSpec?.visuals,
        arms: arms.filter((a) => a.id !== id),
      },
    })
  }

  const updateArm = (id: string, updates: Partial<Arm>) => {
    onSpecChange({
      ...envSpec,
      visuals: {
        ...envSpec?.visuals,
        arms: arms.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      },
    })
  }

  // Simple visualization of reward distribution
  const renderDistribution = (mean: number, std: number) => {
    const samples = 50
    const min = Math.max(0, mean - 3 * std)
    const max = Math.min(1, mean + 3 * std)
    const range = max - min || 1

    // Generate histogram
    const bins = Array(20).fill(0)
    for (let i = 0; i < samples; i++) {
      // Simple normal approximation
      const sample = Math.max(0, Math.min(1, mean + (Math.random() - 0.5) * std * 2))
      const bin = Math.floor(((sample - min) / range) * bins.length)
      if (bin >= 0 && bin < bins.length) {
        bins[bin]++
      }
    }

    const maxCount = Math.max(...bins, 1)

    return (
      <div className="flex items-end gap-0.5 h-12">
        {bins.map((count, i) => (
          <div
            key={i}
            className="flex-1 bg-blue-500 rounded-t"
            style={{ height: `${(count / maxCount) * 100}%` }}
            title={`${((i / bins.length) * range + min).toFixed(2)}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Multi-Armed Bandit</h3>
        <button
          onClick={addArm}
          className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
        >
          + Add Arm
        </button>
      </div>

      {arms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No arms defined</p>
          <p className="text-xs mt-2">Click "Add Arm" to create a new arm</p>
        </div>
      ) : (
        <div className="space-y-4">
          {arms.map((arm) => (
            <div key={arm.id} className="p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <input
                  type="text"
                  value={arm.label}
                  onChange={(e) => updateArm(arm.id, { label: e.target.value })}
                  className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => removeArm(arm.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  × Remove
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Mean Reward: {arm.mean.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={arm.mean}
                    onChange={(e) => updateArm(arm.id, { mean: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Std Deviation: {arm.std.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={arm.std}
                    onChange={(e) => updateArm(arm.id, { std: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-2">
                    Reward Distribution
                  </label>
                  {renderDistribution(arm.mean, arm.std)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        <p>Each arm represents a choice with a reward distribution</p>
        <p>Agent learns which arm to pull to maximize expected reward</p>
      </div>
    </div>
  )
}

