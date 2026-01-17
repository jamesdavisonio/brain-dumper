/**
 * Sync utilities for Task <-> Calendar synchronization
 * Provides shared utilities for sync operations
 * @module sync/syncUtils
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getAuthenticatedClient } from '../oauth/tokenStorage';
import { google, calendar_v3 } from 'googleapis';

/**
 * Metadata tracking sync state for a task
 */
export interface SyncMetadata {
  /** When the task was last synced to calendar */
  lastSyncedAt: Date;
  /** The Google Calendar event ID */
  calendarEventId: string | null;
  /** Current sync status */
  syncStatus: 'synced' | 'pending' | 'error';
  /** Error message if sync failed */
  syncError?: string;
}

/**
 * Get an authenticated Google Calendar client for a user
 *
 * @param userId - The user's Firebase UID
 * @returns Google Calendar API client or null if authentication fails
 */
export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar | null> {
  try {
    const auth = await getAuthenticatedClient(userId);
    if (!auth) {
      console.error(`No authenticated client for user ${userId}`);
      return null;
    }
    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('Failed to get calendar client:', error);
    return null;
  }
}

/**
 * Update the sync metadata on a task document
 *
 * @param taskId - The task document ID
 * @param metadata - Partial sync metadata to update
 */
export async function updateSyncMetadata(
  taskId: string,
  metadata: Partial<SyncMetadata>
): Promise<void> {
  const db = getFirestore();
  await db.collection('tasks').doc(taskId).update({
    syncMetadata: {
      ...metadata,
      lastSyncedAt: new Date()
    }
  });
}

/**
 * Determine if a task should be synced to calendar
 * Only tasks that have been scheduled (have scheduledStart and calendarId) should sync
 *
 * @param taskData - The task data to check
 * @returns True if the task should be synced
 */
export function shouldSyncTask(taskData: any): boolean {
  // Only sync tasks that have been scheduled (have calendarId or scheduledStart)
  return !!(taskData.scheduledStart && taskData.calendarId);
}

/**
 * Check if two dates are different (handling undefined/null)
 *
 * @param date1 - First date or timestamp
 * @param date2 - Second date or timestamp
 * @returns True if dates are different
 */
export function datesAreDifferent(
  date1: Date | string | { toDate: () => Date } | undefined | null,
  date2: Date | string | { toDate: () => Date } | undefined | null
): boolean {
  const getTime = (d: any): number | null => {
    if (!d) return null;
    if (d instanceof Date) return d.getTime();
    if (typeof d === 'string') return new Date(d).getTime();
    if (typeof d.toDate === 'function') return d.toDate().getTime();
    return null;
  };

  const time1 = getTime(date1);
  const time2 = getTime(date2);

  if (time1 === null && time2 === null) return false;
  if (time1 === null || time2 === null) return true;
  return time1 !== time2;
}

/**
 * Convert Firestore Timestamp to Date if needed
 *
 * @param value - Value that might be a Timestamp, Date, or string
 * @returns Date object or undefined
 */
export function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value.toDate === 'function') return value.toDate();
  return undefined;
}
