/**
 * CalendarPreloader
 * Preloads calendar events in the background when the app starts
 * This component renders nothing but fetches data to warm the cache
 */

import { useEffect } from 'react'
import { useCalendar } from '@/context/CalendarContext'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { startOfWeek, endOfWeek } from 'date-fns'

export function CalendarPreloader() {
  const { isConnected, enabledCalendarIds } = useCalendar()

  // Calculate date range: current week only
  const now = new Date()
  const startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const endDate = endOfWeek(now, { weekStartsOn: 1 }) // Sunday

  // Prefetch calendar events when connected
  // The hook will cache the results, making subsequent loads faster
  useCalendarEvents({
    calendarIds: enabledCalendarIds,
    startDate,
    endDate,
    enabled: isConnected && enabledCalendarIds.length > 0,
  })

  useEffect(() => {
    if (isConnected && enabledCalendarIds.length > 0) {
      console.log('[CalendarPreloader] Warming calendar cache for', enabledCalendarIds.length, 'calendars')
    }
  }, [isConnected, enabledCalendarIds])

  // This component renders nothing - it just warms the cache
  return null
}
