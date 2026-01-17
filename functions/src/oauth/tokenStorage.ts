/**
 * Token storage utilities for OAuth tokens
 * Stores encrypted tokens in Firestore for secure access
 * @module oauth/tokenStorage
 */

import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { OAuthTokens } from '../types';
import {
  OAUTH_CONFIG,
  TOKEN_EXPIRY_BUFFER_MS,
  FIRESTORE_PATHS
} from '../config/oauth';

const db = admin.firestore();

/**
 * Internal interface for stored token data with metadata
 */
interface StoredTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Save OAuth tokens to Firestore
 * Tokens are stored in the user's private subcollection
 *
 * @param userId - The user's Firebase UID
 * @param tokens - The OAuth tokens to store
 * @throws Error if token storage fails
 */
export async function saveTokens(
  userId: string,
  tokens: OAuthTokens
): Promise<void> {
  const now = new Date().toISOString();

  const tokenData: StoredTokenData = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = db.doc(FIRESTORE_PATHS.calendarTokens(userId));

  // Check if document exists for update vs create
  const existing = await docRef.get();
  if (existing.exists) {
    tokenData.createdAt = existing.data()?.createdAt || now;
  }

  await docRef.set(tokenData, { merge: true });
  console.log(`Tokens saved for user ${userId}`);
}

/**
 * Retrieve OAuth tokens from Firestore
 *
 * @param userId - The user's Firebase UID
 * @returns The stored OAuth tokens or null if not found
 */
export async function getTokens(userId: string): Promise<OAuthTokens | null> {
  const docRef = db.doc(FIRESTORE_PATHS.calendarTokens(userId));
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data() as StoredTokenData;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    scope: data.scope,
  };
}

/**
 * Delete OAuth tokens from Firestore
 * Used when user disconnects their calendar
 *
 * @param userId - The user's Firebase UID
 */
export async function deleteTokens(userId: string): Promise<void> {
  const docRef = db.doc(FIRESTORE_PATHS.calendarTokens(userId));
  await docRef.delete();
  console.log(`Tokens deleted for user ${userId}`);
}

/**
 * Check if tokens need refresh and refresh them if necessary
 *
 * @param userId - The user's Firebase UID
 * @returns Fresh OAuth tokens or null if refresh failed
 */
export async function refreshTokensIfNeeded(
  userId: string
): Promise<OAuthTokens | null> {
  const tokens = await getTokens(userId);

  if (!tokens) {
    console.log(`No tokens found for user ${userId}`);
    return null;
  }

  const expiresAt = new Date(tokens.expiresAt).getTime();
  const now = Date.now();

  // Check if token is expired or expiring soon
  if (expiresAt > now + TOKEN_EXPIRY_BUFFER_MS) {
    // Token is still valid
    return tokens;
  }

  console.log(`Refreshing tokens for user ${userId}`);

  // Token needs refresh
  try {
    const refreshedTokens = await performTokenRefresh(tokens.refreshToken);

    // Save updated tokens
    const updatedTokens: OAuthTokens = {
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken || tokens.refreshToken,
      expiresAt: refreshedTokens.expiresAt,
      scope: tokens.scope,
    };

    await saveTokens(userId, updatedTokens);
    return updatedTokens;
  } catch (error) {
    console.error(`Failed to refresh tokens for user ${userId}:`, error);
    return null;
  }
}

/**
 * Perform the actual token refresh with Google OAuth
 *
 * @param refreshToken - The refresh token to use
 * @returns New access token details
 */
async function performTokenRefresh(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string }> {
  const oauth2Client = new google.auth.OAuth2(
    OAUTH_CONFIG.clientId,
    OAUTH_CONFIG.clientSecret,
    OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to obtain new access token');
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || undefined,
    expiresAt: new Date(credentials.expiry_date).toISOString(),
  };
}

/**
 * Get a valid access token for API calls
 * Automatically refreshes if needed
 *
 * @param userId - The user's Firebase UID
 * @returns A valid access token or null if unavailable
 */
export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const tokens = await refreshTokensIfNeeded(userId);
  return tokens?.accessToken || null;
}

/**
 * Create an authenticated OAuth2 client for making API calls
 *
 * @param userId - The user's Firebase UID
 * @returns Configured OAuth2 client or null if no valid tokens
 */
export async function getAuthenticatedClient(
  userId: string
): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const tokens = await refreshTokensIfNeeded(userId);

  if (!tokens) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    OAUTH_CONFIG.clientId,
    OAUTH_CONFIG.clientSecret,
    OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: new Date(tokens.expiresAt).getTime(),
  });

  return oauth2Client;
}
