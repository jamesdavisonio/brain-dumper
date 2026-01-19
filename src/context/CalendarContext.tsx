import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  initiateOAuthFlow,
  getCalendarList,
  disconnectCalendar as disconnectCalendarService,
  updateCalendarPreferences as updateCalendarPreferencesService,
  setDefaultCalendar as setDefaultCalendarService,
  subscribeToCalendarStatus,
  subscribeToCalendars,
  subscribeToCalendarPreferences,
  type CalendarConnectionStatus,
  type CalendarPreferences,
} from '@/services/calendar'
import { openOAuthPopup } from '@/lib/oauthPopup'
import type { ConnectedCalendar } from '@/types/calendar'

/**
 * Calendar context type definition
 */
export interface CalendarContextType {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  connectedAt: Date | null
  connectedEmail: string | null

  // Calendars
  calendars: ConnectedCalendar[]
  isLoadingCalendars: boolean

  // Selected/enabled calendars
  enabledCalendarIds: string[]
  workCalendarId: string | null
  personalCalendarId: string | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refreshCalendars: () => Promise<void>
  toggleCalendar: (calendarId: string, enabled: boolean) => Promise<void>
  setCalendarType: (calendarId: string, type: 'work' | 'personal') => Promise<void>
  setDefaultCalendar: (calendarId: string, type: 'work' | 'personal') => Promise<void>
}

const CalendarContext = createContext<CalendarContextType | null>(null)

interface CalendarProviderProps {
  children: ReactNode
}

export function CalendarProvider({ children }: CalendarProviderProps) {
  const { user } = useAuth()

  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(null)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)

  // Calendar data
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([])
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false)

  // Preferences
  const [enabledCalendarIds, setEnabledCalendarIds] = useState<string[]>([])
  const [workCalendarId, setWorkCalendarId] = useState<string | null>(null)
  const [personalCalendarId, setPersonalCalendarId] = useState<string | null>(null)

  // Subscribe to connection status changes
  useEffect(() => {
    if (!user) {
      // Reset state when user logs out
      setIsConnected(false)
      setIsConnecting(false)
      setConnectedAt(null)
      setConnectedEmail(null)
      setCalendars([])
      setEnabledCalendarIds([])
      setWorkCalendarId(null)
      setPersonalCalendarId(null)
      setConnectionError(null)
      return
    }

    console.log('[CalendarContext] Setting up Firestore subscription for user:', user.uid)
    const unsubscribe = subscribeToCalendarStatus(user.uid, (status: CalendarConnectionStatus) => {
      console.log('[CalendarContext] Received status update:', status)
      setIsConnected(status.isConnected)
      setConnectedAt(status.connectedAt)
      setConnectedEmail(status.email)
      if (status.error) {
        setConnectionError(status.error)
      }
      // When connection status changes (either connected or error), stop the connecting state
      if (status.isConnected || status.error) {
        console.log('[CalendarContext] Connection complete, setting isConnecting to false')
        setIsConnecting(false)
      }
    })

    return () => unsubscribe()
  }, [user])

  // Subscribe to calendars when connected
  useEffect(() => {
    if (!user || !isConnected) {
      setCalendars([])
      return
    }

    setIsLoadingCalendars(true)
    const unsubscribe = subscribeToCalendars(user.uid, (loadedCalendars) => {
      setCalendars(loadedCalendars)
      setIsLoadingCalendars(false)
    })

    return () => unsubscribe()
  }, [user, isConnected])

  // Subscribe to calendar preferences
  useEffect(() => {
    if (!user) {
      return
    }

    const unsubscribe = subscribeToCalendarPreferences(user.uid, (prefs: CalendarPreferences) => {
      setEnabledCalendarIds(prefs.enabledCalendarIds)
      setWorkCalendarId(prefs.workCalendarId)
      setPersonalCalendarId(prefs.personalCalendarId)
    })

    return () => unsubscribe()
  }, [user])

  // Connect to Google Calendar
  const connect = useCallback(async () => {
    if (!user) {
      setConnectionError('You must be logged in to connect a calendar')
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      // Get the OAuth URL from our Cloud Function
      const { url } = await initiateOAuthFlow()

      // Open the OAuth popup
      const result = await openOAuthPopup(url)

      if (!result.success) {
        setConnectionError(result.error ?? 'Failed to connect calendar')
        setIsConnecting(false)
      }
      // On success, we keep isConnecting true until the Firestore subscription
      // detects the connection change. The popup will redirect to the app
      // settings page after OAuth completes, and Firestore will be updated.
      // The subscription in useEffect will update isConnected to true.
    } catch (error) {
      console.error('Error initiating OAuth flow:', error)
      setConnectionError(
        error instanceof Error ? error.message : 'Failed to initiate calendar connection'
      )
      setIsConnecting(false)
    }
  }, [user])

  // Disconnect from Google Calendar
  const disconnect = useCallback(async () => {
    if (!user) {
      return
    }

    setConnectionError(null)

    try {
      await disconnectCalendarService()
      // The subscription will update the state
    } catch (error) {
      console.error('Error disconnecting calendar:', error)
      setConnectionError(
        error instanceof Error ? error.message : 'Failed to disconnect calendar'
      )
    }
  }, [user])

  // Refresh the calendar list
  const refreshCalendars = useCallback(async () => {
    if (!user || !isConnected) {
      return
    }

    setIsLoadingCalendars(true)
    setConnectionError(null)

    try {
      const loadedCalendars = await getCalendarList()
      setCalendars(loadedCalendars)
    } catch (error) {
      console.error('Error refreshing calendars:', error)
      setConnectionError(
        error instanceof Error ? error.message : 'Failed to refresh calendars'
      )
    } finally {
      setIsLoadingCalendars(false)
    }
  }, [user, isConnected])

  // Toggle a calendar's enabled state
  const toggleCalendar = useCallback(
    async (calendarId: string, enabled: boolean) => {
      if (!user) {
        return
      }

      try {
        const calendar = calendars.find((c) => c.id === calendarId)
        const type = calendar?.type ?? 'personal'
        await updateCalendarPreferencesService(user.uid, calendarId, enabled, type)

        // Optimistically update local state
        if (enabled) {
          setEnabledCalendarIds((prev) => [...prev, calendarId])
        } else {
          setEnabledCalendarIds((prev) => prev.filter((id) => id !== calendarId))
        }
      } catch (error) {
        console.error('Error toggling calendar:', error)
        setConnectionError(
          error instanceof Error ? error.message : 'Failed to update calendar preference'
        )
      }
    },
    [user, calendars]
  )

  // Set a calendar's type (work or personal)
  const setCalendarType = useCallback(
    async (calendarId: string, type: 'work' | 'personal') => {
      if (!user) {
        return
      }

      try {
        const calendar = calendars.find((c) => c.id === calendarId)
        const enabled = calendar?.enabled ?? false
        await updateCalendarPreferencesService(user.uid, calendarId, enabled, type)

        // Optimistically update local state
        setCalendars((prev) =>
          prev.map((c) => (c.id === calendarId ? { ...c, type } : c))
        )
      } catch (error) {
        console.error('Error setting calendar type:', error)
        setConnectionError(
          error instanceof Error ? error.message : 'Failed to update calendar type'
        )
      }
    },
    [user, calendars]
  )

  // Set a default calendar for a type
  const setDefaultCalendarFn = useCallback(
    async (calendarId: string, type: 'work' | 'personal') => {
      if (!user) {
        return
      }

      try {
        await setDefaultCalendarService(user.uid, calendarId, type)

        // Optimistically update local state
        if (type === 'work') {
          setWorkCalendarId(calendarId)
        } else {
          setPersonalCalendarId(calendarId)
        }
      } catch (error) {
        console.error('Error setting default calendar:', error)
        setConnectionError(
          error instanceof Error ? error.message : 'Failed to set default calendar'
        )
      }
    },
    [user]
  )

  const value: CalendarContextType = {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    connectedAt,
    connectedEmail,

    // Calendars
    calendars,
    isLoadingCalendars,

    // Preferences
    enabledCalendarIds,
    workCalendarId,
    personalCalendarId,

    // Actions
    connect,
    disconnect,
    refreshCalendars,
    toggleCalendar,
    setCalendarType,
    setDefaultCalendar: setDefaultCalendarFn,
  }

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  )
}

/**
 * Hook to access the calendar context
 * @throws Error if used outside of CalendarProvider
 */
export function useCalendar(): CalendarContextType {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider')
  }
  return context
}
