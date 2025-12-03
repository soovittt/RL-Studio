// Selection Manager - Global state for selected objects/agents/regions
import { createContext, useContext, useState, ReactNode } from 'react'

interface SelectionState {
  selectedObjectId: string | null
  selectedAgentId: string | null
  selectedRegionId: string | null
}

interface SelectionContextType {
  selection: SelectionState
  selectObject: (id: string | null) => void
  selectAgent: (id: string | null) => void
  selectRegion: (id: string | null) => void
  clearSelection: () => void
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>({
    selectedObjectId: null,
    selectedAgentId: null,
    selectedRegionId: null,
  })

  const selectObject = (id: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedObjectId: id,
      selectedAgentId: null, // Clear agent selection when selecting object
      selectedRegionId: null, // Clear region selection
    }))
  }

  const selectAgent = (id: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedAgentId: id,
      selectedObjectId: null, // Clear object selection
      selectedRegionId: null, // Clear region selection
    }))
  }

  const selectRegion = (id: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedRegionId: id,
      selectedObjectId: null, // Clear object selection
      selectedAgentId: null, // Clear agent selection
    }))
  }

  const clearSelection = () => {
    setSelection({
      selectedObjectId: null,
      selectedAgentId: null,
      selectedRegionId: null,
    })
  }

  return (
    <SelectionContext.Provider
      value={{
        selection,
        selectObject,
        selectAgent,
        selectRegion,
        clearSelection,
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider')
  }
  return context
}
