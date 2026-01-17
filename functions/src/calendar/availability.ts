/**
 * Availability calculation function
 * Calculates available time slots based on calendar events and working hours
 * @module calendar/availability
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getCalendarClient } from './client';
import { queryFreeBusyInternal, mergeBusyPeriodsFromCalendars } from './freeBusy';
import {
  AvailabilityWindow,
  BusyPeriod,
  calculateAvailability,
  getDateRange,
  parseDateString,
  mergeBusyPeriods,
} from './utils';
import { FIRESTORE_PATHS } from '../config/oauth';
import { ConnectedCalendar } from '../types';

const db = admin.firestore();

/**
 * Default working hours configuration
 */
const DEFAULT_WORKING_HOURS = {
  start: '09:00',
  end: '17:00',
};

/**
 * Default slot interval in minutes
 */
const DEFAULT_SLOT_INTERVAL = 30;

/**
 * Parameters for getAvailability function
 */
interface GetAvailabilityParams {
  /** Optional array of calendar IDs to check (defaults to user's enabled calendars) */
  calendarIds?: string[];
  /** Start date for availability check (ISO date string YYYY-MM-DD) */
  startDate: string;
  /** End date for availability check (ISO date string YYYY-MM-DD) */
  endDate: string;
  /** Working hours configuration */
  workingHours?: { start: string; end: string };
  /** Timezone for availability calculation (IANA format) */
  timezone: string;
  /** Slot interval in minutes (default 30) */
  slotIntervalMinutes?: number;
}

/**
 * Response from getAvailability function
 */
interface GetAvailabilityResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Availability windows for each day in the range */
  availability: AvailabilityWindow[];
  /** Total available minutes across all days */
  totalAvailableMinutes: number;
  /** Calendars that were checked */
  calendarsChecked: string[];
  /** Error message if request failed */
  error?: string;
}

/**
 * Get user's enabled calendars from Firestore
 *
 * @param userId - User's Firebase UID
 * @returns Array of enabled calendar IDs
 */
async function getUserEnabledCalendars(userId: string): Promise<string[]> {
  const calendarsRef = db.collection(FIRESTORE_PATHS.calendars(userId));
  const snapshot = await calendarsRef.where('enabled', '==', true).get();

  const calendarIds: string[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data() as Partial<ConnectedCalendar>;
    if (data.id) {
      calendarIds.push(data.id);
    }
  });

  // If no enabled calendars, try primary
  if (calendarIds.length === 0) {
    calendarIds.push('primary');
  }

  return calendarIds;
}

/**
 * Callable function to get availability for a date range
 * Calculates available time slots based on calendar events and working hours
 *
 * @example
 * const result = await getAvailability({
 *   startDate: '2024-01-15',
 *   endDate: '2024-01-21',
 *   timezone: 'America/New_York',
 *   workingHours: { start: '09:00', end: '17:00' }
 * });
 */
export const getAvailability = functions.https.onCall(
  async (data: GetAvailabilityParams, context): Promise<GetAvailabilityResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to get availability'
      );
    }

    const userId = context.auth.uid;
    const {
      calendarIds: providedCalendarIds,
      startDate,
      endDate,
      workingHours = DEFAULT_WORKING_HOURS,
      timezone,
      slotIntervalMinutes = DEFAULT_SLOT_INTERVAL,
    } = data;

    // Validate required parameters
    if (!startDate || !endDate) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Start date and end date are required'
      );
    }

    if (!timezone) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Timezone is required'
      );
    }

    // Validate date range (max 31 days)
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    const maxRangeDays = 31;
    const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    if (rangeDays > maxRangeDays) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Date range cannot exceed ${maxRangeDays} days`
      );
    }

    if (end < start) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'End date must be after start date'
      );
    }

    // Validate working hours format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(workingHours.start) || !timeRegex.test(workingHours.end)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Working hours must be in HH:mm format'
      );
    }

    try {
      // Get authenticated calendar client
      const calendar = await getCalendarClient(userId);

      if (!calendar) {
        return {
          success: false,
          availability: [],
          totalAvailableMinutes: 0,
          calendarsChecked: [],
          error: 'Calendar not connected. Please connect your calendar first.',
        };
      }

      // Get calendar IDs to check
      let calendarIds = providedCalendarIds;
      if (!calendarIds || calendarIds.length === 0) {
        calendarIds = await getUserEnabledCalendars(userId);
      }

      console.log(
        `Calculating availability for user ${userId}, dates ${startDate} to ${endDate}`
      );

      // Calculate time range for free/busy query
      // Extend by 1 day on each end to handle timezone edge cases
      const queryStart = new Date(start);
      queryStart.setDate(queryStart.getDate() - 1);
      const queryEnd = new Date(end);
      queryEnd.setDate(queryEnd.getDate() + 2);

      // Query free/busy for all calendars
      const freeBusyResult = await queryFreeBusyInternal(
        calendar,
        calendarIds,
        queryStart.toISOString(),
        queryEnd.toISOString(),
        timezone
      );

      // Merge busy periods from all calendars
      const allBusyPeriods = mergeBusyPeriodsFromCalendars(freeBusyResult);

      // Merge overlapping periods
      const mergedBusyPeriods = mergeBusyPeriods(allBusyPeriods);

      // Generate date range
      const dates = getDateRange(start, end);

      // Calculate availability for each day
      const availability: AvailabilityWindow[] = [];
      let totalAvailableMinutes = 0;

      for (const date of dates) {
        // Filter busy periods for this day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayBusyPeriods: BusyPeriod[] = mergedBusyPeriods.filter((period) => {
          return period.end > dayStart && period.start < dayEnd;
        });

        // Calculate availability for the day
        const dayAvailability = calculateAvailability(
          date,
          dayBusyPeriods,
          workingHours,
          slotIntervalMinutes,
          timezone
        );

        availability.push(dayAvailability);
        totalAvailableMinutes += dayAvailability.totalAvailableMinutes;
      }

      console.log(
        `Availability calculated: ${availability.length} days, ${totalAvailableMinutes} total minutes available`
      );

      return {
        success: true,
        availability,
        totalAvailableMinutes,
        calendarsChecked: calendarIds,
      };
    } catch (error) {
      console.error(`Error calculating availability for user ${userId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        return {
          success: false,
          availability: [],
          totalAvailableMinutes: 0,
          calendarsChecked: [],
          error: 'Calendar access has been revoked. Please reconnect your calendar.',
        };
      }

      throw new functions.https.HttpsError('internal', 'Failed to calculate availability');
    }
  }
);

/**
 * Internal function to calculate availability (for use by other server-side functions)
 *
 * @param userId - User's Firebase UID
 * @param startDate - Start date
 * @param endDate - End date
 * @param options - Additional options
 * @returns Availability response
 */
export async function calculateAvailabilityInternal(
  userId: string,
  startDate: string,
  endDate: string,
  options: {
    calendarIds?: string[];
    workingHours?: { start: string; end: string };
    timezone?: string;
    slotIntervalMinutes?: number;
  } = {}
): Promise<GetAvailabilityResponse> {
  const {
    calendarIds: providedCalendarIds,
    workingHours = DEFAULT_WORKING_HOURS,
    timezone = 'UTC',
    slotIntervalMinutes = DEFAULT_SLOT_INTERVAL,
  } = options;

  // Get authenticated calendar client
  const calendar = await getCalendarClient(userId);

  if (!calendar) {
    return {
      success: false,
      availability: [],
      totalAvailableMinutes: 0,
      calendarsChecked: [],
      error: 'Calendar not connected.',
    };
  }

  // Get calendar IDs to check
  let calendarIds = providedCalendarIds;
  if (!calendarIds || calendarIds.length === 0) {
    calendarIds = await getUserEnabledCalendars(userId);
  }

  // Parse dates
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  // Query free/busy
  const queryStart = new Date(start);
  queryStart.setDate(queryStart.getDate() - 1);
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 2);

  const freeBusyResult = await queryFreeBusyInternal(
    calendar,
    calendarIds,
    queryStart.toISOString(),
    queryEnd.toISOString(),
    timezone
  );

  // Merge busy periods
  const allBusyPeriods = mergeBusyPeriodsFromCalendars(freeBusyResult);
  const mergedBusyPeriods = mergeBusyPeriods(allBusyPeriods);

  // Generate availability for each day
  const dates = getDateRange(start, end);
  const availability: AvailabilityWindow[] = [];
  let totalAvailableMinutes = 0;

  for (const date of dates) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayBusyPeriods = mergedBusyPeriods.filter((period) => {
      return period.end > dayStart && period.start < dayEnd;
    });

    const dayAvailability = calculateAvailability(
      date,
      dayBusyPeriods,
      workingHours,
      slotIntervalMinutes,
      timezone
    );

    availability.push(dayAvailability);
    totalAvailableMinutes += dayAvailability.totalAvailableMinutes;
  }

  return {
    success: true,
    availability,
    totalAvailableMinutes,
    calendarsChecked: calendarIds,
  };
}
