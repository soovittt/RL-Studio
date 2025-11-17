import { describe, it, expect } from 'vitest'
import { formatDate, formatDuration, truncate } from '~/lib/utils'

describe('utils', () => {
  describe('formatDate', () => {
    it('formats timestamp to date string', () => {
      const timestamp = 1640995200000 // 2022-01-01
      const result = formatDate(timestamp)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })

  describe('formatDuration', () => {
    it('formats milliseconds to duration string', () => {
      expect(formatDuration(1000)).toBe('1s')
      expect(formatDuration(60000)).toBe('1m 0s')
      expect(formatDuration(3600000)).toBe('1h 0m')
    })
  })

  describe('truncate', () => {
    it('truncates long strings', () => {
      expect(truncate('hello world', 5)).toBe('hello...')
      expect(truncate('short', 10)).toBe('short')
    })
  })
})

