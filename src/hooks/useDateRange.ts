/**
 * Hook for managing date range selection
 * Provides navigation, manipulation, and computed values for date ranges
 * @module hooks/useDateRange
 */

import { useState, useMemo, useCallback } from 'react'
import { getDateRange, isSameDay, startOfDay } from '@/lib/dateUtils'

/**
 * Options for the useDateRange hook
 */
export interface UseDateRangeOptions {
  /** Initial start date (defaults to today) */
  initialStart?: Date
  /** Initial end date (defaults to initialStart + defaultRangeDays) */
  initialEnd?: Date
  /** Default number of days in the range (default: 7) */
  defaultRangeDays?: number
}

/**
 * Result returned by the useDateRange hook
 */
export interface UseDateRangeResult {
  /** Current start date of the range */
  startDate: Date
  /** Current end date of the range */
  endDate: Date

  // Navigation
  /** Navigate to today's date range */
  goToToday: () => void
  /** Navigate to the previous range (e.g., previous week) */
  goToPrevious: () => void
  /** Navigate to the next range (e.g., next week) */
  goToNext: () => void
  /** Navigate to a specific date, making it the start of the range */
  goToDate: (date: Date) => void

  // Range manipulation
  /** Set both start and end dates */
  setRange: (start: Date, end: Date) => void
  /** Change the range duration while keeping the start date */
  setRangeDays: (days: number) => void

  // Computed values
  /** Array of all dates within the current range */
  datesInRange: Date[]
  /** Check if a date is today */
  isToday: (date: Date) => boolean
  /** Check if a date is within the current range */
  isInRange: (date: Date) => boolean
  /** Current range duration in days */
  rangeDays: number
}

/**
 * Hook for managing date range selection
 * Provides navigation and manipulation utilities for calendar views
 *
 * @example
 * ```tsx
 * function CalendarView() {
 *   const {
 *     startDate,
 *     endDate,
 *     datesInRange,
 *     goToToday,
 *     goToPrevious,
 *     goToNext,
 *   } = useDateRange({ defaultRangeDays: 7 });
 *
 *   return (
 *     <div>
 *       <button onClick={goToPrevious}>Previous</button>
 *       <button onClick={goToToday}>Today</button>
 *       <button onClick={goToNext}>Next</button>
 *       <div>
 *         {datesInRange.map(date => (
 *           <DayColumn key={date.toISOString()} date={date} />
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param options - Configuration options for the hook
 * @returns Object with date range state and manipulation functions
 */
export function useDateRange(options: UseDateRangeOptions = {}): UseDateRangeResult {
  const {
    initialStart,
    initialEnd,
    defaultRangeDays = 7,
  } = options

  // Initialize dates
  const [startDate, setStartDate] = useState<Date>(() => {
    if (initialStart) {
      return startOfDay(initialStart)
    }
    return startOfDay(new Date())
  })

  const [rangeDays, setRangeDaysState] = useState<number>(() => {
    if (initialStart && initialEnd) {
      const diffTime = initialEnd.getTime() - initialStart.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return Math.max(1, diffDays + 1) // +1 because end date is inclusive
    }
    return defaultRangeDays
  })

  // Compute end date from start date and range days
  const endDate = useMemo(() => {
    const end = new Date(startDate)
    end.setDate(end.getDate() + rangeDays - 1)
    end.setHours(23, 59, 59, 999)
    return end
  }, [startDate, rangeDays])

  // Compute all dates in range
  const datesInRange = useMemo(() => {
    return getDateRange(startDate, rangeDays)
  }, [startDate, rangeDays])

  // Today's date for comparison (memoized to avoid recreating on each render)
  const today = useMemo(() => startOfDay(new Date()), [])

  // Navigation functions
  const goToToday = useCallback(() => {
    setStartDate(startOfDay(new Date()))
  }, [])

  const goToPrevious = useCallback(() => {
    setStartDate((current) => {
      const newDate = new Date(current)
      newDate.setDate(newDate.getDate() - rangeDays)
      return newDate
    })
  }, [rangeDays])

  const goToNext = useCallback(() => {
    setStartDate((current) => {
      const newDate = new Date(current)
      newDate.setDate(newDate.getDate() + rangeDays)
      return newDate
    })
  }, [rangeDays])

  const goToDate = useCallback((date: Date) => {
    setStartDate(startOfDay(date))
  }, [])

  // Range manipulation functions
  const setRange = useCallback((start: Date, end: Date) => {
    const normalizedStart = startOfDay(start)
    setStartDate(normalizedStart)

    const diffTime = end.getTime() - normalizedStart.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setRangeDaysState(Math.max(1, diffDays + 1))
  }, [])

  const setRangeDays = useCallback((days: number) => {
    setRangeDaysState(Math.max(1, days))
  }, [])

  // Computed helper functions
  const isToday = useCallback((date: Date): boolean => {
    return isSameDay(date, today)
  }, [today])

  const isInRange = useCallback((date: Date): boolean => {
    const normalizedDate = startOfDay(date)
    return normalizedDate >= startDate && normalizedDate <= endDate
  }, [startDate, endDate])

  return {
    startDate,
    endDate,
    goToToday,
    goToPrevious,
    goToNext,
    goToDate,
    setRange,
    setRangeDays,
    datesInRange,
    isToday,
    isInRange,
    rangeDays,
  }
}
