/**
 * Token refresh function
 * Refreshes OAuth tokens when they expire or are about to expire
 * @module oauth/refresh
 */

import * as functions from 'firebase-functions';
import { refreshTokensIfNeeded, getTokens } from './tokenStorage';
import { TOKEN_EXPIRY_BUFFER_MS } from '../config/oauth';

/**
 * Response from refreshCalendarTokens function
 */
interface RefreshTokensResponse {
  /** Whether the refresh was successful */
  success: boolean;
  /** Whether the tokens were actually refreshed (vs still valid) */
  refreshed: boolean;
  /** When the current tokens expire (ISO string) */
  expiresAt?: string;
  /** Error message if refresh failed */
  error?: string;
}

/**
 * Callable function to refresh calendar tokens
 * Can be called proactively to ensure tokens are fresh before making API calls
 *
 * Flow:
 * 1. Get current tokens for the user
 * 2. Check if tokens are expired or expiring soon
 * 3. Use refresh token to get new access token if needed
 * 4. Update stored tokens
 * 5. Return success status and expiry info
 */
export const refreshCalendarTokens = functions.https.onCall(
  async (data, context): Promise<RefreshTokensResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to refresh tokens'
      );
    }

    const userId = context.auth.uid;

    try {
      // Get current tokens to check if they exist
      const currentTokens = await getTokens(userId);

      if (!currentTokens) {
        return {
          success: false,
          refreshed: false,
          error: 'No calendar connected. Please connect your calendar first.',
        };
      }

      // Check if tokens need refresh
      const expiresAt = new Date(currentTokens.expiresAt).getTime();
      const now = Date.now();
      const needsRefresh = expiresAt <= now + TOKEN_EXPIRY_BUFFER_MS;

      // Attempt to refresh tokens
      const refreshedTokens = await refreshTokensIfNeeded(userId);

      if (!refreshedTokens) {
        return {
          success: false,
          refreshed: false,
          error: 'Failed to refresh tokens. Please reconnect your calendar.',
        };
      }

      console.log(
        `Token refresh check for user ${userId}: ${needsRefresh ? 'refreshed' : 'still valid'}`
      );

      return {
        success: true,
        refreshed: needsRefresh,
        expiresAt: refreshedTokens.expiresAt,
      };
    } catch (error) {
      console.error(`Error refreshing tokens for user ${userId}:`, error);

      // Check if it's a specific OAuth error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Calendar access has been revoked. Please reconnect your calendar.'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to refresh calendar tokens'
      );
    }
  }
);
