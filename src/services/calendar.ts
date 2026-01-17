/**
 * Calendar service for interacting with Cloud Functions
 * Handles OAuth flow, calendar management, and Firestore subscriptions
 * @module services/calendar
 */

import { httpsCallable } from 'firebase/functions'
import { doc, collection, query, orderBy, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore'
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
  const initOAuth = httpsCallable<void, { url: string }>(functions, 'calendarOAuthInit')
  const result = await initOAuth()
  return result.data
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
 * Updates the preferences for a specific calendar
 * @param userId - The user's ID
 * @param calendarId - The calendar's ID
 * @param enabled - Whether the calendar is enabled for sync
 * @param type - The calendar type (work or personal)
 */
export async function updateCalendarPreferences(
  userId: string,
  calendarId: string,
  enabled: boolean,
  type: 'work' | 'personal'
): Promise<void> {
  const calendarRef = doc(db, 'users', userId, 'calendars', calendarId)
  await updateDoc(calendarRef, {
    enabled,
    type,
    updatedAt: Timestamp.now(),
  })
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

  return onSnapshot(
    connectionRef,
    (snapshot) => {
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
      console.error('Error subscribing to calendar status:', error)
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

  return onSnapshot(
    q,
    (snapshot) => {
      const calendars: ConnectedCalendar[] = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data()
        return {
          id: docSnapshot.id,
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
      console.error('Error subscribing to calendars:', error)
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
        callback({
          enabledCalendarIds: data.enabledCalendarIds ?? [],
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
