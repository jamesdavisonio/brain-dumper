import { useMemo } from 'react'
import { CalendarView, CalendarViewEmpty } from '@/components/calendar'
import type { AvailabilityWindow, CalendarEvent, TimeSlot } from '@/types/calendar'
import { addDays, startOfWeek, setHours, setMinutes, startOfDay, addMinutes } from 'date-fns'

/**
 * Calendar View Page
 *
 * Displays the calendar availability view with events from connected calendars.
 * Currently uses mock data; will integrate with calendar hooks when available.
 */
export function CalendarViewPage() {
  // Generate mock data for demonstration
  // TODO: Replace with actual hooks when Agent 2B completes them
  // const { availability, isLoading: availabilityLoading } = useAvailability(dateRange)
  // const { events, isLoading: eventsLoading } = useCalendarEvents(dateRange)

  const mockData = useMemo(() => generateMockData(), [])

  const handleSlotSelect = (date: Date, slot: TimeSlot) => {
    console.log('Selected slot:', { date, slot })
    // TODO: Open task scheduling dialog or navigate to task creation
  }

  // Check if calendar is connected
  // TODO: Replace with actual connection check
  const isConnected = true

  if (!isConnected) {
    return <CalendarViewEmpty />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
      </div>

      <CalendarView
        availability={mockData.availability}
        events={mockData.events}
        onSlotSelect={handleSlotSelect}
        workingHours={{ start: '09:00', end: '17:00' }}
        showStats={true}
        isLoading={false}
      />
    </div>
  )
}

/**
 * Generate mock availability and events data for demonstration
 */
function generateMockData(): { availability: AvailabilityWindow[]; events: CalendarEvent[] } {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  const availability: AvailabilityWindow[] = []
  const events: CalendarEvent[] = []

  // Generate data for 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(weekStart, dayOffset)
    const isWeekend = dayOffset >= 5

    // Create slots for the day
    const slots: TimeSlot[] = []
    let totalFreeMinutes = 0
    let totalBusyMinutes = 0

    // Working hours: 9 AM to 5 PM (30-minute slots)
    for (let hour = 9; hour < 17; hour++) {
      for (let half = 0; half < 2; half++) {
        const slotStart = setMinutes(setHours(date, hour), half * 30)
        const slotEnd = addMinutes(slotStart, 30)

        // Random availability for demo
        const isBusy = !isWeekend && Math.random() < 0.3

        slots.push({
          start: slotStart,
          end: slotEnd,
          available: !isBusy && !isWeekend,
        })

        if (isBusy || isWeekend) {
          totalBusyMinutes += 30
        } else {
          totalFreeMinutes += 30
        }
      }
    }

    availability.push({
      date,
      slots,
      totalFreeMinutes: isWeekend ? 0 : totalFreeMinutes,
      totalBusyMinutes: isWeekend ? 480 : totalBusyMinutes,
    })

    // Add some mock events (not on weekends)
    if (!isWeekend) {
      // Morning standup
      if (dayOffset < 5) {
        events.push({
          id: `standup-${dayOffset}`,
          calendarId: 'primary',
          title: 'Team Standup',
          start: setHours(date, 9),
          end: setMinutes(setHours(date, 9), 30),
          allDay: false,
          status: 'confirmed',
        })
      }

      // Random meetings
      if (Math.random() > 0.5) {
        const meetingHour = 10 + Math.floor(Math.random() * 5)
        events.push({
          id: `meeting-${dayOffset}`,
          calendarId: 'primary',
          title: ['Design Review', 'Sprint Planning', '1:1 Meeting', 'Team Sync'][Math.floor(Math.random() * 4)],
          start: setHours(date, meetingHour),
          end: setHours(date, meetingHour + 1),
          allDay: false,
          status: Math.random() > 0.8 ? 'tentative' : 'confirmed',
        })
      }

      // Lunch block
      if (dayOffset === 2) {
        events.push({
          id: `lunch-${dayOffset}`,
          calendarId: 'personal',
          title: 'Lunch Break',
          start: setHours(date, 12),
          end: setHours(date, 13),
          allDay: false,
          status: 'confirmed',
        })
      }
    }
  }

  return { availability, events }
}

export default CalendarViewPage
