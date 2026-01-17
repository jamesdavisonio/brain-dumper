/**
 * Watch Manager module
 * Creates, renews, and stops Google Calendar push notification subscriptions
 * @module webhooks/watchManager
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '../oauth/tokenStorage';
import * as functions from 'firebase-functions';

/**
 * Represents a calendar watch subscription stored in Firestore
 */
export interface WatchSubscription {
  /** Unique identifier for the watch channel */
  id: string;
  /** Google Calendar API resource ID for the watch */
  resourceId: string;
  /** Calendar ID being watched */
  calendarId: string;
  /** User who owns this subscription */
  userId: string;
  /** When the watch expires */
  expiration: Date;
  /** Token used to validate webhook callbacks */
  channelToken: string;
}

/**
 * Stored format of watch subscription in Firestore
 */
interface StoredWatchSubscription {
  id: string;
  resourceId: string;
  calendarId: string;
  userId: string;
  expiration: Timestamp | Date;
  channelToken: string;
  createdAt: Timestamp | Date;
}

// Get webhook URL from config or construct it
const getWebhookUrl = (): string => {
  const config = functions.config();
  if (config.app?.webhook_url) {
    return config.app.webhook_url;
  }
  const region = config.app?.region || 'us-central1';
  const projectId = config.app?.project_id || process.env.GCLOUD_PROJECT || 'brain-dumper';
  return `https://${region}-${projectId}.cloudfunctions.net/calendarWebhook`;
};

const WEBHOOK_URL = getWebhookUrl();

/**
 * Create a new watch subscription for a calendar
 *
 * @param userId - The user's Firebase UID
 * @param calendarId - The Google Calendar ID to watch
 * @returns The created watch subscription or null if creation failed
 *
 * @example
 * const subscription = await createWatch('user123', 'primary');
 * if (subscription) {
 *   console.log('Watch created, expires:', subscription.expiration);
 * }
 */
export async function createWatch(
  userId: string,
  calendarId: string
): Promise<WatchSubscription | null> {
  try {
    const auth = await getAuthenticatedClient(userId);
    if (!auth) {
      console.error(`No authenticated client available for user ${userId}`);
      return null;
    }

    const calendar = google.calendar({ version: 'v3', auth });

    // Generate unique channel ID incorporating user, calendar, and timestamp
    const channelId = `brain-dumper-${userId}-${calendarId.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;
    // Token used to validate callbacks - contains user and calendar info
    const channelToken = `${userId}:${calendarId}`;

    // Watch expires in 7 days (Google Calendar API maximum is 7 days)
    const expirationTime = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const response = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: WEBHOOK_URL,
        token: channelToken,
        expiration: String(expirationTime)
      }
    });

    if (!response.data.resourceId || !response.data.expiration) {
      console.error('Invalid response from calendar.events.watch:', response.data);
      return null;
    }

    const subscription: WatchSubscription = {
      id: channelId,
      resourceId: response.data.resourceId,
      calendarId,
      userId,
      expiration: new Date(parseInt(response.data.expiration)),
      channelToken
    };

    // Store subscription in Firestore
    const db = getFirestore();
    await db.collection('calendarWatches').doc(channelId).set({
      ...subscription,
      expiration: subscription.expiration,
      createdAt: new Date()
    });

    console.log(`Created watch for calendar ${calendarId}, expires ${subscription.expiration}`);
    return subscription;
  } catch (error) {
    console.error('Failed to create calendar watch:', error);
    return null;
  }
}

/**
 * Stop an existing watch subscription
 *
 * @param subscription - The subscription to stop
 * @returns True if successfully stopped, false otherwise
 */
export async function stopWatch(subscription: WatchSubscription): Promise<boolean> {
  try {
    const auth = await getAuthenticatedClient(subscription.userId);
    if (!auth) {
      console.error(`No authenticated client available for user ${subscription.userId}`);
      // Still delete from Firestore since we can't stop it
      const db = getFirestore();
      await db.collection('calendarWatches').doc(subscription.id).delete();
      return false;
    }

    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.channels.stop({
      requestBody: {
        id: subscription.id,
        resourceId: subscription.resourceId
      }
    });

    const db = getFirestore();
    await db.collection('calendarWatches').doc(subscription.id).delete();

    console.log(`Stopped watch ${subscription.id}`);
    return true;
  } catch (error: any) {
    // If the channel is already stopped or not found, still clean up Firestore
    if (error.code === 404) {
      const db = getFirestore();
      await db.collection('calendarWatches').doc(subscription.id).delete();
      console.log(`Watch ${subscription.id} already stopped, cleaned up Firestore`);
      return true;
    }
    console.error('Failed to stop watch:', error);
    return false;
  }
}

/**
 * Renew all watch subscriptions that are expiring soon
 * Called by the scheduled function to maintain continuous notifications
 *
 * @returns Number of watches successfully renewed
 */
export async function renewExpiringWatches(): Promise<number> {
  const db = getFirestore();
  const now = new Date();
  // Renew watches that expire within 24 hours
  const renewThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const expiringWatches = await db.collection('calendarWatches')
    .where('expiration', '<=', renewThreshold)
    .get();

  let renewed = 0;
  for (const doc of expiringWatches.docs) {
    const data = doc.data() as StoredWatchSubscription;
    const subscription: WatchSubscription = {
      ...data,
      expiration: data.expiration instanceof Timestamp
        ? data.expiration.toDate()
        : new Date(data.expiration)
    };

    // Stop old watch
    await stopWatch(subscription);

    // Create new watch
    const newSub = await createWatch(subscription.userId, subscription.calendarId);
    if (newSub) {
      renewed++;
    }
  }

  console.log(`Renewed ${renewed} expiring watches`);
  return renewed;
}

/**
 * Get a watch subscription by its channel ID
 *
 * @param channelId - The unique channel identifier
 * @returns The subscription if found, null otherwise
 */
export async function getWatchByChannel(channelId: string): Promise<WatchSubscription | null> {
  const db = getFirestore();
  const doc = await db.collection('calendarWatches').doc(channelId).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data() as StoredWatchSubscription;
  return {
    ...data,
    expiration: data.expiration instanceof Timestamp
      ? data.expiration.toDate()
      : new Date(data.expiration)
  };
}

/**
 * Get all active watch subscriptions for a user
 *
 * @param userId - The user's Firebase UID
 * @returns Array of watch subscriptions
 */
export async function getWatchesForUser(userId: string): Promise<WatchSubscription[]> {
  const db = getFirestore();
  const snapshot = await db.collection('calendarWatches')
    .where('userId', '==', userId)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data() as StoredWatchSubscription;
    return {
      ...data,
      expiration: data.expiration instanceof Timestamp
        ? data.expiration.toDate()
        : new Date(data.expiration)
    };
  });
}

/**
 * Stop all watch subscriptions for a user
 * Used when a user disconnects their calendar
 *
 * @param userId - The user's Firebase UID
 * @returns Number of watches stopped
 */
export async function stopAllWatchesForUser(userId: string): Promise<number> {
  const watches = await getWatchesForUser(userId);
  let stopped = 0;

  for (const watch of watches) {
    const success = await stopWatch(watch);
    if (success) {
      stopped++;
    }
  }

  console.log(`Stopped ${stopped} watches for user ${userId}`);
  return stopped;
}

/**
 * Scheduled function to renew expiring watches
 * Should be called daily by Cloud Scheduler
 */
export const renewCalendarWatches = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily UTC
  .timeZone('UTC')
  .onRun(async () => {
    const renewed = await renewExpiringWatches();
    console.log(`Daily watch renewal complete: ${renewed} watches renewed`);
  });
