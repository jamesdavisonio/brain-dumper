/**
 * OAuth callback handler
 * Handles the redirect from Google OAuth and exchanges the code for tokens
 * @module oauth/callback
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google, calendar_v3 } from 'googleapis';
import { OAuthTokens, ConnectedCalendar } from '../types';
import { OAUTH_CONFIG, FIRESTORE_PATHS } from '../config/oauth';
import { saveTokens } from './tokenStorage';

const db = admin.firestore();

/**
 * OAuth state document stored in Firestore
 */
interface OAuthStateDoc {
  userId: string;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
}

/**
 * HTTP function to handle OAuth callback from Google
 * This is called by Google's OAuth redirect with the authorization code
 *
 * Flow:
 * 1. Validate state token to prevent CSRF
 * 2. Exchange authorization code for access/refresh tokens
 * 3. Fetch user's calendar list from Google
 * 4. Store tokens securely in Firestore
 * 5. Store calendar metadata in Firestore
 * 6. Redirect to app with success/error status
 */
export const calendarOAuthCallback = functions.https.onRequest(
  async (req, res) => {
    const { code, state, error } = req.query;

    // Base URL for redirect (from config)
    const appBaseUrl = OAUTH_CONFIG.appBaseUrl || 'http://localhost:5173';
    // Redirect to the OAuth callback page which shows status and closes the popup
    const successRedirect = `${appBaseUrl}/oauth/callback?success=true`;
    const errorRedirect = `${appBaseUrl}/oauth/callback?success=false`;

    // Check if user denied access
    if (error) {
      console.log('User denied OAuth access:', error);
      res.redirect(`${errorRedirect}&message=access_denied`);
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing code or state parameter');
      res.redirect(`${errorRedirect}&message=invalid_request`);
      return;
    }

    try {
      // Validate state token
      const stateDoc = await db
        .collection(FIRESTORE_PATHS.oauthStates)
        .doc(state as string)
        .get();

      if (!stateDoc.exists) {
        console.error('Invalid state token');
        res.redirect(`${errorRedirect}&message=invalid_state`);
        return;
      }

      const stateData = stateDoc.data() as OAuthStateDoc;

      // Check if state token has expired
      if (stateData.expiresAt.toDate() < new Date()) {
        console.error('Expired state token');
        await stateDoc.ref.delete();
        res.redirect(`${errorRedirect}&message=expired_state`);
        return;
      }

      const userId = stateData.userId;

      // Delete state token (one-time use)
      await stateDoc.ref.delete();

      // Exchange authorization code for tokens
      const oauth2Client = new google.auth.OAuth2(
        OAUTH_CONFIG.clientId,
        OAUTH_CONFIG.clientSecret,
        OAUTH_CONFIG.redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code as string);

      if (!tokens.access_token || !tokens.refresh_token) {
        console.error('Failed to obtain tokens');
        res.redirect(`${errorRedirect}&message=token_exchange_failed`);
        return;
      }

      // Set credentials for API calls
      oauth2Client.setCredentials(tokens);

      // Calculate expiry time
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString();

      // Prepare tokens for storage
      const oauthTokens: OAuthTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope || OAUTH_CONFIG.scopes.join(' '),
      };

      // Save tokens
      await saveTokens(userId, oauthTokens);

      // Fetch and store user's calendars, get primary calendar email
      const primaryEmail = await fetchAndStoreCalendars(userId, oauth2Client);

      // Update calendarConnection/status subcollection to indicate calendar is connected
      // This is what the frontend subscribes to
      await db
        .collection('users')
        .doc(userId)
        .collection('calendarConnection')
        .doc('status')
        .set({
          isConnected: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          email: primaryEmail,
        });

      console.log(`Calendar connected successfully for user ${userId}`);
      res.redirect(successRedirect);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.redirect(`${errorRedirect}&message=server_error`);
    }
  }
);

/**
 * Fetch calendar list from Google and store in Firestore
 *
 * @param userId - The user's Firebase UID
 * @param oauth2Client - Authenticated OAuth2 client
 * @returns The primary calendar's email address
 */
async function fetchAndStoreCalendars(
  userId: string,
  oauth2Client: InstanceType<typeof google.auth.OAuth2>
): Promise<string | null> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Fetch calendar list
  const response = await calendar.calendarList.list({
    minAccessRole: 'reader',
  });

  const calendars = response.data.items || [];
  const batch = db.batch();
  const calendarsRef = db.collection(FIRESTORE_PATHS.calendars(userId));

  // Store each calendar
  for (const cal of calendars) {
    if (!cal.id) continue;

    // Note: Don't include undefined values - Firestore doesn't allow them
    const calendarData: Omit<ConnectedCalendar, 'syncToken' | 'lastSyncAt'> = {
      id: cal.id,
      name: cal.summary || 'Untitled Calendar',
      type: inferCalendarType(cal),
      color: cal.backgroundColor || '#4285f4',
      primary: cal.primary || false,
      accessRole: mapAccessRole(cal.accessRole),
      enabled: cal.primary || false, // Only enable primary calendar by default
    };

    const docRef = calendarsRef.doc(encodeCalendarId(cal.id));
    batch.set(docRef, calendarData);
  }

  await batch.commit();
  console.log(`Stored ${calendars.length} calendars for user ${userId}`);

  // Return the primary calendar's ID (usually the user's email)
  const primaryCalendar = calendars.find((c) => c.primary);
  return primaryCalendar?.id || null;
}

/**
 * Infer calendar type based on calendar properties
 */
function inferCalendarType(
  cal: calendar_v3.Schema$CalendarListEntry
): 'work' | 'personal' {
  const summary = (cal.summary || '').toLowerCase();
  const workIndicators = ['work', 'office', 'job', 'business', 'company'];

  if (workIndicators.some((indicator) => summary.includes(indicator))) {
    return 'work';
  }

  // Check if it's a Google Workspace calendar (usually work)
  if (cal.accessRole === 'owner' && cal.id?.includes('@group.calendar.google.com')) {
    return 'work';
  }

  return 'personal';
}

/**
 * Map Google Calendar access role to our access role type
 */
function mapAccessRole(
  role: string | undefined | null
): 'reader' | 'writer' | 'owner' {
  switch (role) {
    case 'owner':
      return 'owner';
    case 'writer':
    case 'freeBusyReader':
      return 'writer';
    default:
      return 'reader';
  }
}

/**
 * Encode calendar ID for use as Firestore document ID
 * Calendar IDs can contain characters not allowed in document IDs
 */
function encodeCalendarId(calendarId: string): string {
  return encodeURIComponent(calendarId).replace(/\./g, '%2E');
}
