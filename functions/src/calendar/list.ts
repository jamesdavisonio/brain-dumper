/**
 * Calendar list function
 * Retrieves the user's calendar list from Google Calendar API
 * @module calendar/list
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google, calendar_v3 } from 'googleapis';
import { ConnectedCalendar } from '../types';
import { getAuthenticatedClient } from '../oauth/tokenStorage';
import { FIRESTORE_PATHS } from '../config/oauth';

const db = admin.firestore();

/**
 * Response from getCalendarList function
 */
interface CalendarListResponse {
  /** Whether the request was successful */
  success: boolean;
  /** List of connected calendars */
  calendars: ConnectedCalendar[];
  /** Error message if request failed */
  error?: string;
}

/**
 * Callable function to get user's calendar list
 * Fetches calendars from Google and syncs with local data
 *
 * Flow:
 * 1. Get user's access token (refresh if needed)
 * 2. Call Google Calendar API to list calendars
 * 3. Merge with locally stored calendar preferences
 * 4. Return formatted calendar list
 */
export const getCalendarList = functions.https.onCall(
  async (data, context): Promise<CalendarListResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to get calendar list'
      );
    }

    const userId = context.auth.uid;

    try {
      // Get authenticated client
      const oauth2Client = await getAuthenticatedClient(userId);

      if (!oauth2Client) {
        return {
          success: false,
          calendars: [],
          error: 'Calendar not connected. Please connect your calendar first.',
        };
      }

      // Create Calendar API client
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Fetch calendar list from Google
      const response = await calendar.calendarList.list({
        minAccessRole: 'reader',
      });

      const googleCalendars = response.data.items || [];

      // Get locally stored calendar preferences
      const localCalendars = await getLocalCalendars(userId);

      // Merge Google calendars with local preferences
      const calendars = mergeCalendars(googleCalendars, localCalendars);

      console.log(`Retrieved ${calendars.length} calendars for user ${userId}`);

      return {
        success: true,
        calendars,
      };
    } catch (error) {
      console.error(`Error getting calendar list for user ${userId}:`, error);

      // Check for specific error types
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        return {
          success: false,
          calendars: [],
          error: 'Calendar access has been revoked. Please reconnect your calendar.',
        };
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to get calendar list'
      );
    }
  }
);

/**
 * Get locally stored calendar data
 *
 * @param userId - The user's Firebase UID
 * @returns Map of calendar ID to local calendar data
 */
async function getLocalCalendars(
  userId: string
): Promise<Map<string, Partial<ConnectedCalendar>>> {
  const calendarsRef = db.collection(FIRESTORE_PATHS.calendars(userId));
  const snapshot = await calendarsRef.get();

  const localCalendars = new Map<string, Partial<ConnectedCalendar>>();

  snapshot.forEach((doc) => {
    const data = doc.data() as ConnectedCalendar;
    localCalendars.set(data.id, data);
  });

  return localCalendars;
}

/**
 * Merge Google calendars with local preferences
 *
 * @param googleCalendars - Calendars from Google API
 * @param localCalendars - Locally stored calendar preferences
 * @returns Merged calendar list
 */
function mergeCalendars(
  googleCalendars: calendar_v3.Schema$CalendarListEntry[],
  localCalendars: Map<string, Partial<ConnectedCalendar>>
): ConnectedCalendar[] {
  return googleCalendars
    .filter((cal) => cal.id) // Only include calendars with IDs
    .map((cal) => {
      const calId = cal.id as string;
      const local = localCalendars.get(calId);

      return {
        id: calId,
        name: cal.summary || 'Untitled Calendar',
        type: local?.type || inferCalendarType(cal),
        color: cal.backgroundColor || local?.color || '#4285f4',
        primary: cal.primary || false,
        accessRole: mapAccessRole(cal.accessRole),
        enabled: local?.enabled ?? (cal.primary || false),
        syncToken: local?.syncToken,
        lastSyncAt: local?.lastSyncAt,
      };
    })
    .sort((a, b) => {
      // Primary calendar first, then by name
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Infer calendar type based on calendar properties
 */
function inferCalendarType(
  cal: calendar_v3.Schema$CalendarListEntry
): 'work' | 'personal' {
  const summary = (cal.summary || '').toLowerCase();
  const workIndicators = ['work', 'office', 'job', 'business', 'company'];

  if (workIndicators.some((indicator) => summary.includes(indicator))) {
    return 'work';
  }

  return 'personal';
}

/**
 * Map Google Calendar access role to our access role type
 */
function mapAccessRole(
  role: string | undefined | null
): 'reader' | 'writer' | 'owner' {
  switch (role) {
    case 'owner':
      return 'owner';
    case 'writer':
      return 'writer';
    default:
      return 'reader';
  }
}

/**
 * Update calendar preferences in Firestore
 * Callable function to enable/disable calendars for sync
 */
export const updateCalendarSettings = functions.https.onCall(
  async (
    data: { calendarId: string; enabled?: boolean; type?: 'work' | 'personal' },
    context
  ) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to update calendar settings'
      );
    }

    const { calendarId, enabled, type } = data;

    if (!calendarId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Calendar ID is required'
      );
    }

    const userId = context.auth.uid;

    try {
      const calendarDocRef = db
        .collection(FIRESTORE_PATHS.calendars(userId))
        .doc(encodeCalendarId(calendarId));

      const updates: Partial<ConnectedCalendar> = {};

      if (typeof enabled === 'boolean') {
        updates.enabled = enabled;
      }

      if (type) {
        updates.type = type;
      }

      await calendarDocRef.set(
        {
          ...updates,
          id: calendarId, // Ensure ID is stored
        },
        { merge: true }
      );

      console.log(
        `Updated calendar settings for user ${userId}, calendar ${calendarId}`
      );

      return { success: true };
    } catch (error) {
      console.error(`Error updating calendar settings:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to update calendar settings'
      );
    }
  }
);

/**
 * Encode calendar ID for use as Firestore document ID
 */
function encodeCalendarId(calendarId: string): string {
  return encodeURIComponent(calendarId).replace(/\./g, '%2E');
}
