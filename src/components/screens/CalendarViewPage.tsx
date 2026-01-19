import { CalendarView, CalendarViewEmpty } from '@/components/calendar'
import type { TimeSlot } from '@/types/calendar'
import { useCalendar } from '@/context/CalendarContext'
import { useDateRange } from '@/hooks/useDateRange'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { useAvailability } from '@/hooks/useAvailability'

/**
 * Calendar View Page
 *
 * Displays the calendar availability view with events from connected calendars.
 * Fetches real calendar events from Google Calendar via Cloud Functions.
 */
export function CalendarViewPage() {
  const { isConnected, enabledCalendarIds, isLoadingCalendars } = useCalendar()

  // Date range for the calendar view (default 7 days)
  const { startDate, endDate } = useDateRange({ defaultRangeDays: 7 })

  // Fetch calendar events for enabled calendars
  const {
    events,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useCalendarEvents({
    calendarIds: enabledCalendarIds,
    startDate,
    endDate,
    enabled: isConnected && enabledCalendarIds.length > 0,
  })

  // Fetch availability data
  const {
    availability,
    isLoading: isLoadingAvailability,
    error: availabilityError,
  } = useAvailability({
    startDate,
    endDate,
    calendarIds: enabledCalendarIds,
    workingHours: { start: '09:00', end: '17:00' },
    enabled: isConnected && enabledCalendarIds.length > 0,
  })

  const handleSlotSelect = (date: Date, slot: TimeSlot) => {
    console.log('Selected slot:', { date, slot })
    // TODO: Open task scheduling dialog or navigate to task creation
  }

  // Show empty state if calendar is not connected
  if (!isConnected) {
    return <CalendarViewEmpty />
  }

  const isLoading = isLoadingCalendars || isLoadingEvents || isLoadingAvailability
  const error = eventsError || availabilityError

  // Log errors for debugging
  if (error) {
    console.error('[CalendarViewPage] Error:', error)
  }

  // Log what we're displaying for debugging
  console.log('[CalendarViewPage] Rendering with:', {
    isConnected,
    enabledCalendarIds,
    eventsCount: events.length,
    availabilityCount: availability.length,
    isLoading,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
      </div>

      <CalendarView
        availability={availability}
        events={events}
        onSlotSelect={handleSlotSelect}
        enabledCalendarIds={enabledCalendarIds}
        workingHours={{ start: '09:00', end: '17:00' }}
        showStats={true}
        isLoading={isLoading}
      />
    </div>
  )
}

export default CalendarViewPage
