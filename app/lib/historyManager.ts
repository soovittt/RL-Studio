/**
 * History Manager - Manages undo/redo functionality and auto-save
 */

import { EnvSpec } from './envSpec'

export interface HistoryState {
  spec: EnvSpec
  timestamp: number
}

export class HistoryManager {
  private history: HistoryState[] = []
  private currentIndex: number = -1
  private maxHistorySize: number = 50
  private autoSaveInterval: number = 30000 // 30 seconds
  private autoSaveCallback?: (spec: EnvSpec) => void
  private autoSaveTimer?: ReturnType<typeof setInterval>

  constructor(initialSpec: EnvSpec, autoSaveCallback?: (spec: EnvSpec) => void) {
    this.autoSaveCallback = autoSaveCallback
    this.push(initialSpec)
    this.startAutoSave()
  }

  /**
   * Push a new state to history
   */
  push(spec: EnvSpec): void {
    // Remove any states after current index (when undoing and then making a new change)
    this.history = this.history.slice(0, this.currentIndex + 1)

    // Add new state
    this.history.push({
      spec: JSON.parse(JSON.stringify(spec)), // Deep clone
      timestamp: Date.now(),
    })

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    } else {
      this.currentIndex++
    }
  }

  /**
   * Undo to previous state
   */
  undo(): EnvSpec | null {
    if (this.canUndo()) {
      this.currentIndex--
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].spec)) // Deep clone
    }
    return null
  }

  /**
   * Redo to next state
   */
  redo(): EnvSpec | null {
    if (this.canRedo()) {
      this.currentIndex++
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].spec)) // Deep clone
    }
    return null
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex > 0
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * Get current state
   */
  getCurrent(): EnvSpec | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].spec)) // Deep clone
    }
    return null
  }

  /**
   * Get history info
   */
  getHistoryInfo(): { current: number; total: number; canUndo: boolean; canRedo: boolean } {
    return {
      current: this.currentIndex + 1,
      total: this.history.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveCallback) {
      this.autoSaveTimer = setInterval(() => {
        const current = this.getCurrent()
        if (current) {
          this.autoSaveCallback!(current)
        }
      }, this.autoSaveInterval)
    }
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = undefined
    }
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = []
    this.currentIndex = -1
  }

  /**
   * Reset with new spec
   */
  reset(spec: EnvSpec): void {
    this.clear()
    this.push(spec)
  }
}
