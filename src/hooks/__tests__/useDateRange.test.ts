/**
 * Unit tests for useDateRange hook
 * @module hooks/__tests__/useDateRange.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDateRange } from '../useDateRange'

// Mock the current date for consistent testing
const MOCK_NOW = new Date(2024, 0, 15, 12, 0, 0) // Jan 15, 2024 at noon

describe('useDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_NOW)
  })

  describe('initial state', () => {
    it('should default to today as start date', () => {
      const { result } = renderHook(() => useDateRange())

      expect(result.current.startDate.getFullYear()).toBe(2024)
      expect(result.current.startDate.getMonth()).toBe(0) // January
      expect(result.current.startDate.getDate()).toBe(15)
      expect(result.current.startDate.getHours()).toBe(0) // Start of day
    })

    it('should default to 7 days range', () => {
      const { result } = renderHook(() => useDateRange())

      expect(result.current.rangeDays).toBe(7)
      expect(result.current.datesInRange.length).toBe(7)
    })

    it('should use custom initial start date', () => {
      const customStart = new Date(2024, 5, 1)
      const { result } = renderHook(() =>
        useDateRange({ initialStart: customStart })
      )

      expect(result.current.startDate.getMonth()).toBe(5)
      expect(result.current.startDate.getDate()).toBe(1)
    })

    it('should use custom initial range', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 1),
          initialEnd: new Date(2024, 0, 14),
        })
      )

      expect(result.current.rangeDays).toBe(14)
      expect(result.current.datesInRange.length).toBe(14)
    })

    it('should use custom defaultRangeDays', () => {
      const { result } = renderHook(() =>
        useDateRange({ defaultRangeDays: 14 })
      )

      expect(result.current.rangeDays).toBe(14)
      expect(result.current.datesInRange.length).toBe(14)
    })
  })

  describe('datesInRange', () => {
    it('should return correct dates in range', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 3,
        })
      )

      expect(result.current.datesInRange.length).toBe(3)
      expect(result.current.datesInRange[0].getDate()).toBe(15)
      expect(result.current.datesInRange[1].getDate()).toBe(16)
      expect(result.current.datesInRange[2].getDate()).toBe(17)
    })

    it('should handle month boundaries', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 30),
          defaultRangeDays: 5,
        })
      )

      expect(result.current.datesInRange[0].getDate()).toBe(30) // Jan 30
      expect(result.current.datesInRange[1].getDate()).toBe(31) // Jan 31
      expect(result.current.datesInRange[2].getDate()).toBe(1) // Feb 1
      expect(result.current.datesInRange[2].getMonth()).toBe(1) // February
    })
  })

  describe('navigation', () => {
    it('should go to today', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 5, 1), // Start on a different date
        })
      )

      act(() => {
        result.current.goToToday()
      })

      expect(result.current.startDate.getDate()).toBe(15) // Today
      expect(result.current.startDate.getMonth()).toBe(0) // January
    })

    it('should go to previous range', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      act(() => {
        result.current.goToPrevious()
      })

      expect(result.current.startDate.getDate()).toBe(8) // 15 - 7 = 8
    })

    it('should go to next range', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      act(() => {
        result.current.goToNext()
      })

      expect(result.current.startDate.getDate()).toBe(22) // 15 + 7 = 22
    })

    it('should go to specific date', () => {
      const { result } = renderHook(() => useDateRange())

      act(() => {
        result.current.goToDate(new Date(2024, 5, 1))
      })

      expect(result.current.startDate.getMonth()).toBe(5)
      expect(result.current.startDate.getDate()).toBe(1)
    })

    it('should navigate multiple times correctly', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      act(() => {
        result.current.goToNext()
      })
      act(() => {
        result.current.goToNext()
      })

      expect(result.current.startDate.getDate()).toBe(29) // 15 + 7 + 7 = 29
    })
  })

  describe('range manipulation', () => {
    it('should set range with start and end dates', () => {
      const { result } = renderHook(() => useDateRange())

      act(() => {
        result.current.setRange(
          new Date(2024, 2, 1),
          new Date(2024, 2, 10)
        )
      })

      expect(result.current.startDate.getMonth()).toBe(2)
      expect(result.current.startDate.getDate()).toBe(1)
      expect(result.current.rangeDays).toBe(10)
    })

    it('should set range days', () => {
      const { result } = renderHook(() => useDateRange())

      act(() => {
        result.current.setRangeDays(14)
      })

      expect(result.current.rangeDays).toBe(14)
      expect(result.current.datesInRange.length).toBe(14)
    })

    it('should enforce minimum of 1 day', () => {
      const { result } = renderHook(() => useDateRange())

      act(() => {
        result.current.setRangeDays(0)
      })

      expect(result.current.rangeDays).toBe(1)

      act(() => {
        result.current.setRangeDays(-5)
      })

      expect(result.current.rangeDays).toBe(1)
    })
  })

  describe('isToday', () => {
    it('should return true for today', () => {
      const { result } = renderHook(() => useDateRange())

      expect(result.current.isToday(new Date(2024, 0, 15))).toBe(true)
      expect(result.current.isToday(new Date(2024, 0, 15, 23, 59))).toBe(true)
    })

    it('should return false for other days', () => {
      const { result } = renderHook(() => useDateRange())

      expect(result.current.isToday(new Date(2024, 0, 14))).toBe(false)
      expect(result.current.isToday(new Date(2024, 0, 16))).toBe(false)
    })
  })

  describe('isInRange', () => {
    it('should return true for dates in range', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      expect(result.current.isInRange(new Date(2024, 0, 15))).toBe(true) // First day
      expect(result.current.isInRange(new Date(2024, 0, 18))).toBe(true) // Middle
      expect(result.current.isInRange(new Date(2024, 0, 21))).toBe(true) // Last day
    })

    it('should return false for dates outside range', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      expect(result.current.isInRange(new Date(2024, 0, 14))).toBe(false) // Day before
      expect(result.current.isInRange(new Date(2024, 0, 22))).toBe(false) // Day after
    })

    it('should update correctly after navigation', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      expect(result.current.isInRange(new Date(2024, 0, 22))).toBe(false)

      act(() => {
        result.current.goToNext()
      })

      expect(result.current.isInRange(new Date(2024, 0, 22))).toBe(true)
    })
  })

  describe('endDate computation', () => {
    it('should compute end date correctly', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      expect(result.current.endDate.getDate()).toBe(21) // 15 + 7 - 1 = 21
      expect(result.current.endDate.getHours()).toBe(23)
      expect(result.current.endDate.getMinutes()).toBe(59)
    })

    it('should update end date when range changes', () => {
      const { result } = renderHook(() =>
        useDateRange({
          initialStart: new Date(2024, 0, 15),
          defaultRangeDays: 7,
        })
      )

      act(() => {
        result.current.setRangeDays(14)
      })

      expect(result.current.endDate.getDate()).toBe(28) // 15 + 14 - 1 = 28
    })
  })
})
