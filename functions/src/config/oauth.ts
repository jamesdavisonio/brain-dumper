/**
 * OAuth configuration for Google Calendar integration
 * @module config/oauth
 */

import * as functions from 'firebase-functions';

/**
 * Get OAuth configuration
 * Values are loaded from Firebase Functions config or environment variables
 */
function getOAuthConfig() {
  // Try Firebase Functions config first, fall back to environment variables
  const config = functions.config();

  return {
    /** Google OAuth Client ID */
    clientId: config.google?.client_id || process.env.GOOGLE_CLIENT_ID || '',
    /** Google OAuth Client Secret */
    clientSecret: config.google?.client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
    /** OAuth callback redirect URI */
    redirectUri: config.oauth?.redirect_uri || process.env.OAUTH_REDIRECT_URI || '',
    /** App base URL for redirects */
    appBaseUrl: config.app?.base_url || process.env.APP_BASE_URL || '',
    /** OAuth scopes for Google Calendar access */
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  };
}

export const OAUTH_CONFIG = getOAuthConfig();

/**
 * Token expiry buffer in milliseconds
 * Tokens will be refreshed this long before they actually expire
 */
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * OAuth state token expiry in milliseconds
 * State tokens are used to prevent CSRF attacks during OAuth flow
 */
export const STATE_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Firestore collection paths for OAuth-related data
 */
export const FIRESTORE_PATHS = {
  /** Path to user's private data collection */
  userPrivate: (userId: string) => `users/${userId}/private`,
  /** Path to user's calendar tokens document */
  calendarTokens: (userId: string) => `users/${userId}/private/calendarTokens`,
  /** Path to user's calendars collection */
  calendars: (userId: string) => `users/${userId}/calendars`,
  /** Path to OAuth state tokens collection */
  oauthStates: 'oauthStates',
};
