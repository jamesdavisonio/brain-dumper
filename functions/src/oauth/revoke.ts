/**
 * Calendar disconnect/revoke function
 * Disconnects the user's calendar by revoking tokens and cleaning up data
 * @module oauth/revoke
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { getTokens, deleteTokens } from './tokenStorage';
import { OAUTH_CONFIG, FIRESTORE_PATHS } from '../config/oauth';

const db = admin.firestore();

/**
 * Response from disconnectCalendar function
 */
interface DisconnectResponse {
  /** Whether the disconnect was successful */
  success: boolean;
  /** Message describing the result */
  message: string;
}

/**
 * Callable function to disconnect calendar
 * Revokes OAuth tokens with Google and cleans up stored data
 *
 * Flow:
 * 1. Get user's tokens from storage
 * 2. Revoke tokens with Google (best effort)
 * 3. Delete tokens from Firestore
 * 4. Delete calendar metadata from Firestore
 * 5. Update user document
 * 6. Return success status
 */
export const disconnectCalendar = functions.https.onCall(
  async (data, context): Promise<DisconnectResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to disconnect calendar'
      );
    }

    const userId = context.auth.uid;

    try {
      // Get current tokens
      const tokens = await getTokens(userId);

      // Revoke tokens with Google (best effort - don't fail if this fails)
      if (tokens) {
        await revokeGoogleTokens(tokens.accessToken).catch((err) => {
          console.warn(`Failed to revoke tokens with Google for user ${userId}:`, err);
          // Continue with cleanup even if revocation fails
        });
      }

      // Delete tokens from Firestore
      await deleteTokens(userId);

      // Delete all calendar documents
      await deleteUserCalendars(userId);

      // Update user document
      await db.collection('users').doc(userId).set(
        {
          calendarConnected: false,
          calendarDisconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`Calendar disconnected for user ${userId}`);

      return {
        success: true,
        message: 'Calendar disconnected successfully',
      };
    } catch (error) {
      console.error(`Error disconnecting calendar for user ${userId}:`, error);

      throw new functions.https.HttpsError(
        'internal',
        'Failed to disconnect calendar. Please try again.'
      );
    }
  }
);

/**
 * Revoke tokens with Google OAuth
 *
 * @param accessToken - The access token to revoke
 */
async function revokeGoogleTokens(accessToken: string): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    OAUTH_CONFIG.clientId,
    OAUTH_CONFIG.clientSecret,
    OAUTH_CONFIG.redirectUri
  );

  await oauth2Client.revokeToken(accessToken);
}

/**
 * Delete all calendar documents for a user
 *
 * @param userId - The user's Firebase UID
 */
async function deleteUserCalendars(userId: string): Promise<void> {
  const calendarsRef = db.collection(FIRESTORE_PATHS.calendars(userId));
  const calendars = await calendarsRef.listDocuments();

  if (calendars.length === 0) {
    return;
  }

  const batch = db.batch();

  for (const calendarDoc of calendars) {
    batch.delete(calendarDoc);
  }

  await batch.commit();
  console.log(`Deleted ${calendars.length} calendars for user ${userId}`);
}
