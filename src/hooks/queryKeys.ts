/**
 * Query key factory for cache management
 * Provides consistent cache key generation for availability-related data
 * @module hooks/queryKeys
 */

/**
 * Parameters for availability windows query
 */
export interface AvailabilityWindowsParams {
  start: string
  end: string
  calendars: string[]
}

/**
 * Parameters for calendar events query
 */
export interface CalendarEventsParams {
  calendarId: string
  start: string
  end: string
}

/**
 * Parameters for free/busy query
 */
export interface FreeBusyParams {
  calendars: string[]
  start: string
  end: string
}

/**
 * Query key factory for availability-related queries
 * Use these keys to ensure consistent caching across the application
 *
 * @example
 * ```typescript
 * // For React Query
 * const { data } = useQuery({
 *   queryKey: availabilityKeys.windows({ start: '2024-01-01', end: '2024-01-07', calendars: ['cal-1'] }),
 *   queryFn: () => getAvailability({ ... })
 * })
 * ```
 */
export const availabilityKeys = {
  /**
   * Base key for all availability-related queries
   */
  all: ['availability'] as const,

  /**
   * Key for availability windows query
   * @param params - Query parameters including start, end, and calendar IDs
   * @returns Query key array for availability windows
   */
  windows: (params: AvailabilityWindowsParams) =>
    [...availabilityKeys.all, 'windows', params] as const,

  /**
   * Key for calendar events query
   * @param params - Query parameters including calendarId, start, and end
   * @returns Query key array for calendar events
   */
  events: (params: CalendarEventsParams) =>
    [...availabilityKeys.all, 'events', params] as const,

  /**
   * Key for free/busy query
   * @param params - Query parameters including calendars, start, and end
   * @returns Query key array for free/busy data
   */
  freeBusy: (params: FreeBusyParams) =>
    [...availabilityKeys.all, 'freeBusy', params] as const,
} as const

/**
 * Query key factory for calendar-related queries
 */
export const calendarKeys = {
  /**
   * Base key for all calendar-related queries
   */
  all: ['calendars'] as const,

  /**
   * Key for the list of connected calendars
   */
  list: () => [...calendarKeys.all, 'list'] as const,

  /**
   * Key for a single calendar's details
   * @param calendarId - The calendar's ID
   */
  detail: (calendarId: string) =>
    [...calendarKeys.all, 'detail', calendarId] as const,

  /**
   * Key for calendar connection status
   */
  connection: () => [...calendarKeys.all, 'connection'] as const,

  /**
   * Key for calendar preferences
   */
  preferences: () => [...calendarKeys.all, 'preferences'] as const,
} as const

/**
 * Utility function to create a date string for cache keys
 * @param date - The date to format
 * @returns ISO date string (YYYY-MM-DD)
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Creates query parameters for availability queries from Date objects
 * @param startDate - Start date
 * @param endDate - End date
 * @param calendarIds - Array of calendar IDs
 * @returns Formatted parameters suitable for query keys
 */
export function createAvailabilityParams(
  startDate: Date,
  endDate: Date,
  calendarIds: string[]
): AvailabilityWindowsParams {
  return {
    start: toDateString(startDate),
    end: toDateString(endDate),
    calendars: [...calendarIds].sort(), // Sort for consistent cache keys
  }
}

/**
 * Creates query parameters for calendar events queries from Date objects
 * @param calendarId - The calendar ID
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted parameters suitable for query keys
 */
export function createEventsParams(
  calendarId: string,
  startDate: Date,
  endDate: Date
): CalendarEventsParams {
  return {
    calendarId,
    start: toDateString(startDate),
    end: toDateString(endDate),
  }
}

/**
 * Creates query parameters for free/busy queries from Date objects
 * @param calendarIds - Array of calendar IDs
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted parameters suitable for query keys
 */
export function createFreeBusyParams(
  calendarIds: string[],
  startDate: Date,
  endDate: Date
): FreeBusyParams {
  return {
    calendars: [...calendarIds].sort(), // Sort for consistent cache keys
    start: toDateString(startDate),
    end: toDateString(endDate),
  }
}
