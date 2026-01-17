/**
 * Hook for fetching and managing calendar availability data
 * Provides availability windows, free slots, and helper functions
 * @module hooks/useAvailability
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { AvailabilityWindow, TimeSlot } from '@/types'
import { getAvailability } from '@/services/availability'
import {
  groupAvailabilityByDate,
  getFreeSlots as getFreeSlotsFromWindow,
  formatDateKey,
} from '@/services/availabilityTransformers'

/**
 * Options for the useAvailability hook
 */
export interface UseAvailabilityOptions {
  /** Start date for the availability query */
  startDate: Date
  /** End date for the availability query */
  endDate: Date
  /** Calendar IDs to query (if not provided, uses enabled calendars) */
  calendarIds?: string[]
  /** Working hours constraint */
  workingHours?: { start: string; end: string }
  /** Whether to enable fetching (for conditional queries) */
  enabled?: boolean
  /** User's timezone (IANA format) */
  timezone?: string
}

/**
 * Result returned by the useAvailability hook
 */
export interface UseAvailabilityResult {
  /** Array of availability windows */
  availability: AvailabilityWindow[]
  /** Whether data is currently being loaded */
  isLoading: boolean
  /** Error if the fetch failed */
  error: Error | null
  /** Function to manually refetch data */
  refetch: () => Promise<void>

  // Helper functions
  /** Get availability for a specific date */
  getAvailabilityForDate: (date: Date) => AvailabilityWindow | undefined
  /** Get free time slots for a specific date */
  getFreeSlots: (date: Date, minDuration?: number) => TimeSlot[]
  /** Get total free minutes for a specific date */
  getTotalFreeMinutes: (date: Date) => number
}

/**
 * Generates a cache key from the options
 */
function generateCacheKey(options: UseAvailabilityOptions): string {
  const parts = [
    options.startDate.toISOString(),
    options.endDate.toISOString(),
    options.calendarIds?.sort().join(',') || 'default',
    options.workingHours ? `${options.workingHours.start}-${options.workingHours.end}` : 'none',
    options.timezone || 'default',
  ]
  return parts.join('|')
}

/**
 * Hook for fetching calendar availability data
 * Manages loading state, caching, and provides helper functions
 *
 * @example
 * ```tsx
 * function SchedulingView() {
 *   const { startDate, endDate } = useDateRange();
 *   const {
 *     availability,
 *     isLoading,
 *     error,
 *     getAvailabilityForDate,
 *     getFreeSlots,
 *   } = useAvailability({
 *     startDate,
 *     endDate,
 *     workingHours: { start: '09:00', end: '17:00' },
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return (
 *     <div>
 *       {availability.map(window => (
 *         <DayAvailability key={window.date.toISOString()} window={window} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param options - Configuration options for the hook
 * @returns Object with availability data, loading state, and helper functions
 */
export function useAvailability(options: UseAvailabilityOptions): UseAvailabilityResult {
  const {
    startDate,
    endDate,
    calendarIds,
    workingHours,
    enabled = true,
    timezone,
  } = options

  const [availability, setAvailability] = useState<AvailabilityWindow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track the last cache key to avoid redundant fetches
  const lastCacheKeyRef = useRef<string>('')
  const lastFetchSucceededRef = useRef(false)
  const isMountedRef = useRef(true)

  // Memoize the availability map for quick lookups
  const availabilityByDate = useMemo(() => {
    return groupAvailabilityByDate(availability)
  }, [availability])

  // Fetch function
  const fetchAvailability = useCallback(async () => {
    if (!enabled) {
      return
    }

    const cacheKey = generateCacheKey(options)

    // Skip if the options haven't changed (same cache key) and the last fetch succeeded
    if (cacheKey === lastCacheKeyRef.current && lastFetchSucceededRef.current) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await getAvailability({
        startDate,
        endDate,
        calendarIds,
        workingHours,
        timezone,
      })

      if (isMountedRef.current) {
        setAvailability(data)
        lastCacheKeyRef.current = cacheKey
        lastFetchSucceededRef.current = true
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch availability'))
        lastFetchSucceededRef.current = false
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [enabled, startDate, endDate, calendarIds, workingHours, timezone, options, availability.length])

  // Refetch function (forces a fresh fetch)
  const refetch = useCallback(async () => {
    lastCacheKeyRef.current = '' // Clear cache key to force refetch
    await fetchAvailability()
  }, [fetchAvailability])

  // Effect to fetch data when options change
  useEffect(() => {
    isMountedRef.current = true
    fetchAvailability()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchAvailability])

  // Helper: Get availability for a specific date
  const getAvailabilityForDate = useCallback((date: Date): AvailabilityWindow | undefined => {
    const dateKey = formatDateKey(date)
    return availabilityByDate.get(dateKey)
  }, [availabilityByDate])

  // Helper: Get free slots for a specific date
  const getFreeSlots = useCallback((date: Date, minDuration?: number): TimeSlot[] => {
    const window = getAvailabilityForDate(date)
    if (!window) return []
    return getFreeSlotsFromWindow(window, minDuration)
  }, [getAvailabilityForDate])

  // Helper: Get total free minutes for a specific date
  const getTotalFreeMinutes = useCallback((date: Date): number => {
    const window = getAvailabilityForDate(date)
    return window?.totalFreeMinutes ?? 0
  }, [getAvailabilityForDate])

  return {
    availability,
    isLoading,
    error,
    refetch,
    getAvailabilityForDate,
    getFreeSlots,
    getTotalFreeMinutes,
  }
}
