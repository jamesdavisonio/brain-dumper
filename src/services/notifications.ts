import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db, waitForMessaging } from '@/lib/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export interface NotificationPreferences {
  enabled: boolean
  time: string // HH:MM format (24-hour)
  days: number[] // 0=Sunday, 1=Monday, etc.
  timezone: string
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  time: '07:00',
  days: [0, 1, 2, 3, 4, 5, 6], // Every day
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications')
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export type FCMTokenError =
  | 'messaging_not_supported'
  | 'vapid_key_not_configured'
  | 'permission_denied'
  | 'token_error'

export type FCMTokenResult =
  | { success: true; token: string }
  | { success: false; error: FCMTokenError }

/**
 * Get the FCM token for this device
 */
export async function getFCMToken(userId: string): Promise<FCMTokenResult> {
  try {
    // Check VAPID key first (before waiting for messaging)
    if (!VAPID_KEY) {
      console.error('VAPID key not configured')
      return { success: false, error: 'vapid_key_not_configured' }
    }

    // Wait for messaging to be initialized
    const messaging = await waitForMessaging()
    if (!messaging) {
      console.warn('Firebase Messaging not supported')
      return { success: false, error: 'messaging_not_supported' }
    }

    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) {
      return { success: false, error: 'permission_denied' }
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })

    if (token) {
      // Save token to Firestore
      await saveTokenToFirestore(userId, token)
      return { success: true, token }
    }

    return { success: false, error: 'token_error' }
  } catch (error) {
    console.error('Error getting FCM token:', error)
    return { success: false, error: 'token_error' }
  }
}

/**
 * Save FCM token to Firestore user document
 */
async function saveTokenToFirestore(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    await setDoc(
      userRef,
      {
        fcmToken: token,
        updatedAt: new Date(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error saving FCM token to Firestore:', error)
  }
}

/**
 * Save notification preferences to Firestore
 */
export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    await setDoc(
      userRef,
      {
        notificationPreferences: preferences,
        updatedAt: new Date(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error saving notification preferences:', error)
    throw error
  }
}

/**
 * Get notification preferences from localStorage (cached)
 */
export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem('notificationPreferences')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading notification preferences:', error)
  }
  return DEFAULT_PREFERENCES
}

/**
 * Save notification preferences to localStorage (cache)
 */
export function cacheNotificationPreferences(preferences: NotificationPreferences): void {
  try {
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences))
  } catch (error) {
    console.error('Error caching notification preferences:', error)
  }
}

/**
 * Initialize foreground message handling
 */
export async function initializeForegroundMessaging(): Promise<void> {
  const messaging = await waitForMessaging()
  if (!messaging) return

  onMessage(messaging, (payload) => {
    console.log('Received foreground message:', payload)

    // Show notification even when app is in foreground
    if (payload.notification) {
      new Notification(payload.notification.title || 'Brain Dumper', {
        body: payload.notification.body,
        icon: '/icon-192x192.png',
        badge: '/favicon-32x32.png',
        tag: 'daily-tasks',
      })
    }
  })
}

/**
 * Disable notifications for a user
 */
export async function disableNotifications(userId: string): Promise<void> {
  const preferences = getNotificationPreferences()
  preferences.enabled = false
  cacheNotificationPreferences(preferences)
  await saveNotificationPreferences(userId, preferences)
}

export type EnableNotificationsResult =
  | { success: true }
  | { success: false; error: FCMTokenError }

/**
 * Enable notifications for a user
 */
export async function enableNotifications(userId: string): Promise<EnableNotificationsResult> {
  const result = await getFCMToken(userId)
  if (!result.success) {
    return { success: false, error: result.error }
  }

  const preferences = getNotificationPreferences()
  preferences.enabled = true
  cacheNotificationPreferences(preferences)
  await saveNotificationPreferences(userId, preferences)

  return { success: true }
}
