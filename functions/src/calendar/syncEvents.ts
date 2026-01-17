/**
 * Calendar events sync function
 * Syncs events from Google Calendar to Firestore cache
 * @module calendar/syncEvents
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getCalendarClient } from './client';
import { fetchEventsInternal } from './fetchEvents';
import { CalendarEvent, SyncResult, ConnectedCalendar } from '../types';
import { FIRESTORE_PATHS } from '../config/oauth';

const db = admin.firestore();

/**
 * Firestore paths for calendar cache
 */
const CACHE_PATHS = {
  /** Path to calendar cache collection */
  calendarCache: (userId: string, calendarId: string) =>
    `users/${userId}/calendarCache/${encodeCalendarId(calendarId)}`,
  /** Path to events subcollection */
  events: (userId: string, calendarId: string) =>
    `users/${userId}/calendarCache/${encodeCalendarId(calendarId)}/events`,
  /** Path to sync metadata document */
  syncMeta: (userId: string, calendarId: string) =>
    `users/${userId}/calendarCache/${encodeCalendarId(calendarId)}/meta/sync`,
};

/**
 * Encode calendar ID for use as Firestore document ID
 */
function encodeCalendarId(calendarId: string): string {
  return encodeURIComponent(calendarId).replace(/\./g, '%2E');
}

/**
 * Parameters for syncCalendarEvents function
 */
interface SyncCalendarEventsParams {
  /** Calendar ID to sync */
  calendarId: string;
  /** Force full sync instead of incremental (default false) */
  fullSync?: boolean;
  /** Number of days in the future to sync (default 90) */
  daysAhead?: number;
  /** Number of days in the past to sync (default 30) */
  daysBehind?: number;
}

/**
 * Response from syncCalendarEvents function
 */
interface SyncCalendarEventsResponse {
  /** Whether the sync was successful */
  success: boolean;
  /** Sync operation results */
  result?: SyncResult;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Sync metadata stored in Firestore
 */
interface SyncMetadata {
  /** Sync token for incremental sync */
  syncToken?: string;
  /** Last successful sync timestamp */
  lastSyncAt: string;
  /** Last full sync timestamp */
  lastFullSyncAt?: string;
  /** Number of events in cache */
  eventCount: number;
  /** Last sync status */
  status: 'synced' | 'syncing' | 'error';
  /** Error message if last sync failed */
  lastError?: string;
}

/**
 * Get sync metadata from Firestore
 *
 * @param userId - User's Firebase UID
 * @param calendarId - Calendar ID
 * @returns Sync metadata or null if not found
 */
async function getSyncMetadata(
  userId: string,
  calendarId: string
): Promise<SyncMetadata | null> {
  const docRef = db.doc(CACHE_PATHS.syncMeta(userId, calendarId));
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as SyncMetadata;
}

/**
 * Save sync metadata to Firestore
 *
 * @param userId - User's Firebase UID
 * @param calendarId - Calendar ID
 * @param metadata - Sync metadata to save
 */
async function saveSyncMetadata(
  userId: string,
  calendarId: string,
  metadata: SyncMetadata
): Promise<void> {
  const docRef = db.doc(CACHE_PATHS.syncMeta(userId, calendarId));
  await docRef.set(metadata);
}

/**
 * Save events to Firestore cache
 *
 * @param userId - User's Firebase UID
 * @param calendarId - Calendar ID
 * @param events - Events to save
 * @returns Number of events created, updated, and deleted
 */
async function saveEventsToCache(
  userId: string,
  calendarId: string,
  events: CalendarEvent[]
): Promise<{ created: number; updated: number; deleted: number }> {
  const eventsRef = db.collection(CACHE_PATHS.events(userId, calendarId));

  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Process in batches (Firestore limit is 500 operations per batch)
  const batchSize = 400;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = db.batch();
    const batchEvents = events.slice(i, i + batchSize);

    for (const event of batchEvents) {
      const eventRef = eventsRef.doc(encodeCalendarId(event.id));

      if (event.status === 'cancelled') {
        // Delete cancelled events
        batch.delete(eventRef);
        deleted++;
      } else {
        // Check if event exists
        const existing = await eventRef.get();

        if (existing.exists) {
          batch.update(eventRef, {
            ...event,
            updatedAt: new Date().toISOString(),
          });
          updated++;
        } else {
          batch.set(eventRef, {
            ...event,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      }
    }

    await batch.commit();
  }

  return { created, updated, deleted };
}

/**
 * Clear all events from cache
 *
 * @param userId - User's Firebase UID
 * @param calendarId - Calendar ID
 */
async function clearEventCache(userId: string, calendarId: string): Promise<void> {
  const eventsRef = db.collection(CACHE_PATHS.events(userId, calendarId));
  const snapshot = await eventsRef.get();

  const batchSize = 400;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = docs.slice(i, i + batchSize);

    for (const doc of batchDocs) {
      batch.delete(doc.ref);
    }

    await batch.commit();
  }
}

/**
 * Update calendar's sync token and last sync time
 *
 * @param userId - User's Firebase UID
 * @param calendarId - Calendar ID
 * @param syncToken - New sync token
 */
async function updateCalendarSyncInfo(
  userId: string,
  calendarId: string,
  syncToken?: string
): Promise<void> {
  const calendarRef = db
    .collection(FIRESTORE_PATHS.calendars(userId))
    .doc(encodeCalendarId(calendarId));

  const updates: Partial<ConnectedCalendar> = {
    lastSyncAt: new Date().toISOString(),
  };

  if (syncToken) {
    updates.syncToken = syncToken;
  }

  await calendarRef.set(updates, { merge: true });
}

/**
 * Callable function to sync calendar events to Firestore cache
 * Supports both full sync and incremental sync using sync tokens
 *
 * @example
 * // Full sync
 * const result = await syncCalendarEvents({
 *   calendarId: 'primary',
 *   fullSync: true
 * });
 *
 * // Incremental sync
 * const result = await syncCalendarEvents({
 *   calendarId: 'primary'
 * });
 */
export const syncCalendarEvents = functions.https.onCall(
  async (
    data: SyncCalendarEventsParams,
    context
  ): Promise<SyncCalendarEventsResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to sync calendar events'
      );
    }

    const userId = context.auth.uid;
    const {
      calendarId,
      fullSync = false,
      daysAhead = 90,
      daysBehind = 30,
    } = data;

    // Validate required parameters
    if (!calendarId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Calendar ID is required'
      );
    }

    try {
      // Get authenticated calendar client
      const calendar = await getCalendarClient(userId);

      if (!calendar) {
        return {
          success: false,
          error: 'Calendar not connected. Please connect your calendar first.',
        };
      }

      console.log(
        `Starting ${fullSync ? 'full' : 'incremental'} sync for user ${userId}, calendar ${calendarId}`
      );

      // Update sync status to syncing
      await saveSyncMetadata(userId, calendarId, {
        lastSyncAt: new Date().toISOString(),
        eventCount: 0,
        status: 'syncing',
      });

      // Get existing sync metadata for incremental sync
      let syncToken: string | undefined;

      if (!fullSync) {
        const metadata = await getSyncMetadata(userId, calendarId);
        syncToken = metadata?.syncToken;
      }

      // Calculate time range for sync
      const now = new Date();
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - daysBehind);
      const timeMax = new Date(now);
      timeMax.setDate(timeMax.getDate() + daysAhead);

      let events: CalendarEvent[] = [];
      let newSyncToken: string | undefined;
      const errors: string[] = [];

      try {
        // Fetch events
        const fetchResult = await fetchEventsInternal(
          calendar,
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString(),
          {
            syncToken: fullSync ? undefined : syncToken,
            maxResults: 2500,
          }
        );

        events = fetchResult.events;
        newSyncToken = fetchResult.nextSyncToken;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check if sync token is invalid (requires full sync)
        if (
          errorMessage.includes('Sync token is no longer valid') ||
          errorMessage.includes('410')
        ) {
          console.log('Sync token invalid, performing full sync');

          // Clear cache and do full sync
          await clearEventCache(userId, calendarId);

          const fetchResult = await fetchEventsInternal(
            calendar,
            calendarId,
            timeMin.toISOString(),
            timeMax.toISOString(),
            { maxResults: 2500 }
          );

          events = fetchResult.events;
          newSyncToken = fetchResult.nextSyncToken;
        } else {
          throw error;
        }
      }

      // If full sync, clear existing cache first
      if (fullSync) {
        await clearEventCache(userId, calendarId);
      }

      // Save events to cache
      const { created, updated, deleted } = await saveEventsToCache(
        userId,
        calendarId,
        events
      );

      // Count total events in cache
      const eventsRef = db.collection(CACHE_PATHS.events(userId, calendarId));
      const countSnapshot = await eventsRef.count().get();
      const eventCount = countSnapshot.data().count;

      // Save sync metadata
      const metadata: SyncMetadata = {
        syncToken: newSyncToken,
        lastSyncAt: new Date().toISOString(),
        lastFullSyncAt: fullSync ? new Date().toISOString() : undefined,
        eventCount,
        status: 'synced',
      };
      await saveSyncMetadata(userId, calendarId, metadata);

      // Update calendar sync info
      await updateCalendarSyncInfo(userId, calendarId, newSyncToken);

      console.log(
        `Sync completed: ${created} created, ${updated} updated, ${deleted} deleted`
      );

      const result: SyncResult = {
        success: true,
        eventsCreated: created,
        eventsUpdated: updated,
        eventsDeleted: deleted,
        errors,
        syncToken: newSyncToken,
      };

      return {
        success: true,
        result,
      };
    } catch (error) {
      console.error(`Error syncing calendar events for user ${userId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update sync metadata with error
      await saveSyncMetadata(userId, calendarId, {
        lastSyncAt: new Date().toISOString(),
        eventCount: 0,
        status: 'error',
        lastError: errorMessage,
      });

      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        return {
          success: false,
          error: 'Calendar access has been revoked. Please reconnect your calendar.',
        };
      }

      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        return {
          success: false,
          error: 'Calendar not found. It may have been deleted.',
        };
      }

      if (errorMessage.includes('Rate Limit') || errorMessage.includes('429')) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      throw new functions.https.HttpsError('internal', 'Failed to sync calendar events');
    }
  }
);

/**
 * Get cached events from Firestore
 *
 * @param userId - User's Firebase UID
 * @param calendarId - Calendar ID
 * @param options - Query options
 * @returns Cached events
 */
export async function getCachedEvents(
  userId: string,
  calendarId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<CalendarEvent[]> {
  const { startDate, endDate, limit = 500 } = options;

  let query: admin.firestore.Query = db.collection(
    CACHE_PATHS.events(userId, calendarId)
  );

  if (startDate) {
    query = query.where('start', '>=', startDate.toISOString());
  }

  if (endDate) {
    query = query.where('start', '<=', endDate.toISOString());
  }

  query = query.orderBy('start', 'asc').limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => doc.data() as CalendarEvent);
}
