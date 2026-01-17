/**
 * Calendar client wrapper
 * Provides an authenticated Google Calendar API client
 * @module calendar/client
 */

import { google, calendar_v3 } from 'googleapis';
import { getAuthenticatedClient } from '../oauth/tokenStorage';

/**
 * Get an authenticated Google Calendar API client for a user
 *
 * @param userId - The user's Firebase UID
 * @returns Authenticated Calendar API client or null if no valid tokens
 * @throws Error if calendar client creation fails
 */
export async function getCalendarClient(
  userId: string
): Promise<calendar_v3.Calendar | null> {
  const auth = await getAuthenticatedClient(userId);

  if (!auth) {
    console.log(`No authenticated client available for user ${userId}`);
    return null;
  }

  return google.calendar({ version: 'v3', auth });
}

/**
 * Get an authenticated Google Calendar API client or throw an error
 * Use this when calendar access is required and null is not acceptable
 *
 * @param userId - The user's Firebase UID
 * @returns Authenticated Calendar API client
 * @throws Error if no valid tokens or calendar not connected
 */
export async function getCalendarClientOrThrow(
  userId: string
): Promise<calendar_v3.Calendar> {
  const client = await getCalendarClient(userId);

  if (!client) {
    throw new Error('Calendar not connected. Please connect your calendar first.');
  }

  return client;
}
