/**
 * Fetch calendar events function
 * Retrieves events from Google Calendar API
 * @module calendar/fetchEvents
 */

import * as functions from 'firebase-functions';
import { calendar_v3 } from 'googleapis';
import { GaxiosResponse } from 'gaxios';
import { CalendarEvent } from '../types';
import { getCalendarClient } from './client';

/**
 * Parameters for getCalendarEvents function
 */
interface GetCalendarEventsParams {
  /** Calendar ID to fetch events from */
  calendarId: string;
  /** Start of time range (ISO string) */
  timeMin: string;
  /** End of time range (ISO string) */
  timeMax: string;
  /** Maximum number of events to return (default 250) */
  maxResults?: number;
  /** Include single instances of recurring events (default true) */
  singleEvents?: boolean;
}

/**
 * Response from getCalendarEvents function
 */
interface GetCalendarEventsResponse {
  /** Whether the request was successful */
  success: boolean;
  /** List of calendar events */
  events: CalendarEvent[];
  /** Next page token if more results exist */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
  /** Error message if request failed */
  error?: string;
}

/**
 * Transform Google Calendar event to our CalendarEvent format
 *
 * @param event - Google Calendar API event
 * @param calendarId - ID of the calendar this event belongs to
 * @returns Transformed CalendarEvent
 */
function transformEvent(
  event: calendar_v3.Schema$Event,
  calendarId: string
): CalendarEvent | null {
  // Skip events without IDs or that are cancelled
  if (!event.id || event.status === 'cancelled') {
    return null;
  }

  // Determine if all-day event
  const isAllDay = !event.start?.dateTime && !!event.start?.date;

  // Get start and end times
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;

  if (!start || !end) {
    console.log(`Skipping event ${event.id} due to missing start/end times`);
    return null;
  }

  // Parse extended properties for Brain Dumper integration
  const privateProps = event.extendedProperties?.private || {};

  return {
    id: event.id,
    calendarId,
    title: event.summary || 'Untitled Event',
    description: event.description || undefined,
    start: isAllDay ? new Date(start).toISOString() : start,
    end: isAllDay ? new Date(end).toISOString() : end,
    allDay: isAllDay,
    status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
    brainDumperTaskId: privateProps.brainDumperTaskId || undefined,
    brainDumperBufferType: (privateProps.brainDumperBufferType as 'before' | 'after') || undefined,
    recurringEventId: event.recurringEventId || undefined,
    htmlLink: event.htmlLink || undefined,
  };
}

/**
 * Callable function to get calendar events
 * Fetches events from Google Calendar API and transforms to CalendarEvent format
 *
 * @example
 * const result = await getCalendarEvents({
 *   calendarId: 'primary',
 *   timeMin: '2024-01-01T00:00:00Z',
 *   timeMax: '2024-01-31T23:59:59Z'
 * });
 */
export const getCalendarEvents = functions.https.onCall(
  async (data: GetCalendarEventsParams, context): Promise<GetCalendarEventsResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to get calendar events'
      );
    }

    const userId = context.auth.uid;
    const {
      calendarId,
      timeMin,
      timeMax,
      maxResults = 250,
      singleEvents = true,
    } = data;

    // Validate required parameters
    if (!calendarId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Calendar ID is required'
      );
    }

    if (!timeMin || !timeMax) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Time range (timeMin and timeMax) is required'
      );
    }

    try {
      // Get authenticated calendar client
      const calendar = await getCalendarClient(userId);

      if (!calendar) {
        return {
          success: false,
          events: [],
          error: 'Calendar not connected. Please connect your calendar first.',
        };
      }

      console.log(`Fetching events for user ${userId}, calendar ${calendarId}`);

      // Fetch events with pagination handling
      const allEvents: CalendarEvent[] = [];
      let pageToken: string | undefined = undefined;
      let nextSyncToken: string | undefined = undefined;

      do {
        const response: GaxiosResponse<calendar_v3.Schema$Events> =
          await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults: Math.min(maxResults - allEvents.length, 250),
            singleEvents,
            orderBy: 'startTime',
            pageToken,
          });

        const events = response.data.items || [];

        // Transform and filter events
        for (const event of events) {
          const transformed = transformEvent(event, calendarId);
          if (transformed) {
            allEvents.push(transformed);
          }
        }

        pageToken = response.data.nextPageToken || undefined;
        nextSyncToken = response.data.nextSyncToken || undefined;

        // Stop if we've reached the requested max results
        if (allEvents.length >= maxResults) {
          break;
        }
      } while (pageToken);

      console.log(`Retrieved ${allEvents.length} events for calendar ${calendarId}`);

      return {
        success: true,
        events: allEvents,
        nextSyncToken,
      };
    } catch (error) {
      console.error(`Error getting calendar events for user ${userId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error types
      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        return {
          success: false,
          events: [],
          error: 'Calendar access has been revoked. Please reconnect your calendar.',
        };
      }

      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        return {
          success: false,
          events: [],
          error: 'Calendar not found. It may have been deleted.',
        };
      }

      if (errorMessage.includes('Forbidden') || errorMessage.includes('403')) {
        return {
          success: false,
          events: [],
          error: 'Access denied to this calendar.',
        };
      }

      throw new functions.https.HttpsError('internal', 'Failed to get calendar events');
    }
  }
);

/**
 * Internal function to fetch events (for use by other server-side functions)
 * Does not require Firebase context
 *
 * @param calendar - Authenticated calendar client
 * @param calendarId - Calendar ID
 * @param timeMin - Start of time range
 * @param timeMax - End of time range
 * @param options - Additional options
 * @returns Array of calendar events
 */
export async function fetchEventsInternal(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  options: {
    maxResults?: number;
    singleEvents?: boolean;
    syncToken?: string;
  } = {}
): Promise<{
  events: CalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}> {
  const { maxResults = 250, singleEvents = true, syncToken } = options;

  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined = undefined;
  let nextSyncToken: string | undefined = undefined;

  do {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      maxResults: Math.min(maxResults - allEvents.length, 250),
      pageToken,
    };

    // If sync token is provided, use incremental sync
    if (syncToken) {
      params.syncToken = syncToken;
    } else {
      // Full sync uses time range
      params.timeMin = timeMin;
      params.timeMax = timeMax;
      params.singleEvents = singleEvents;
      params.orderBy = singleEvents ? 'startTime' : undefined;
    }

    const response: GaxiosResponse<calendar_v3.Schema$Events> =
      await calendar.events.list(params);

    const events = response.data.items || [];

    for (const event of events) {
      const transformed = transformEvent(event, calendarId);
      if (transformed) {
        allEvents.push(transformed);
      }
    }

    pageToken = response.data.nextPageToken || undefined;
    nextSyncToken = response.data.nextSyncToken || undefined;

    if (allEvents.length >= maxResults) {
      break;
    }
  } while (pageToken);

  return {
    events: allEvents,
    nextSyncToken,
    nextPageToken: pageToken,
  };
}
