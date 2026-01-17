import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow, CalendarEvent, TimeSlot as TimeSlotType } from '@/types/calendar'
import { TimeSlot, TimeSlotOutsideHours } from './TimeSlot'
import { EventBlock, AllDayEventBlock } from './EventBlock'
import { AvailabilityBar } from './AvailabilityOverlay'
import { CalendarHeaderCompact } from './CalendarHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isSameDay, isWithinInterval, setHours, setMinutes, startOfDay, addMinutes, isToday } from 'date-fns'

export interface DayViewProps {
  date: Date
  availability?: AvailabilityWindow
  events: CalendarEvent[]
  workingHours?: { start: string; end: string }
  onSlotClick?: (slot: TimeSlotType) => void
  selectedSlot?: TimeSlotType
  isLoading?: boolean
  // Navigation props for compact header
  onPrevious?: () => void
  onNext?: () => void
}

/**
 * Detailed single day view
 * More detailed than DayColumn, shows full hour labels
 * Better for mobile view
 */
export function DayView({
  date,
  availability,
  events,
  workingHours = { start: '09:00', end: '17:00' },
  onSlotClick,
  selectedSlot,
  isLoading = false,
  onPrevious,
  onNext,
}: DayViewProps) {
  const isTodayDate = isToday(date)

  // Generate time slots for the day
  const timeSlots = useMemo(() => {
    if (availability?.slots) {
      return availability.slots
    }
    // Generate default 30-minute slots from 6 AM to 10 PM
    return generateDefaultSlots(date, 30)
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

  // Check if a slot is selected
  const isSlotSelected = (slot: TimeSlotType) => {
    if (!selectedSlot) return false
    return slot.start.getTime() === selectedSlot.start.getTime() &&
           slot.end.getTime() === selectedSlot.end.getTime()
  }

  // Group slots by hour for better visual organization
  const slotsByHour = useMemo(() => {
    const grouped = new Map<number, TimeSlotType[]>()
    timeSlots.forEach(slot => {
      const hour = slot.start.getHours()
      const existing = grouped.get(hour) || []
      grouped.set(hour, [...existing, slot])
    })
    return grouped
  }, [timeSlots])

  if (isLoading) {
    return <DayViewSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Compact navigation header for mobile */}
      {onPrevious && onNext && (
        <CalendarHeaderCompact
          currentDate={date}
          onPrevious={onPrevious}
          onNext={onNext}
          isLoading={isLoading}
        />
      )}

      {/* Day header */}
      <Card className={cn(isTodayDate && 'border-blue-500')}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div>
              <span className={cn(
                'text-lg font-semibold',
                isTodayDate && 'text-blue-600 dark:text-blue-400'
              )}>
                {format(date, 'EEEE')}
              </span>
              <span className="text-muted-foreground ml-2">
                {format(date, 'MMMM d, yyyy')}
              </span>
              {isTodayDate && (
                <span className="ml-2 text-xs uppercase tracking-wider text-blue-500 font-medium">
                  Today
                </span>
              )}
            </div>
          </CardTitle>

          {/* Availability summary */}
          {availability && (
            <div className="flex items-center gap-2 mt-2">
              <AvailabilityBar availability={availability} height="sm" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {Math.round(availability.totalFreeMinutes / 60)}h free
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* All-day events */}
          {allDayEvents.length > 0 && (
            <div className="mb-4 space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                All Day
              </div>
              {allDayEvents.map(event => (
                <AllDayEventBlock key={event.id} event={event} />
              ))}
            </div>
          )}

          {/* Time slots grid */}
          <div
            className="border rounded-lg overflow-hidden"
            role="grid"
            aria-label={`Schedule for ${format(date, 'EEEE, MMMM d')}`}
          >
            {Array.from(slotsByHour.entries()).map(([hour, slots]) => {
              const withinWorkingHours = hour >= workingStart.getHours() && hour < workingEnd.getHours()

              return (
                <div
                  key={hour}
                  className={cn(
                    'flex border-b last:border-b-0',
                    !withinWorkingHours && 'opacity-60'
                  )}
                  role="row"
                >
                  {/* Hour label */}
                  <div
                    className={cn(
                      'w-16 md:w-20 flex-shrink-0 px-2 py-2 text-right',
                      'text-sm font-medium text-muted-foreground',
                      'border-r bg-muted/30'
                    )}
                  >
                    {format(setHours(startOfDay(date), hour), 'h a')}
                  </div>

                  {/* Slots for this hour */}
                  <div className="flex-1" role="gridcell">
                    {slots.map((slot, index) => {
                      const slotEvents = getEventsForSlot(slot)
                      const isSelected = isSlotSelected(slot)
                      const hasEvents = slotEvents.length > 0

                      if (!withinWorkingHours) {
                        return (
                          <TimeSlotOutsideHours
                            key={index}
                            slot={slot}
                            showTime={slots.length > 1}
                          />
                        )
                      }

                      return (
                        <div key={index} className="relative">
                          {hasEvents ? (
                            <div className="p-1 space-y-1 min-h-[3rem] bg-gray-50 dark:bg-gray-800/50 border-b last:border-b-0">
                              {slotEvents.map(event => (
                                <EventBlock
                                  key={event.id}
                                  event={event}
                                  compact={slots.length > 1}
                                />
                              ))}
                            </div>
                          ) : (
                            <TimeSlot
                              slot={slot}
                              isSelected={isSelected}
                              onClick={onSlotClick ? () => onSlotClick(slot) : undefined}
                              showTime={slots.length > 1}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Loading skeleton for DayView
 */
function DayViewSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-2 w-full mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-12 w-16" />
              <Skeleton className="h-12 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
 */
function generateDefaultSlots(date: Date, intervalMinutes: number = 60): TimeSlotType[] {
  const slots: TimeSlotType[] = []
  const startHour = 6 // 6 AM
  const endHour = 22  // 10 PM
  const slotsPerHour = 60 / intervalMinutes

  for (let hour = startHour; hour < endHour; hour++) {
    for (let slot = 0; slot < slotsPerHour; slot++) {
      const start = setMinutes(setHours(startOfDay(date), hour), slot * intervalMinutes)
      const end = addMinutes(start, intervalMinutes)
      slots.push({
        start,
        end,
        available: true
      })
    }
  }

  return slots
}
