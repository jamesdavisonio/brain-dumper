/**
 * OAuth configuration for Google Calendar integration
 * Uses environment variables (set via .env file or Cloud Functions environment)
 * @module config/oauth
 */

/**
 * OAuth configuration object
 * Values are loaded from environment variables
 */
export const OAUTH_CONFIG = {
  /** Google OAuth Client ID */
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  /** Google OAuth Client Secret */
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  /** OAuth callback redirect URI */
  redirectUri: process.env.OAUTH_REDIRECT_URI || '',
  /** App base URL for redirects */
  appBaseUrl: process.env.APP_BASE_URL || '',
  /** OAuth scopes for Google Calendar access */
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
};

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
