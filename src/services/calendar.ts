/**
 * Calendar service for interacting with Cloud Functions
 * Handles OAuth flow, calendar management, and Firestore subscriptions
 * @module services/calendar
 */

import { httpsCallable } from 'firebase/functions'
import { doc, collection, query, orderBy, onSnapshot, updateDoc, setDoc, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { functions, db } from '@/lib/firebase'
import type { ConnectedCalendar } from '@/types/calendar'

/**
 * Represents the calendar connection status stored in Firestore
 */
export interface CalendarConnectionStatus {
  isConnected: boolean
  connectedAt: Date | null
  email: string | null
  error?: string
}

/**
 * Represents calendar preferences stored in Firestore
 */
export interface CalendarPreferences {
  enabledCalendarIds: string[]
  workCalendarId: string | null
  personalCalendarId: string | null
}

/**
 * Initiates the OAuth flow for Google Calendar
 * Returns a URL to open in a popup for user authentication
 */
export async function initiateOAuthFlow(): Promise<{ url: string }> {
  const initOAuth = httpsCallable<void, { authUrl: string }>(functions, 'calendarOAuthInit')
  const result = await initOAuth()
  return { url: result.data.authUrl }
}

/**
 * Gets the list of calendars from the connected Google account
 */
export async function getCalendarList(): Promise<ConnectedCalendar[]> {
  const getCalendars = httpsCallable<void, ConnectedCalendar[]>(functions, 'getCalendarList')
  const result = await getCalendars()
  return result.data
}

/**
 * Disconnects the Google Calendar integration
 */
export async function disconnectCalendar(): Promise<void> {
  const disconnect = httpsCallable<void, void>(functions, 'disconnectCalendar')
  await disconnect()
}

/**
 * Refreshes the OAuth tokens
 * Returns true if refresh was successful, false otherwise
 */
export async function refreshTokens(): Promise<boolean> {
  const refresh = httpsCallable<void, { success: boolean }>(functions, 'refreshCalendarTokens')
  const result = await refresh()
  return result.data.success
}

/**
 * Encode calendar ID for use as Firestore document ID
 * Calendar IDs (like email addresses) can contain characters not allowed in document IDs
 */
function encodeCalendarId(calendarId: string): string {
  return encodeURIComponent(calendarId).replace(/\./g, '%2E')
}

/**
 * Updates the preferences for a specific calendar
 * @param userId - The user's ID
 * @param calendarId - The calendar's ID (will be encoded for Firestore)
 * @param enabled - Whether the calendar is enabled for sync
 * @param type - The calendar type (work or personal)
 */
export async function updateCalendarPreferences(
  userId: string,
  calendarId: string,
  enabled: boolean,
  type: 'work' | 'personal'
): Promise<void> {
  // calendarId is now the raw Google Calendar ID (e.g., "user@gmail.com")
  // We need to encode it for the Firestore document path
  const encodedId = encodeCalendarId(calendarId)
  const calendarRef = doc(db, 'users', userId, 'calendars', encodedId)
  const preferencesRef = doc(db, 'users', userId, 'preferences', 'calendar')

  console.log('[calendar.ts] Updating calendar preferences:', { calendarId, encodedId, enabled, type })

  // Update the calendar document
  await updateDoc(calendarRef, {
    enabled,
    type,
    updatedAt: Timestamp.now(),
  })

  // Also update the preferences document's enabledCalendarIds array
  // Store the RAW calendar ID (not encoded) - this is what gets sent to Google Calendar API
  if (enabled) {
    await setDoc(preferencesRef, {
      enabledCalendarIds: arrayUnion(calendarId),
    }, { merge: true })
  } else {
    await setDoc(preferencesRef, {
      enabledCalendarIds: arrayRemove(calendarId),
    }, { merge: true })
  }
}

/**
 * Sets a calendar as the default for a specific type
 * @param userId - The user's ID
 * @param calendarId - The calendar's ID to set as default
 * @param type - The type of default calendar (work or personal)
 */
export async function setDefaultCalendar(
  userId: string,
  calendarId: string,
  type: 'work' | 'personal'
): Promise<void> {
  const preferencesRef = doc(db, 'users', userId, 'preferences', 'calendar')
  const updates: Record<string, string> = type === 'work'
    ? { workCalendarId: calendarId }
    : { personalCalendarId: calendarId }

  await updateDoc(preferencesRef, updates)
}

/**
 * Subscribes to real-time updates of the calendar connection status
 * @param userId - The user's ID
 * @param callback - Function called whenever the connection status changes
 * @returns Unsubscribe function
 */
export function subscribeToCalendarStatus(
  userId: string,
  callback: (status: CalendarConnectionStatus) => void
): () => void {
  const connectionRef = doc(db, 'users', userId, 'calendarConnection', 'status')
  console.log('[calendar.ts] Subscribing to:', connectionRef.path)

  return onSnapshot(
    connectionRef,
    (snapshot) => {
      console.log('[calendar.ts] Snapshot received, exists:', snapshot.exists(), 'data:', snapshot.data())
      if (snapshot.exists()) {
        const data = snapshot.data()
        callback({
          isConnected: data.isConnected ?? false,
          connectedAt: data.connectedAt?.toDate() ?? null,
          email: data.email ?? null,
          error: data.error,
        })
      } else {
        callback({
          isConnected: false,
          connectedAt: null,
          email: null,
        })
      }
    },
    (error) => {
      console.error('[calendar.ts] Error subscribing to calendar status:', error)
      callback({
        isConnected: false,
        connectedAt: null,
        email: null,
        error: error.message,
      })
    }
  )
}

/**
 * Subscribes to real-time updates of the user's calendars
 * @param userId - The user's ID
 * @param callback - Function called whenever calendars change
 * @returns Unsubscribe function
 */
export function subscribeToCalendars(
  userId: string,
  callback: (calendars: ConnectedCalendar[]) => void
): () => void {
  const calendarsRef = collection(db, 'users', userId, 'calendars')
  const q = query(calendarsRef, orderBy('name', 'asc'))
  console.log('[calendar.ts] Subscribing to calendars for user:', userId)

  return onSnapshot(
    q,
    (snapshot) => {
      console.log('[calendar.ts] Calendars snapshot received, count:', snapshot.docs.length)
      const calendars: ConnectedCalendar[] = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data()
        // Use the raw calendar ID stored in the document, not the encoded document ID
        // The document ID is URL-encoded for Firestore compatibility, but the 'id' field
        // contains the actual Google Calendar ID (e.g., "user@gmail.com")
        const calendarId = (data.id as string) || decodeURIComponent(docSnapshot.id)
        console.log('[calendar.ts] Calendar doc:', docSnapshot.id, 'id:', calendarId, 'enabled:', data.enabled)
        return {
          id: calendarId,
          name: data.name as string,
          type: (data.type as 'work' | 'personal') ?? 'personal',
          color: data.color as string,
          primary: data.primary as boolean ?? false,
          accessRole: (data.accessRole as ConnectedCalendar['accessRole']) ?? 'reader',
          enabled: data.enabled as boolean ?? false,
          syncToken: data.syncToken as string | undefined,
          lastSyncAt: data.lastSyncAt ? data.lastSyncAt.toDate() : undefined,
        }
      })
      callback(calendars)
    },
    (error: Error) => {
      console.error('[calendar.ts] Error subscribing to calendars:', error)
      callback([])
    }
  )
}

/**
 * Subscribes to real-time updates of calendar preferences
 * @param userId - The user's ID
 * @param callback - Function called whenever preferences change
 * @returns Unsubscribe function
 */
export function subscribeToCalendarPreferences(
  userId: string,
  callback: (preferences: CalendarPreferences) => void
): () => void {
  const preferencesRef = doc(db, 'users', userId, 'preferences', 'calendar')

  return onSnapshot(
    preferencesRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        // Decode any URL-encoded calendar IDs (for backward compatibility)
        // Old data may have stored encoded IDs like "user%40gmail.com" instead of "user@gmail.com"
        const rawEnabledIds = (data.enabledCalendarIds ?? []) as string[]
        // Decode and deduplicate calendar IDs
        const decodedIds = rawEnabledIds.map((id) => {
          // If the ID contains URL-encoded characters, decode it
          if (id.includes('%')) {
            try {
              return decodeURIComponent(id)
            } catch {
              return id
            }
          }
          return id
        })
        // Remove duplicates (same ID might appear encoded and decoded)
        const enabledCalendarIds = [...new Set(decodedIds)]
        callback({
          enabledCalendarIds,
          workCalendarId: data.workCalendarId ?? null,
          personalCalendarId: data.personalCalendarId ?? null,
        })
      } else {
        callback({
          enabledCalendarIds: [],
          workCalendarId: null,
          personalCalendarId: null,
        })
      }
    },
    (error) => {
      console.error('Error subscribing to calendar preferences:', error)
      callback({
        enabledCalendarIds: [],
        workCalendarId: null,
        personalCalendarId: null,
      })
    }
  )
}
