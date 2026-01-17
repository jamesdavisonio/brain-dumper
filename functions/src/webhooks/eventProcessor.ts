/**
 * Event Processor module
 * Processes calendar event changes and updates corresponding tasks
 * @module webhooks/eventProcessor
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '../oauth/tokenStorage';
import { BRAIN_DUMPER_KEYS } from '../scheduling/eventBuilder';

/**
 * Represents a change detected in a calendar event
 */
export interface CalendarEventChange {
  /** Google Calendar event ID */
  eventId: string;
  /** Calendar ID where the event exists */
  calendarId: string;
  /** User who owns the calendar */
  userId: string;
  /** Event confirmation status */
  status: 'confirmed' | 'tentative' | 'cancelled';
  /** Event start time (if available) */
  start?: Date;
  /** Event end time (if available) */
  end?: Date;
  /** Whether the event was deleted */
  deleted: boolean;
}

/**
 * Stored sync token data in Firestore
 */
interface SyncTokenData {
  syncToken: string;
  lastSyncedAt: Timestamp | Date;
}

/**
 * Process a full calendar sync using incremental sync tokens
 * This is the main entry point when receiving a push notification
 *
 * @param userId - The user's Firebase UID
 * @param calendarId - The Google Calendar ID to sync
 * @returns Number of events processed
 *
 * @example
 * const processedCount = await processCalendarSync('user123', 'primary');
 * console.log(`Processed ${processedCount} events`);
 */
export async function processCalendarSync(
  userId: string,
  calendarId: string
): Promise<number> {
  const db = getFirestore();

  // Get sync token for incremental sync
  const syncDoc = await db.collection('users').doc(userId)
    .collection('calendarSync').doc(calendarId).get();

  const syncToken = syncDoc.exists ? (syncDoc.data() as SyncTokenData)?.syncToken : null;

  const auth = await getAuthenticatedClient(userId);
  if (!auth) {
    console.error(`No authenticated client available for user ${userId}`);
    throw new Error('Authentication failed');
  }

  const calendar = google.calendar({ version: 'v3', auth });

  let processedCount = 0;
  let pageToken: string | undefined;
  let newSyncToken: string | undefined;

  do {
    const params: any = {
      calendarId,
      singleEvents: true,
      maxResults: 250
    };

    if (syncToken) {
      // Incremental sync - only get changes since last sync
      params.syncToken = syncToken;
    } else {
      // First sync - only get events with our extended property
      params.privateExtendedProperty = `${BRAIN_DUMPER_KEYS.TASK_ID}=*`;
      // Look back 30 days and forward 90 days
      params.timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      params.timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (pageToken) {
      params.pageToken = pageToken;
    }

    try {
      const response = await calendar.events.list(params);

      for (const event of response.data.items || []) {
        const taskId = event.extendedProperties?.private?.[BRAIN_DUMPER_KEYS.TASK_ID];
        if (taskId) {
          await processEventChange({
            eventId: event.id!,
            calendarId,
            userId,
            status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
            start: event.start?.dateTime ? new Date(event.start.dateTime) : undefined,
            end: event.end?.dateTime ? new Date(event.end.dateTime) : undefined,
            deleted: event.status === 'cancelled'
          }, taskId);
          processedCount++;
        }
      }

      pageToken = response.data.nextPageToken || undefined;
      newSyncToken = response.data.nextSyncToken || undefined;
    } catch (error: any) {
      // If sync token is invalid (410 Gone), do full sync
      if (error.code === 410 || error.response?.status === 410) {
        console.log('Sync token expired, performing full sync');
        // Clear sync token and retry
        await db.collection('users').doc(userId)
          .collection('calendarSync').doc(calendarId).delete();
        return processCalendarSync(userId, calendarId);
      }
      throw error;
    }
  } while (pageToken);

  // Save new sync token for future incremental syncs
  if (newSyncToken) {
    await db.collection('users').doc(userId)
      .collection('calendarSync').doc(calendarId).set({
        syncToken: newSyncToken,
        lastSyncedAt: FieldValue.serverTimestamp()
      });
  }

  return processedCount;
}

/**
 * Process a single event change and update the corresponding task
 *
 * @param change - The calendar event change details
 * @param taskId - The Brain Dumper task ID associated with this event
 */
async function processEventChange(
  change: CalendarEventChange,
  taskId: string
): Promise<void> {
  const db = getFirestore();
  const taskRef = db.collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    console.log(`Task ${taskId} not found for event ${change.eventId}`);
    return;
  }

  const task = taskDoc.data()!;

  // Event was deleted externally
  if (change.deleted || change.status === 'cancelled') {
    console.log(`Calendar event deleted for task ${taskId}, marking as unscheduled`);
    await taskRef.update({
      scheduledStart: FieldValue.delete(),
      scheduledEnd: FieldValue.delete(),
      calendarEventId: FieldValue.delete(),
      calendarId: FieldValue.delete(),
      'syncMetadata.calendarEventId': null,
      'syncMetadata.syncStatus': 'synced',
      'syncMetadata.lastSyncedAt': FieldValue.serverTimestamp(),
      unscheduledReason: 'calendar_event_deleted',
      unscheduledAt: FieldValue.serverTimestamp()
    });
    return;
  }

  // Event time was changed externally
  if (change.start && change.end) {
    const taskStart = task.scheduledStart?.toDate?.() || task.scheduledStart;
    const taskEnd = task.scheduledEnd?.toDate?.() || task.scheduledEnd;

    // Check if times have changed (allow 1 minute tolerance)
    const startChanged = !taskStart ||
      Math.abs(change.start.getTime() - new Date(taskStart).getTime()) > 60000;
    const endChanged = !taskEnd ||
      Math.abs(change.end.getTime() - new Date(taskEnd).getTime()) > 60000;

    if (startChanged || endChanged) {
      console.log(`Calendar event rescheduled for task ${taskId}`);
      await taskRef.update({
        scheduledStart: change.start,
        scheduledEnd: change.end,
        'syncMetadata.syncStatus': 'synced',
        'syncMetadata.lastSyncedAt': FieldValue.serverTimestamp(),
        rescheduledExternally: true,
        rescheduledAt: FieldValue.serverTimestamp()
      });
    }
  }
}

/**
 * Process a single calendar event by fetching it directly
 * Used when we need to process a specific event
 *
 * @param userId - The user's Firebase UID
 * @param calendarId - The Google Calendar ID
 * @param eventId - The specific event ID to process
 * @returns True if event was processed, false if not a Brain Dumper event
 */
export async function processSingleEvent(
  userId: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    const auth = await getAuthenticatedClient(userId);
    if (!auth) {
      console.error(`No authenticated client available for user ${userId}`);
      return false;
    }

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.get({
      calendarId,
      eventId
    });

    const event = response.data;
    const taskId = event.extendedProperties?.private?.[BRAIN_DUMPER_KEYS.TASK_ID];

    if (!taskId) {
      return false;
    }

    await processEventChange({
      eventId,
      calendarId,
      userId,
      status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
      start: event.start?.dateTime ? new Date(event.start.dateTime) : undefined,
      end: event.end?.dateTime ? new Date(event.end.dateTime) : undefined,
      deleted: event.status === 'cancelled'
    }, taskId);

    return true;
  } catch (error: any) {
    if (error.code === 404 || error.response?.status === 404) {
      // Event was deleted - need to find task by eventId
      const db = getFirestore();
      const tasks = await db.collection('tasks')
        .where('userId', '==', userId)
        .where('calendarEventId', '==', eventId)
        .limit(1)
        .get();

      if (!tasks.empty) {
        const taskDoc = tasks.docs[0];
        await processEventChange({
          eventId,
          calendarId,
          userId,
          status: 'cancelled',
          deleted: true
        }, taskDoc.id);
        return true;
      }
    }
    console.error('Failed to process single event:', error);
    return false;
  }
}

/**
 * Get the last sync time for a calendar
 *
 * @param userId - The user's Firebase UID
 * @param calendarId - The Google Calendar ID
 * @returns The last sync time or null if never synced
 */
export async function getLastSyncTime(
  userId: string,
  calendarId: string
): Promise<Date | null> {
  const db = getFirestore();
  const syncDoc = await db.collection('users').doc(userId)
    .collection('calendarSync').doc(calendarId).get();

  if (!syncDoc.exists) {
    return null;
  }

  const data = syncDoc.data() as SyncTokenData;
  if (data.lastSyncedAt instanceof Timestamp) {
    return data.lastSyncedAt.toDate();
  }
  return data.lastSyncedAt ? new Date(data.lastSyncedAt as any) : null;
}

/**
 * Clear the sync token for a calendar (forces full resync on next notification)
 *
 * @param userId - The user's Firebase UID
 * @param calendarId - The Google Calendar ID
 */
export async function clearSyncToken(
  userId: string,
  calendarId: string
): Promise<void> {
  const db = getFirestore();
  await db.collection('users').doc(userId)
    .collection('calendarSync').doc(calendarId).delete();
  console.log(`Cleared sync token for calendar ${calendarId} for user ${userId}`);
}

/**
 * Re-exported for use by other modules
 */
export { processEventChange as _processEventChange };
