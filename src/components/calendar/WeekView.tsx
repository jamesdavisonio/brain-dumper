import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow, CalendarEvent, TimeSlot as TimeSlotType } from '@/types/calendar'
import { DayColumn } from './DayColumn'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { format, isSameDay, isToday, startOfDay, setHours } from 'date-fns'

export interface WeekViewProps {
  dates: Date[]  // 7 days
  availability: AvailabilityWindow[]
  events: CalendarEvent[]
  workingHours?: { start: string; end: string }
  onSlotClick?: (date: Date, slot: TimeSlotType) => void
  selectedSlot?: { date: Date; slot: TimeSlotType }
  isLoading?: boolean
}

/**
 * Week grid showing multiple days
 *
 * Layout:
 * +-----+-----+-----+-----+-----+-----+-----+
 * | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
 * | 20  | 21  | 22  | 23  | 24  | 25  | 26  |
 * +-----+-----+-----+-----+-----+-----+-----+
 * |     | ### |     |     | ### |     |     |
 * | ### |     |     | ### |     |     |     |
 * |     |     | ### |     |     |     |     |
 * +-----+-----+-----+-----+-----+-----+-----+
 */
export function WeekView({
  dates,
  availability,
  events,
  workingHours = { start: '09:00', end: '17:00' },
  onSlotClick,
  selectedSlot,
  isLoading = false,
}: WeekViewProps) {
  // Get availability for each date
  const getAvailabilityForDate = (date: Date): AvailabilityWindow | undefined => {
    return availability.find(a => isSameDay(a.date, date))
  }

  // Get events for each date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(e =>
      isSameDay(e.start, date) || isSameDay(e.end, date)
    )
  }

  // Handle slot click with date context
  const handleSlotClick = (date: Date) => (slot: TimeSlotType) => {
    if (onSlotClick) {
      onSlotClick(date, slot)
    }
  }

  // Check if a slot is selected for a specific date
  const getSelectedSlotForDate = (date: Date): TimeSlotType | undefined => {
    if (!selectedSlot) return undefined
    if (!isSameDay(selectedSlot.date, date)) return undefined
    return selectedSlot.slot
  }

  // Generate time labels (shared across all columns)
  const timeLabels = useMemo(() => {
    const labels: Date[] = []
    for (let hour = 6; hour < 22; hour++) {
      labels.push(setHours(startOfDay(new Date()), hour))
    }
    return labels
  }, [])

  if (isLoading) {
    return <WeekViewSkeleton />
  }

  return (
    <div
      className="border rounded-lg overflow-hidden bg-card"
      role="grid"
      aria-label="Week view calendar"
    >
      {/* Desktop: scrollable horizontal layout */}
      <ScrollArea className="w-full">
        <div className="flex min-w-[700px]">
          {/* Time labels column */}
          <div className="w-14 flex-shrink-0 border-r bg-muted/30">
            {/* Empty header cell */}
            <div className="h-[72px] border-b" />
            {/* Time labels */}
            {timeLabels.map((time, index) => (
              <div
                key={index}
                className="h-10 flex items-start justify-end px-2 pt-1 text-[10px] text-muted-foreground"
              >
                {format(time, 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dates.map((date, index) => {
            const dateAvailability = getAvailabilityForDate(date)
            const dateEvents = getEventsForDate(date)
            const selectedForDate = getSelectedSlotForDate(date)
            const isTodayDate = isToday(date)

            return (
              <div
                key={index}
                className="flex-1 min-w-[100px] border-r last:border-r-0"
                role="gridcell"
              >
                <DayColumn
                  date={date}
                  availability={dateAvailability}
                  events={dateEvents}
                  isToday={isTodayDate}
                  showHours={false}
                  workingHours={workingHours}
                  onSlotClick={handleSlotClick(date)}
                  selectedSlot={selectedForDate}
                />
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}

/**
 * Compact week view for mobile - shows day summaries
 */
export interface WeekViewCompactProps {
  dates: Date[]
  availability: AvailabilityWindow[]
  events: CalendarEvent[]
  onDayClick?: (date: Date) => void
  selectedDate?: Date
  isLoading?: boolean
}

export function WeekViewCompact({
  dates,
  availability,
  events,
  onDayClick,
  selectedDate,
  isLoading = false,
}: WeekViewCompactProps) {
  // Get availability for each date
  const getAvailabilityForDate = (date: Date): AvailabilityWindow | undefined => {
    return availability.find(a => isSameDay(a.date, date))
  }

  // Get events count for each date
  const getEventsCountForDate = (date: Date): number => {
    return events.filter(e =>
      isSameDay(e.start, date) || isSameDay(e.end, date)
    ).length
  }

  if (isLoading) {
    return <WeekViewCompactSkeleton />
  }

  return (
    <div
      className="grid grid-cols-7 gap-1 p-2"
      role="grid"
      aria-label="Week view calendar"
    >
      {dates.map((date, index) => {
        const dateAvailability = getAvailabilityForDate(date)
        const eventsCount = getEventsCountForDate(date)
        const isTodayDate = isToday(date)
        const isSelected = selectedDate && isSameDay(date, selectedDate)

        const freePercentage = dateAvailability
          ? Math.round(
              (dateAvailability.totalFreeMinutes /
                (dateAvailability.totalFreeMinutes + dateAvailability.totalBusyMinutes)) *
                100
            )
          : 100

        return (
          <button
            key={index}
            onClick={() => onDayClick?.(date)}
            disabled={!onDayClick}
            className={cn(
              'flex flex-col items-center p-2 rounded-lg transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              isSelected && 'bg-primary/10 ring-2 ring-primary',
              !isSelected && 'hover:bg-muted/50',
              isTodayDate && !isSelected && 'bg-blue-50 dark:bg-blue-900/20'
            )}
            aria-label={`${format(date, 'EEEE, MMMM d')}, ${freePercentage}% available, ${eventsCount} events`}
            aria-pressed={isSelected}
            role="gridcell"
          >
            {/* Day name */}
            <span className={cn(
              'text-[10px] font-medium uppercase',
              isTodayDate ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
            )}>
              {format(date, 'EEE')}
            </span>

            {/* Day number */}
            <span className={cn(
              'text-lg font-semibold',
              isTodayDate && 'text-blue-600 dark:text-blue-400',
              isSelected && 'text-primary'
            )}>
              {format(date, 'd')}
            </span>

            {/* Availability indicator */}
            <div
              className={cn(
                'w-full h-1 rounded-full mt-1',
                freePercentage >= 60 && 'bg-green-400',
                freePercentage >= 30 && freePercentage < 60 && 'bg-yellow-400',
                freePercentage < 30 && 'bg-red-400'
              )}
              aria-hidden="true"
            />

            {/* Events indicator */}
            {eventsCount > 0 && (
              <span className="text-[10px] text-muted-foreground mt-1">
                {eventsCount} {eventsCount === 1 ? 'event' : 'events'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Loading skeleton for WeekView
 */
function WeekViewSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex">
        {/* Time labels column skeleton */}
        <div className="w-14 flex-shrink-0 border-r">
          <Skeleton className="h-[72px]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 m-1" />
          ))}
        </div>

        {/* Day columns skeleton */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[100px] border-r last:border-r-0">
            <Skeleton className="h-[72px]" />
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton key={j} className="h-10 m-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for WeekViewCompact
 */
function WeekViewCompactSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1 p-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center p-2 space-y-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-1 w-full" />
        </div>
      ))}
    </div>
  )
}
