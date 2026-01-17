import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow, CalendarEvent, TimeSlot as TimeSlotType } from '@/types/calendar'
import { TimeSlot, TimeSlotOutsideHours } from './TimeSlot'
import { EventBlock, AllDayEventBlock } from './EventBlock'
import { format, isSameDay, isWithinInterval, setHours, setMinutes, startOfDay, addMinutes } from 'date-fns'

export interface DayColumnProps {
  date: Date
  availability?: AvailabilityWindow
  events?: CalendarEvent[]
  isToday?: boolean
  showHours?: boolean  // Show hour labels on left
  workingHours?: { start: string; end: string }
  onSlotClick?: (slot: TimeSlotType) => void
  selectedSlot?: TimeSlotType
}

/**
 * Single day column showing time slots
 *
 * Layout:
 * +------------------+
 * |  Mon 20          |  <- Date header
 * +------------------+
 * | 08:00 [dimmed]   |  <- Before working hours
 * | 09:00 [event]    |  <- Busy (event block)
 * | 10:00            |  <- Free
 * | 11:00            |  <- Free
 * | 12:00 [dimmed]   |  <- Lunch (if protected)
 * | 13:00            |  <- Free
 * | ...              |
 * +------------------+
 */
export function DayColumn({
  date,
  availability,
  events = [],
  isToday = false,
  showHours = true,
  workingHours = { start: '09:00', end: '17:00' },
  onSlotClick,
  selectedSlot,
}: DayColumnProps) {
  // Generate time slots for the day
  const timeSlots = useMemo(() => {
    if (availability?.slots) {
      return availability.slots
    }
    // Generate default slots from 6 AM to 10 PM
    return generateDefaultSlots(date)
  }, [availability, date])

  // Parse working hours
  const workingStart = useMemo(() => parseTimeString(workingHours.start, date), [workingHours.start, date])
  const workingEnd = useMemo(() => parseTimeString(workingHours.end, date), [workingHours.end, date])

  // Separate all-day events from timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const dayEvents = events.filter(e =>
      isSameDay(e.start, date) || isSameDay(e.end, date) ||
      isWithinInterval(date, { start: e.start, end: e.end })
    )
    return {
      allDayEvents: dayEvents.filter(e => e.allDay),
      timedEvents: dayEvents.filter(e => !e.allDay)
    }
  }, [events, date])

  // Get events for a specific slot
  const getEventsForSlot = (slot: TimeSlotType) => {
    return timedEvents.filter(event =>
      (event.start >= slot.start && event.start < slot.end) ||
      (slot.start >= event.start && slot.start < event.end)
    )
  }

  // Check if slot is within working hours
  const isWithinWorkingHours = (slot: TimeSlotType) => {
    return slot.start >= workingStart && slot.end <= workingEnd
  }

  // Check if a slot is selected
  const isSlotSelected = (slot: TimeSlotType) => {
    if (!selectedSlot) return false
    return slot.start.getTime() === selectedSlot.start.getTime() &&
           slot.end.getTime() === selectedSlot.end.getTime()
  }

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border last:border-r-0',
        'min-w-[120px] md:min-w-[150px]'
      )}
      role="region"
      aria-label={`Calendar for ${format(date, 'EEEE, MMMM d')}`}
    >
      {/* Date header */}
      <div
        className={cn(
          'sticky top-0 z-10 px-2 py-2 text-center border-b border-border',
          'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
          isToday && 'bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        <div className={cn(
          'text-xs font-medium uppercase tracking-wide',
          isToday ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
        )}>
          {format(date, 'EEE')}
        </div>
        <div className={cn(
          'text-lg font-semibold',
          isToday && 'text-blue-600 dark:text-blue-400'
        )}>
          {format(date, 'd')}
        </div>
        {isToday && (
          <div className="text-[10px] uppercase tracking-wider text-blue-500 font-medium">
            Today
          </div>
        )}
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-1 py-1 border-b border-border space-y-1 bg-muted/30">
          {allDayEvents.map(event => (
            <AllDayEventBlock
              key={event.id}
              event={event}
            />
          ))}
        </div>
      )}

      {/* Time slots */}
      <div className="flex-1 relative">
        {timeSlots.map((slot, index) => {
          const slotEvents = getEventsForSlot(slot)
          const withinWorkingHours = isWithinWorkingHours(slot)
          const isSelected = isSlotSelected(slot)
          const hasEvents = slotEvents.length > 0

          // Render outside working hours slot
          if (!withinWorkingHours) {
            return (
              <div key={index} className="flex">
                {showHours && (
                  <div className="w-12 md:w-14 text-[10px] text-muted-foreground/50 px-1 py-1 border-r border-border/30 flex-shrink-0">
                    {format(slot.start, 'h a')}
                  </div>
                )}
                <div className="flex-1">
                  <TimeSlotOutsideHours slot={slot} showTime={!showHours} />
                </div>
              </div>
            )
          }

          return (
            <div key={index} className="flex">
              {showHours && (
                <div className="w-12 md:w-14 text-[10px] text-muted-foreground px-1 py-1 border-r border-border/50 flex-shrink-0">
                  {format(slot.start, 'h a')}
                </div>
              )}
              <div className="flex-1 relative">
                {hasEvents ? (
                  <div className="p-1 space-y-1 min-h-[2.5rem] bg-gray-50 dark:bg-gray-800/50">
                    {slotEvents.map(event => (
                      <EventBlock
                        key={event.id}
                        event={event}
                        compact={true}
                      />
                    ))}
                  </div>
                ) : (
                  <TimeSlot
                    slot={slot}
                    isSelected={isSelected}
                    onClick={onSlotClick ? () => onSlotClick(slot) : undefined}
                    showTime={!showHours}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Parse time string (HH:mm) to Date
 */
function parseTimeString(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return setMinutes(setHours(startOfDay(date), hours), minutes)
}

/**
 * Generate default time slots for a day
 * Slots are 1 hour each from 6 AM to 10 PM
 */
function generateDefaultSlots(date: Date): TimeSlotType[] {
  const slots: TimeSlotType[] = []
  const startHour = 6 // 6 AM
  const endHour = 22  // 10 PM

  for (let hour = startHour; hour < endHour; hour++) {
    const start = setMinutes(setHours(startOfDay(date), hour), 0)
    const end = addMinutes(start, 60)
    slots.push({
      start,
      end,
      available: true
    })
  }

  return slots
}
