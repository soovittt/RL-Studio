import { useState } from 'react'

interface GridEditorProps {
  spec: any
  onChange: (spec: any) => void
}

const CELL_TYPES = {
  empty: { label: 'Empty', color: 'bg-white' },
  wall: { label: 'Wall', color: 'bg-gray-800' },
  goal: { label: 'Goal', color: 'bg-green-500' },
  trap: { label: 'Trap', color: 'bg-red-500' },
  key: { label: 'Key', color: 'bg-yellow-500' },
  agent: { label: 'Agent', color: 'bg-blue-500' },
}

export function GridEditor({ spec, onChange }: GridEditorProps) {
  const [selectedType, setSelectedType] = useState<keyof typeof CELL_TYPES>('wall')
  const [grid, setGrid] = useState(
    spec.grid ||
      Array(10)
        .fill(null)
        .map(() => Array(10).fill('empty'))
  )

  const handleCellClick = (row: number, col: number) => {
    const newGrid = grid.map((r: string[], rIdx: number) =>
      r.map((c: string, cIdx: number) => {
        if (rIdx === row && cIdx === col) {
          return selectedType
        }
        if (selectedType === 'agent' && c === 'agent') {
          return 'empty'
        }
        return c
      })
    )
    setGrid(newGrid)
    onChange({ ...spec, grid: newGrid })
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 flex-wrap">
        {Object.entries(CELL_TYPES).map(([type, { label, color }]) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as keyof typeof CELL_TYPES)}
            className={`px-3 py-1 rounded text-sm border ${
              selectedType === type
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            }`}
          >
            <span className={`inline-block w-3 h-3 ${color} rounded mr-2`} />
            {label}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-lg p-4 bg-white">
        <div
          className="grid gap-0"
          style={{ gridTemplateColumns: `repeat(${grid[0].length}, 1fr)` }}
        >
          {grid.map((row: string[], rowIdx: number) =>
            row.map((cell: string, colIdx: number) => {
              const cellType = cell as keyof typeof CELL_TYPES
              const { color } = CELL_TYPES[cellType] || CELL_TYPES.empty
              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  onClick={() => handleCellClick(rowIdx, colIdx)}
                  className={`w-10 h-10 border border-gray-300 ${color} hover:opacity-80 transition-opacity`}
                  title={`${rowIdx}, ${colIdx}`}
                />
              )
            })
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        Grid size: {grid[0].length} × {grid.length}
      </div>
    </div>
  )
}
