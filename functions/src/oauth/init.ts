/**
 * OAuth initialization function
 * Generates the OAuth URL for Google Calendar authorization
 * @module oauth/init
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import {
  OAUTH_CONFIG,
  STATE_TOKEN_EXPIRY_MS,
  FIRESTORE_PATHS
} from '../config/oauth';

const db = admin.firestore();

/**
 * Response from calendarOAuthInit function
 */
interface OAuthInitResponse {
  /** The OAuth authorization URL to redirect the user to */
  authUrl: string;
}

/**
 * Callable function to initiate the OAuth flow
 * Generates a state token and returns the Google OAuth URL
 *
 * Flow:
 * 1. Generate cryptographically secure random state token
 * 2. Store state token in Firestore with user ID and expiry
 * 3. Build Google OAuth URL with scopes and state
 * 4. Return the URL to frontend for redirect
 */
export const calendarOAuthInit = functions.https.onCall(
  async (data, context): Promise<OAuthInitResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to connect calendar'
      );
    }

    const userId = context.auth.uid;

    // Validate OAuth configuration
    if (!OAUTH_CONFIG.clientId || !OAUTH_CONFIG.clientSecret || !OAUTH_CONFIG.redirectUri) {
      console.error('OAuth configuration is incomplete');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OAuth is not configured. Please contact support.'
      );
    }

    try {
      // Generate random state token
      const stateToken = crypto.randomBytes(32).toString('hex');

      // Store state token with user ID for validation during callback
      const expiresAt = new Date(Date.now() + STATE_TOKEN_EXPIRY_MS);

      await db.collection(FIRESTORE_PATHS.oauthStates).doc(stateToken).set({
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        OAUTH_CONFIG.clientId,
        OAUTH_CONFIG.clientSecret,
        OAUTH_CONFIG.redirectUri
      );

      // Generate authorization URL
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Request refresh token
        scope: OAUTH_CONFIG.scopes,
        state: stateToken,
        prompt: 'consent', // Force consent to ensure refresh token is issued
        include_granted_scopes: true,
      });

      console.log(`OAuth flow initiated for user ${userId}`);

      return { authUrl };
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to initiate calendar connection'
      );
    }
  }
);
