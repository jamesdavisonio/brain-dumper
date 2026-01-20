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
  // Counter to force cache invalidation
  const [cacheVersion, setCacheVersion] = useState(0)

  // Track the last cache key to avoid redundant fetches
  const lastCacheKeyRef = useRef<string>('')
  const isMountedRef = useRef(true)
  const fetchInProgressRef = useRef(false)

  // Stable references for dates and calendar IDs to avoid unnecessary re-renders
  const startDateIso = startDate.toISOString()
  const endDateIso = endDate.toISOString()
  const calendarIdsKey = calendarIds.sort().join(',')

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

  // Effect to fetch data when options change
  useEffect(() => {
    isMountedRef.current = true

    const fetchEvents = async () => {
      if (!enabled || calendarIds.length === 0) {
        setEvents([])
        return
      }

      const cacheKey = `${calendarIdsKey}|${startDateIso}|${endDateIso}|v${cacheVersion}`

      // Skip if already fetching or cache is valid
      if (fetchInProgressRef.current) {
        return
      }
      if (cacheKey === lastCacheKeyRef.current) {
        return
      }

      fetchInProgressRef.current = true
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
          // Flatten, deduplicate, and sort all events by start time
          const allEvents = deduplicateEvents(results.flat())
            .sort((a, b) => a.start.getTime() - b.start.getTime())
          setEvents(allEvents)
          lastCacheKeyRef.current = cacheKey
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to fetch calendar events'))
        }
      } finally {
        fetchInProgressRef.current = false
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    fetchEvents()

    return () => {
      isMountedRef.current = false
    }
  }, [enabled, calendarIdsKey, startDateIso, endDateIso, calendarIds, startDate, endDate, cacheVersion])

  // Refetch function (forces a fresh fetch by incrementing cache version)
  const refetch = useCallback(async () => {
    // Increment cache version to invalidate cache and trigger useEffect
    setCacheVersion((v) => v + 1)
  }, [])

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

/**
 * Deduplicates calendar events by matching on title and time
 * Events are considered duplicates if they have the same title and overlapping times
 */
function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Map<string, CalendarEvent>()

  for (const event of events) {
    // Normalize title (trim whitespace, lowercase for comparison)
    const normalizedTitle = (event.title || '').trim().toLowerCase()

    // Round times to the minute to handle slight variations
    const startMinutes = Math.floor(event.start.getTime() / 60000)
    const endMinutes = Math.floor(event.end.getTime() / 60000)

    // Create a key based on normalized title and rounded times
    const key = `${normalizedTitle}|${startMinutes}|${endMinutes}`

    if (!seen.has(key)) {
      seen.set(key, event)
    }
  }

  return Array.from(seen.values())
}
