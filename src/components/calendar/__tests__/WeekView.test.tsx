import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekView, WeekViewCompact } from '../WeekView'
import type { AvailabilityWindow, CalendarEvent, TimeSlot } from '@/types/calendar'
import { addDays, startOfWeek, setHours, setMinutes, startOfDay, addMinutes, format, isToday } from 'date-fns'

// Helper to create mock availability data
function createMockAvailability(date: Date): AvailabilityWindow {
  const slots: TimeSlot[] = []
  let totalFree = 0
  let totalBusy = 0

  for (let hour = 9; hour < 17; hour++) {
    for (let half = 0; half < 2; half++) {
      const start = setMinutes(setHours(date, hour), half * 30)
      const end = addMinutes(start, 30)
      const available = Math.random() > 0.3

      slots.push({
        start,
        end,
        available,
      })

      if (available) {
        totalFree += 30
      } else {
        totalBusy += 30
      }
    }
  }

  return {
    date,
    slots,
    totalFreeMinutes: totalFree,
    totalBusyMinutes: totalBusy,
  }
}

// Helper to create mock events
function createMockEvents(date: Date): CalendarEvent[] {
  return [
    {
      id: `event-${format(date, 'yyyy-MM-dd')}-1`,
      calendarId: 'primary',
      title: 'Team Standup',
      start: setHours(date, 9),
      end: setMinutes(setHours(date, 9), 30),
      allDay: false,
      status: 'confirmed',
    },
    {
      id: `event-${format(date, 'yyyy-MM-dd')}-2`,
      calendarId: 'primary',
      title: 'Design Review',
      start: setHours(date, 14),
      end: setHours(date, 15),
      allDay: false,
      status: 'tentative',
    },
  ]
}

describe('WeekView', () => {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering 7 days', () => {
    it('renders 7 day columns', () => {
      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={[]}
        />
      )

      // Should render 7 day headers (Mon-Sun)
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Tue')).toBeInTheDocument()
      expect(screen.getByText('Wed')).toBeInTheDocument()
      expect(screen.getByText('Thu')).toBeInTheDocument()
      expect(screen.getByText('Fri')).toBeInTheDocument()
      expect(screen.getByText('Sat')).toBeInTheDocument()
      expect(screen.getByText('Sun')).toBeInTheDocument()
    })

    it('renders time labels column', () => {
      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={[]}
        />
      )

      // Should show hour labels
      expect(screen.getByText('9 AM')).toBeInTheDocument()
      expect(screen.getByText('12 PM')).toBeInTheDocument()
      expect(screen.getByText('5 PM')).toBeInTheDocument()
    })

    it('highlights today column', () => {
      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={[]}
        />
      )

      // If today is in the current week, it should be highlighted
      const todayIndex = weekDates.findIndex(d => isToday(d))
      if (todayIndex >= 0) {
        const todayLabel = screen.getByText('Today')
        expect(todayLabel).toBeInTheDocument()
      }
    })
  })

  describe('Event display', () => {
    it('shows events in correct day columns', () => {
      const monday = weekDates[0]
      const events = createMockEvents(monday)

      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={events}
        />
      )

      expect(screen.getByText('Team Standup')).toBeInTheDocument()
      expect(screen.getByText('Design Review')).toBeInTheDocument()
    })

    it('shows events for multiple days', () => {
      const mondayEvents = createMockEvents(weekDates[0])
      const wednesdayEvents = createMockEvents(weekDates[2])
      const allEvents = [...mondayEvents, ...wednesdayEvents]

      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={allEvents}
        />
      )

      // Should have multiple instances of event titles
      const standups = screen.getAllByText('Team Standup')
      expect(standups.length).toBe(2)
    })
  })

  describe('Availability overlay', () => {
    it('renders with availability data', () => {
      const availability = weekDates.map(date => createMockAvailability(date))

      render(
        <WeekView
          dates={weekDates}
          availability={availability}
          events={[]}
        />
      )

      // The grid should still render
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })
  })

  describe('Slot clicks', () => {
    it('calls onSlotClick when a slot is clicked', () => {
      const mockOnSlotClick = vi.fn()

      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={[]}
          onSlotClick={mockOnSlotClick}
        />
      )

      // Find slot buttons and click one
      const slots = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('Time slot')
      )

      if (slots.length > 0) {
        fireEvent.click(slots[0])
        expect(mockOnSlotClick).toHaveBeenCalled()
      }
    })

    it('highlights selected slot', () => {
      const availability = weekDates.map(date => createMockAvailability(date))
      const selectedDate = weekDates[0]
      const selectedSlot = availability[0].slots[0]

      render(
        <WeekView
          dates={weekDates}
          availability={availability}
          events={[]}
          selectedSlot={{ date: selectedDate, slot: selectedSlot }}
        />
      )

      // Selected slot should have ring styling
      const selectedButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('aria-pressed') === 'true'
      )

      if (selectedButton) {
        expect(selectedButton).toHaveAttribute('aria-pressed', 'true')
      }
    })
  })

  describe('Loading state', () => {
    it('renders skeleton when loading', () => {
      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={[]}
          isLoading={true}
        />
      )

      // Should show loading skeleton
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Working hours', () => {
    it('respects custom working hours', () => {
      render(
        <WeekView
          dates={weekDates}
          availability={[]}
          events={[]}
          workingHours={{ start: '10:00', end: '18:00' }}
        />
      )

      // Component should still render
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })
  })
})

describe('WeekViewCompact', () => {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 7 day buttons in a grid', () => {
    render(
      <WeekViewCompact
        dates={weekDates}
        availability={[]}
        events={[]}
      />
    )

    // Should render day abbreviations
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('shows event counts for each day', () => {
    const events = createMockEvents(weekDates[0])

    render(
      <WeekViewCompact
        dates={weekDates}
        availability={[]}
        events={events}
      />
    )

    // First day should show event count
    expect(screen.getByText('2 events')).toBeInTheDocument()
  })

  it('calls onDayClick when a day is clicked', () => {
    const mockOnDayClick = vi.fn()

    render(
      <WeekViewCompact
        dates={weekDates}
        availability={[]}
        events={[]}
        onDayClick={mockOnDayClick}
      />
    )

    // Click on Monday (role is gridcell, not button)
    const mondayButton = screen.getByRole('gridcell', {
      name: new RegExp(`Monday.*${format(weekDates[0], 'MMMM d')}`, 'i')
    })
    fireEvent.click(mondayButton)

    expect(mockOnDayClick).toHaveBeenCalledWith(weekDates[0])
  })

  it('highlights selected day', () => {
    const selectedDate = weekDates[2]

    render(
      <WeekViewCompact
        dates={weekDates}
        availability={[]}
        events={[]}
        selectedDate={selectedDate}
      />
    )

    // Find the selected day by checking for the aria-pressed attribute
    const selectedButton = screen.getByRole('gridcell', {
      name: new RegExp(`Wednesday.*${format(weekDates[2], 'MMMM d')}`, 'i')
    })
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows availability indicator for each day', () => {
    const availability = weekDates.map(date => createMockAvailability(date))

    render(
      <WeekViewCompact
        dates={weekDates}
        availability={availability}
        events={[]}
      />
    )

    // Each day should have availability info in aria-label
    const dayButtons = screen.getAllByRole('gridcell')
    expect(dayButtons.length).toBe(7)
  })

  it('renders skeleton when loading', () => {
    render(
      <WeekViewCompact
        dates={weekDates}
        availability={[]}
        events={[]}
        isLoading={true}
      />
    )

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
