/**
 * Free/Busy query function
 * Queries Google Calendar API for free/busy information
 * @module calendar/freeBusy
 */

import * as functions from 'firebase-functions';
import { calendar_v3 } from 'googleapis';
import { getCalendarClient } from './client';

/**
 * Parameters for getFreeBusy function
 */
interface GetFreeBusyParams {
  /** Array of calendar IDs to query */
  calendarIds: string[];
  /** Start of time range (ISO string) */
  timeMin: string;
  /** End of time range (ISO string) */
  timeMax: string;
  /** Timezone for the query (IANA format) */
  timeZone?: string;
}

/**
 * Response structure for a single calendar's busy periods
 */
interface CalendarBusyInfo {
  /** Array of busy time periods */
  busy: Array<{ start: string; end: string }>;
  /** Array of errors if any occurred */
  errors?: Array<{ domain: string; reason: string }>;
}

/**
 * Response from getFreeBusy function
 */
interface GetFreeBusyResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Map of calendar ID to busy information */
  calendars: { [calendarId: string]: CalendarBusyInfo };
  /** Error message if request failed */
  error?: string;
}

/**
 * Callable function to get free/busy information for calendars
 * Queries Google Calendar API for busy periods across multiple calendars
 *
 * @example
 * const result = await getFreeBusy({
 *   calendarIds: ['primary', 'work@example.com'],
 *   timeMin: '2024-01-01T00:00:00Z',
 *   timeMax: '2024-01-07T23:59:59Z',
 *   timeZone: 'America/New_York'
 * });
 */
export const getFreeBusy = functions.https.onCall(
  async (data: GetFreeBusyParams, context): Promise<GetFreeBusyResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to query free/busy'
      );
    }

    const userId = context.auth.uid;
    const { calendarIds, timeMin, timeMax, timeZone } = data;

    // Validate required parameters
    if (!calendarIds || calendarIds.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one calendar ID is required'
      );
    }

    if (!timeMin || !timeMax) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Time range (timeMin and timeMax) is required'
      );
    }

    // Validate time range (max 90 days)
    const startTime = new Date(timeMin).getTime();
    const endTime = new Date(timeMax).getTime();
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days

    if (endTime - startTime > maxRangeMs) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Time range cannot exceed 90 days'
      );
    }

    try {
      // Get authenticated calendar client
      const calendar = await getCalendarClient(userId);

      if (!calendar) {
        return {
          success: false,
          calendars: {},
          error: 'Calendar not connected. Please connect your calendar first.',
        };
      }

      console.log(
        `Querying free/busy for user ${userId}, calendars: ${calendarIds.join(', ')}`
      );

      // Query free/busy API
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          timeZone: timeZone || 'UTC',
          items: calendarIds.map((id) => ({ id })),
        },
      });

      // Transform response
      const calendarsResult: { [calendarId: string]: CalendarBusyInfo } = {};

      const calendarsData = response.data.calendars || {};

      for (const calendarId of calendarIds) {
        const calendarInfo = calendarsData[calendarId];

        if (calendarInfo) {
          calendarsResult[calendarId] = {
            busy: (calendarInfo.busy || []).map((period) => ({
              start: period.start || '',
              end: period.end || '',
            })),
            errors: calendarInfo.errors?.map((error) => ({
              domain: error.domain || 'unknown',
              reason: error.reason || 'unknown',
            })),
          };
        } else {
          // Calendar not found or no data
          calendarsResult[calendarId] = {
            busy: [],
            errors: [{ domain: 'calendar', reason: 'notFound' }],
          };
        }
      }

      console.log(`Free/busy query completed for ${Object.keys(calendarsResult).length} calendars`);

      return {
        success: true,
        calendars: calendarsResult,
      };
    } catch (error) {
      console.error(`Error querying free/busy for user ${userId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error types
      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        return {
          success: false,
          calendars: {},
          error: 'Calendar access has been revoked. Please reconnect your calendar.',
        };
      }

      if (errorMessage.includes('Rate Limit') || errorMessage.includes('429')) {
        return {
          success: false,
          calendars: {},
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      throw new functions.https.HttpsError('internal', 'Failed to query free/busy');
    }
  }
);

/**
 * Internal function to query free/busy (for use by other server-side functions)
 * Does not require Firebase context
 *
 * @param calendar - Authenticated calendar client
 * @param calendarIds - Array of calendar IDs
 * @param timeMin - Start of time range
 * @param timeMax - End of time range
 * @param timeZone - Timezone for the query
 * @returns Free/busy information for each calendar
 */
export async function queryFreeBusyInternal(
  calendar: calendar_v3.Calendar,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
  timeZone: string = 'UTC'
): Promise<{ [calendarId: string]: CalendarBusyInfo }> {
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone,
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const result: { [calendarId: string]: CalendarBusyInfo } = {};
  const calendarsData = response.data.calendars || {};

  for (const calendarId of calendarIds) {
    const calendarInfo = calendarsData[calendarId];

    if (calendarInfo) {
      result[calendarId] = {
        busy: (calendarInfo.busy || []).map((period) => ({
          start: period.start || '',
          end: period.end || '',
        })),
        errors: calendarInfo.errors?.map((error) => ({
          domain: error.domain || 'unknown',
          reason: error.reason || 'unknown',
        })),
      };
    } else {
      result[calendarId] = {
        busy: [],
        errors: [{ domain: 'calendar', reason: 'notFound' }],
      };
    }
  }

  return result;
}

/**
 * Merge busy periods from multiple calendars into a single list
 *
 * @param calendarsInfo - Map of calendar ID to busy information
 * @returns Merged array of busy periods
 */
export function mergeBusyPeriodsFromCalendars(
  calendarsInfo: { [calendarId: string]: CalendarBusyInfo }
): Array<{ start: Date; end: Date }> {
  const allPeriods: Array<{ start: Date; end: Date }> = [];

  for (const calendarId in calendarsInfo) {
    const calendarInfo = calendarsInfo[calendarId];

    // Skip calendars with errors
    if (calendarInfo.errors && calendarInfo.errors.length > 0) {
      console.log(`Skipping calendar ${calendarId} due to errors`);
      continue;
    }

    for (const period of calendarInfo.busy) {
      if (period.start && period.end) {
        allPeriods.push({
          start: new Date(period.start),
          end: new Date(period.end),
        });
      }
    }
  }

  return allPeriods;
}
