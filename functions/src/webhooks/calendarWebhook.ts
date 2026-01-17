/**
 * Calendar Webhook module
 * HTTP handlers for receiving Google Calendar push notifications
 * @module webhooks/calendarWebhook
 */

import * as functions from 'firebase-functions';
import { getWatchByChannel } from './watchManager';
import { processCalendarSync } from './eventProcessor';

/**
 * HTTP endpoint to receive Google Calendar push notifications
 *
 * Google Calendar sends push notifications when events change on watched calendars.
 * This endpoint validates the notification and triggers a sync operation.
 *
 * Headers sent by Google:
 * - X-Goog-Channel-ID: The channel ID we provided when creating the watch
 * - X-Goog-Channel-Token: The token we provided when creating the watch
 * - X-Goog-Resource-State: The type of change ('sync', 'exists', 'update')
 * - X-Goog-Resource-ID: Google's internal resource identifier
 * - X-Goog-Resource-URI: The URI of the resource
 * - X-Goog-Message-Number: Sequence number of the notification
 *
 * @see https://developers.google.com/calendar/api/guides/push
 */
export const calendarWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.warn(`Received non-POST request: ${req.method}`);
    res.status(405).send('Method not allowed');
    return;
  }

  // Extract headers from Google's push notification
  const channelId = req.headers['x-goog-channel-id'] as string;
  const resourceState = req.headers['x-goog-resource-state'] as string;
  const channelToken = req.headers['x-goog-channel-token'] as string;
  const messageNumber = req.headers['x-goog-message-number'] as string;

  console.log(`Received webhook: channel=${channelId}, state=${resourceState}, msg=${messageNumber}`);

  // Handle sync confirmation (sent when watch is created)
  // This confirms Google successfully set up the push notifications
  if (resourceState === 'sync') {
    console.log('Received sync confirmation for channel:', channelId);
    res.status(200).send('OK');
    return;
  }

  // Validate channel ID exists
  if (!channelId) {
    console.error('Missing channel ID in webhook request');
    res.status(400).send('Missing channel ID');
    return;
  }

  // Look up the subscription
  const subscription = await getWatchByChannel(channelId);
  if (!subscription) {
    console.error(`Unknown channel: ${channelId}`);
    // Return 200 to stop Google from retrying for unknown channels
    // This can happen if the watch was deleted but Google still sends notifications
    res.status(200).send('Unknown channel');
    return;
  }

  // Validate the channel token matches what we set
  if (channelToken !== subscription.channelToken) {
    console.error(`Token mismatch for channel ${channelId}`);
    res.status(403).send('Invalid token');
    return;
  }

  // Check if subscription is expired
  if (subscription.expiration < new Date()) {
    console.warn(`Received notification for expired watch: ${channelId}`);
    // Still return 200 to stop retries
    res.status(200).send('Watch expired');
    return;
  }

  // Process the notification based on resource state
  if (resourceState === 'exists' || resourceState === 'update') {
    try {
      const processedCount = await processCalendarSync(
        subscription.userId,
        subscription.calendarId
      );
      console.log(`Processed ${processedCount} events for calendar ${subscription.calendarId}`);
    } catch (error) {
      console.error('Error processing calendar sync:', error);
      // Still return 200 to avoid infinite retries from Google
      // Errors should be logged and potentially alerted on separately
    }
  } else {
    console.log(`Unhandled resource state: ${resourceState}`);
  }

  res.status(200).send('OK');
});

/**
 * Callable function to manually trigger a sync for a user's calendar
 * Useful for debugging or forcing a resync after issues
 *
 * @example
 * // From client:
 * const triggerSync = firebase.functions().httpsCallable('triggerCalendarSync');
 * const result = await triggerSync({ calendarId: 'primary' });
 * console.log('Processed events:', result.data.processedCount);
 */
export const triggerCalendarSync = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to trigger calendar sync'
    );
  }

  const userId = context.auth.uid;
  const { calendarId } = data;

  // Validate required parameters
  if (!calendarId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'calendarId is required'
    );
  }

  if (typeof calendarId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'calendarId must be a string'
    );
  }

  try {
    const processedCount = await processCalendarSync(userId, calendarId);
    return {
      success: true,
      processedCount,
      calendarId,
      syncedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Manual sync failed:', error);

    // Return appropriate error based on the type
    if (error.message === 'Authentication failed') {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Calendar authentication expired. Please reconnect your calendar.'
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `Sync failed: ${error.message}`
    );
  }
});

/**
 * Callable function to set up a watch for a calendar
 * This should be called when a user connects their calendar
 *
 * @example
 * // From client:
 * const setupWatch = firebase.functions().httpsCallable('setupCalendarWatch');
 * const result = await setupWatch({ calendarId: 'primary' });
 */
export const setupCalendarWatch = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to set up calendar watch'
    );
  }

  const userId = context.auth.uid;
  const { calendarId } = data;

  // Validate required parameters
  if (!calendarId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'calendarId is required'
    );
  }

  if (typeof calendarId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'calendarId must be a string'
    );
  }

  // Import dynamically to avoid circular dependencies
  const { createWatch, getWatchesForUser } = await import('./watchManager');

  try {
    // Check if user already has a watch for this calendar
    const existingWatches = await getWatchesForUser(userId);
    const existing = existingWatches.find(w => w.calendarId === calendarId);

    if (existing && existing.expiration > new Date()) {
      return {
        success: true,
        message: 'Watch already exists',
        watchId: existing.id,
        expiration: existing.expiration.toISOString()
      };
    }

    // Create new watch
    const subscription = await createWatch(userId, calendarId);

    if (!subscription) {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to create calendar watch'
      );
    }

    return {
      success: true,
      message: 'Watch created successfully',
      watchId: subscription.id,
      expiration: subscription.expiration.toISOString()
    };
  } catch (error: any) {
    console.error('Failed to set up calendar watch:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to set up watch: ${error.message}`
    );
  }
});

/**
 * Callable function to stop watching a calendar
 *
 * @example
 * // From client:
 * const stopWatch = firebase.functions().httpsCallable('stopCalendarWatch');
 * await stopWatch({ calendarId: 'primary' });
 */
export const stopCalendarWatch = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to stop calendar watch'
    );
  }

  const userId = context.auth.uid;
  const { calendarId } = data;

  // Validate required parameters
  if (!calendarId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'calendarId is required'
    );
  }

  // Import dynamically to avoid circular dependencies
  const { getWatchesForUser, stopWatch } = await import('./watchManager');

  try {
    const watches = await getWatchesForUser(userId);
    const watch = watches.find(w => w.calendarId === calendarId);

    if (!watch) {
      return {
        success: true,
        message: 'No watch found for calendar'
      };
    }

    await stopWatch(watch);

    return {
      success: true,
      message: 'Watch stopped successfully'
    };
  } catch (error: any) {
    console.error('Failed to stop calendar watch:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to stop watch: ${error.message}`
    );
  }
});
