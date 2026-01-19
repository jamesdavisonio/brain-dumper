/**
 * Availability service for interacting with Cloud Functions
 * Handles calendar event fetching, free/busy data, and availability calculations
 * @module services/availability
 */

import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import type { CalendarEvent, AvailabilityWindow } from '@/types'

/**
 * Parameters for fetching calendar events
 */
export interface GetCalendarEventsParams {
  calendarId: string
  startDate: Date
  endDate: Date
}

/**
 * Parameters for fetching free/busy data
 */
export interface GetFreeBusyParams {
  calendarIds: string[]
  startDate: Date
  endDate: Date
}

/**
 * Parameters for fetching availability
 */
export interface GetAvailabilityParams {
  calendarIds?: string[]
  startDate: Date
  endDate: Date
  workingHours?: { start: string; end: string }
  timezone?: string
}

/**
 * Parameters for syncing calendar events
 */
export interface SyncCalendarEventsParams {
  calendarId: string
  fullSync?: boolean
}

/**
 * Result of a calendar sync operation
 */
export interface SyncCalendarEventsResult {
  success: boolean
  eventsUpdated: number
}

/**
 * Free/busy time range
 */
export interface FreeBusyRange {
  start: Date
  end: Date
}

/**
 * Serialized versions for Cloud Function communication
 */
interface SerializedCalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  start: string
  end: string
  allDay: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
  brainDumperTaskId?: string
  brainDumperBufferType?: 'before' | 'after'
  recurringEventId?: string
  htmlLink?: string
}

interface SerializedAvailabilityWindow {
  date: string
  slots: Array<{
    start: string
    end: string
    available: boolean
    calendarId?: string
    eventId?: string
  }>
  totalFreeMinutes: number
  totalBusyMinutes: number
}

interface SerializedFreeBusyRange {
  start: string
  end: string
}

/**
 * Fetches calendar events for a date range
 * @param params - Parameters containing calendarId, startDate, and endDate
 * @returns Promise resolving to array of CalendarEvent objects
 */
export async function getCalendarEvents(params: GetCalendarEventsParams): Promise<CalendarEvent[]> {
  const getEvents = httpsCallable<
    { calendarId: string; timeMin: string; timeMax: string },
    { success: boolean; events: SerializedCalendarEvent[]; error?: string }
  >(functions, 'getCalendarEvents')

  const result = await getEvents({
    calendarId: params.calendarId,
    timeMin: params.startDate.toISOString(),
    timeMax: params.endDate.toISOString(),
  })

  if (!result.data.success) {
    throw new Error(result.data.error || 'Failed to fetch calendar events')
  }

  return result.data.events.map(deserializeCalendarEvent)
}

/**
 * Gets free/busy data for multiple calendars
 * @param params - Parameters containing calendarIds, startDate, and endDate
 * @returns Promise resolving to a record mapping calendar IDs to busy time ranges
 */
export async function getFreeBusy(
  params: GetFreeBusyParams
): Promise<Record<string, FreeBusyRange[]>> {
  const fetchFreeBusy = httpsCallable<
    { calendarIds: string[]; startDate: string; endDate: string },
    Record<string, SerializedFreeBusyRange[]>
  >(functions, 'getFreeBusy')

  const result = await fetchFreeBusy({
    calendarIds: params.calendarIds,
    startDate: params.startDate.toISOString(),
    endDate: params.endDate.toISOString(),
  })

  // Convert serialized dates back to Date objects
  const deserialized: Record<string, FreeBusyRange[]> = {}
  for (const [calendarId, ranges] of Object.entries(result.data)) {
    deserialized[calendarId] = ranges.map((range) => ({
      start: new Date(range.start),
      end: new Date(range.end),
    }))
  }

  return deserialized
}

/**
 * Formats a Date to YYYY-MM-DD string for the availability API
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Gets processed availability windows for scheduling
 * @param params - Parameters for availability calculation
 * @returns Promise resolving to array of AvailabilityWindow objects
 */
export async function getAvailability(params: GetAvailabilityParams): Promise<AvailabilityWindow[]> {
  const fetchAvailability = httpsCallable<
    {
      calendarIds?: string[]
      startDate: string
      endDate: string
      workingHours?: { start: string; end: string }
      timezone: string
    },
    {
      success: boolean
      availability: SerializedAvailabilityWindow[]
      error?: string
    }
  >(functions, 'getAvailability')

  // Use provided timezone or default to user's local timezone
  const timezone = params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  const result = await fetchAvailability({
    calendarIds: params.calendarIds,
    startDate: formatDateString(params.startDate),
    endDate: formatDateString(params.endDate),
    workingHours: params.workingHours,
    timezone,
  })

  // Handle error responses
  if (!result.data.success) {
    throw new Error(result.data.error || 'Failed to fetch availability')
  }

  // Ensure availability array exists before mapping
  if (!result.data.availability || !Array.isArray(result.data.availability)) {
    console.warn('[getAvailability] No availability data in response:', result.data)
    return []
  }

  return result.data.availability.map(deserializeAvailabilityWindow)
}

/**
 * Triggers a sync of calendar events from the external calendar provider
 * @param params - Parameters containing calendarId and optional fullSync flag
 * @returns Promise resolving to sync result with success status and event count
 */
export async function syncCalendarEvents(
  params: SyncCalendarEventsParams
): Promise<SyncCalendarEventsResult> {
  const sync = httpsCallable<
    { calendarId: string; fullSync?: boolean },
    SyncCalendarEventsResult
  >(functions, 'syncCalendarEvents')

  const result = await sync({
    calendarId: params.calendarId,
    fullSync: params.fullSync,
  })

  return result.data
}

/**
 * Deserializes a calendar event from the Cloud Function response
 */
function deserializeCalendarEvent(event: SerializedCalendarEvent): CalendarEvent {
  return {
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  }
}

/**
 * Deserializes an availability window from the Cloud Function response
 */
function deserializeAvailabilityWindow(window: SerializedAvailabilityWindow): AvailabilityWindow {
  return {
    date: new Date(window.date),
    slots: window.slots.map((slot) => ({
      ...slot,
      start: new Date(slot.start),
      end: new Date(slot.end),
    })),
    totalFreeMinutes: window.totalFreeMinutes,
    totalBusyMinutes: window.totalBusyMinutes,
  }
}
