/**
 * Hook for fetching calendar events from multiple calendars
 * Provides events data with grouping and filtering utilities
 * @module hooks/useCalendarEvents
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { CalendarEvent } from '@/types'
import { getCalendarEvents } from '@/services/availability'
import { isSameDay, isWithinRange } from '@/lib/dateUtils'

/**
 * Options for the useCalendarEvents hook
 */
export interface UseCalendarEventsOptions {
  /** Calendar IDs to fetch events from */
  calendarIds: string[]
  /** Start date for the event query */
  startDate: Date
  /** End date for the event query */
  endDate: Date
  /** Whether to enable fetching (for conditional queries) */
  enabled?: boolean
}

/**
 * Result returned by the useCalendarEvents hook
 */
export interface UseCalendarEventsResult {
  /** All events from all calendars, sorted by start time */
  events: CalendarEvent[]
  /** Events grouped by calendar ID */
  eventsByCalendar: Record<string, CalendarEvent[]>
  /** Whether data is currently being loaded */
  isLoading: boolean
  /** Error if the fetch failed */
  error: Error | null
  /** Function to manually refetch data */
  refetch: () => Promise<void>

  // Helper functions
  /** Get events for a specific date */
  getEventsForDate: (date: Date) => CalendarEvent[]
  /** Get events within a specific time range */
  getEventsInRange: (start: Date, end: Date) => CalendarEvent[]
}

/**
 * Generates a cache key from the options
 */
function generateCacheKey(options: UseCalendarEventsOptions): string {
  const parts = [
    options.calendarIds.sort().join(','),
    options.startDate.toISOString(),
    options.endDate.toISOString(),
  ]
  return parts.join('|')
}

/**
 * Hook for fetching calendar events from multiple calendars
 * Manages loading state, caching, and provides helper functions
 *
 * @example
 * ```tsx
 * function EventsView() {
 *   const { startDate, endDate } = useDateRange();
 *   const {
 *     events,
 *     eventsByCalendar,
 *     isLoading,
 *     getEventsForDate,
 *   } = useCalendarEvents({
 *     calendarIds: ['cal-1', 'cal-2'],
 *     startDate,
 *     endDate,
 *   });
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <div>
 *       {events.map(event => (
 *         <EventCard key={event.id} event={event} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param options - Configuration options for the hook
 * @returns Object with events data, loading state, and helper functions
 */
export function useCalendarEvents(options: UseCalendarEventsOptions): UseCalendarEventsResult {
  const {
    calendarIds,
    startDate,
    endDate,
    enabled = true,
  } = options

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track the last cache key to avoid redundant fetches
  const lastCacheKeyRef = useRef<string>('')
  const isMountedRef = useRef(true)

  // Group events by calendar ID
  const eventsByCalendar = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {}

    for (const calendarId of calendarIds) {
      grouped[calendarId] = []
    }

    for (const event of events) {
      if (grouped[event.calendarId]) {
        grouped[event.calendarId].push(event)
      } else {
        grouped[event.calendarId] = [event]
      }
    }

    return grouped
  }, [events, calendarIds])

  // Fetch function
  const fetchEvents = useCallback(async () => {
    if (!enabled || calendarIds.length === 0) {
      setEvents([])
      return
    }

    const cacheKey = generateCacheKey(options)

    // Skip if the options haven't changed (same cache key)
    if (cacheKey === lastCacheKeyRef.current && events.length > 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch events from all calendars in parallel, handling individual failures gracefully
      const eventPromises = calendarIds.map(async (calendarId) => {
        try {
          return await getCalendarEvents({
            calendarId,
            startDate,
            endDate,
          })
        } catch (err) {
          // Log individual calendar failures but don't fail the entire request
          console.warn(`[useCalendarEvents] Failed to fetch events from calendar ${calendarId}:`, err)
          return [] // Return empty array for failed calendars
        }
      })

      const results = await Promise.all(eventPromises)

      if (isMountedRef.current) {
        // Flatten and sort all events by start time
        const allEvents = results.flat().sort((a, b) => a.start.getTime() - b.start.getTime())
        setEvents(allEvents)
        lastCacheKeyRef.current = cacheKey
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch calendar events'))
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [enabled, calendarIds, startDate, endDate, options, events.length])

  // Refetch function (forces a fresh fetch)
  const refetch = useCallback(async () => {
    lastCacheKeyRef.current = '' // Clear cache key to force refetch
    await fetchEvents()
  }, [fetchEvents])

  // Effect to fetch data when options change
  useEffect(() => {
    isMountedRef.current = true
    fetchEvents()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchEvents])

  // Helper: Get events for a specific date
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return events.filter((event) => {
      // Include event if it starts on this date
      if (isSameDay(event.start, date)) return true

      // Include all-day events that span this date
      if (event.allDay) {
        return isWithinRange(date, event.start, event.end)
      }

      // Include multi-day events that span this date
      return event.start <= date && event.end >= date
    })
  }, [events])

  // Helper: Get events within a specific time range
  const getEventsInRange = useCallback((start: Date, end: Date): CalendarEvent[] => {
    return events.filter((event) => {
      // Check if event overlaps with the range
      return event.start < end && event.end > start
    })
  }, [events])

  return {
    events,
    eventsByCalendar,
    isLoading,
    error,
    refetch,
    getEventsForDate,
    getEventsInRange,
  }
}
