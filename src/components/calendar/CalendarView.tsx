import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow, CalendarEvent, TimeSlot as TimeSlotType } from '@/types/calendar'
import { CalendarHeader } from './CalendarHeader'
import { WeekView, WeekViewCompact } from './WeekView'
import { DayView } from './DayView'
import { CalendarStats } from './CalendarStats'
import { CalendarSkeleton } from './CalendarSkeleton'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  isSameDay,
  startOfDay,
  format
} from 'date-fns'

export interface CalendarViewProps {
  // Optional: provide data externally for testing
  availability?: AvailabilityWindow[]
  events?: CalendarEvent[]

  // Slot selection callback
  onSlotSelect?: (date: Date, slot: TimeSlotType) => void

  // Calendar filtering
  enabledCalendarIds?: string[]

  // Working hours configuration
  workingHours?: { start: string; end: string }

  // Loading state (if not using hooks)
  isLoading?: boolean

  // Show stats section
  showStats?: boolean
}

/**
 * Main Calendar View component
 *
 * This component:
 * 1. Manages date range navigation
 * 2. Renders CalendarHeader + WeekView/DayView
 * 3. Handles responsive layout (week on desktop, day on mobile)
 * 4. Accepts availability and events via props
 */
export function CalendarView({
  availability = [],
  events = [],
  onSlotSelect,
  enabledCalendarIds,
  workingHours = { start: '09:00', end: '17:00' },
  isLoading = false,
  showStats = true,
}: CalendarViewProps) {
  // View mode: 'day' for mobile, 'week' for desktop
  const [viewMode, setViewMode] = useState<'day' | 'week'>(() => {
    // Default to day view on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'day'
    }
    return 'week'
  })

  // Current date being viewed
  const [currentDate, setCurrentDate] = useState<Date>(() => startOfDay(new Date()))

  // Track selected slot
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; slot: TimeSlotType } | null>(null)

  // Handle responsive view mode
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768
      setViewMode(isMobile ? 'day' : 'week')
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), // Start on Monday
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      }
    }
    // Day view - just the current date
    return {
      start: currentDate,
      end: currentDate,
    }
  }, [currentDate, viewMode])

  // Generate dates array for week view
  const weekDates = useMemo(() => {
    if (viewMode !== 'week') return []
    const dates: Date[] = []
    let current = dateRange.start
    while (current <= dateRange.end) {
      dates.push(current)
      current = addDays(current, 1)
    }
    return dates
  }, [viewMode, dateRange])

  // Filter events by enabled calendars
  const filteredEvents = useMemo(() => {
    if (!enabledCalendarIds || enabledCalendarIds.length === 0) {
      return events
    }
    return events.filter(e => enabledCalendarIds.includes(e.calendarId))
  }, [events, enabledCalendarIds])

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, -1))
    } else {
      setCurrentDate(prev => addDays(prev, -1))
    }
    setSelectedSlot(null)
  }, [viewMode])

  const handleNext = useCallback(() => {
    if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1))
    } else {
      setCurrentDate(prev => addDays(prev, 1))
    }
    setSelectedSlot(null)
  }, [viewMode])

  const handleToday = useCallback(() => {
    setCurrentDate(startOfDay(new Date()))
    setSelectedSlot(null)
  }, [])

  const handleViewModeChange = useCallback((mode: 'day' | 'week') => {
    setViewMode(mode)
    setSelectedSlot(null)
  }, [])

  // Slot selection handler
  const handleSlotClick = useCallback((date: Date, slot: TimeSlotType) => {
    setSelectedSlot({ date, slot })
    if (onSlotSelect) {
      onSlotSelect(date, slot)
    }
  }, [onSlotSelect])

  // Get availability for the current date (for day view)
  const currentDayAvailability = useMemo(() => {
    return availability.find(a => isSameDay(a.date, currentDate))
  }, [availability, currentDate])

  // Get events for the current date (for day view)
  const currentDayEvents = useMemo(() => {
    return filteredEvents.filter(e =>
      isSameDay(e.start, currentDate) || isSameDay(e.end, currentDate)
    )
  }, [filteredEvents, currentDate])

  if (isLoading) {
    return <CalendarSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Calendar header with navigation */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onViewModeChange={handleViewModeChange}
        isLoading={isLoading}
      />

      {/* Stats section */}
      {showStats && availability.length > 0 && (
        <CalendarStats
          availability={availability}
          dateRange={dateRange}
          isLoading={isLoading}
        />
      )}

      {/* Calendar view */}
      <div
        role="tabpanel"
        id={`${viewMode}-view-panel`}
        aria-label={`${viewMode} view`}
      >
        {viewMode === 'week' ? (
          <WeekView
            dates={weekDates}
            availability={availability}
            events={filteredEvents}
            workingHours={workingHours}
            onSlotClick={handleSlotClick}
            selectedSlot={selectedSlot || undefined}
            isLoading={isLoading}
          />
        ) : (
          <DayView
            date={currentDate}
            availability={currentDayAvailability}
            events={currentDayEvents}
            workingHours={workingHours}
            onSlotClick={(slot) => handleSlotClick(currentDate, slot)}
            selectedSlot={selectedSlot?.slot}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Mobile week overview (when in day view on mobile) */}
      {viewMode === 'day' && (
        <div className="md:hidden">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            This Week
          </h3>
          <WeekViewCompact
            dates={Array.from({ length: 7 }, (_, i) =>
              addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)
            )}
            availability={availability}
            events={filteredEvents}
            onDayClick={(date) => setCurrentDate(date)}
            selectedDate={currentDate}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Selected slot info (if any) */}
      {selectedSlot && (
        <SelectedSlotInfo
          date={selectedSlot.date}
          slot={selectedSlot.slot}
          onClear={() => setSelectedSlot(null)}
        />
      )}
    </div>
  )
}

/**
 * Display info about the selected time slot
 */
interface SelectedSlotInfoProps {
  date: Date
  slot: TimeSlotType
  onClear: () => void
}

function SelectedSlotInfo({ date, slot, onClear }: SelectedSlotInfoProps) {
  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">
              {format(date, 'EEEE, MMMM d')}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(slot.start, 'h:mm a')} - {format(slot.end, 'h:mm a')}
            </p>
            <p className={cn(
              'text-xs mt-1',
              slot.available ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              {slot.available ? 'Available' : 'Busy'}
            </p>
          </div>
          <button
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state when no calendar is connected
 */
export function CalendarViewEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">No Calendar Connected</h3>
      <p className="text-muted-foreground max-w-sm">
        Connect your Google Calendar to see your availability and schedule tasks during free time slots.
      </p>
    </div>
  )
}
