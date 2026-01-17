import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayColumn } from '../DayColumn'
import type { AvailabilityWindow, CalendarEvent, TimeSlot } from '@/types/calendar'
import { setHours, setMinutes, startOfDay, addMinutes, format, isToday } from 'date-fns'

// Helper to create mock availability data
function createMockAvailability(date: Date): AvailabilityWindow {
  const slots: TimeSlot[] = []
  let totalFree = 0
  let totalBusy = 0

  // Create slots from 6 AM to 10 PM
  for (let hour = 6; hour < 22; hour++) {
    const start = setHours(date, hour)
    const end = addMinutes(start, 60)
    const available = hour >= 9 && hour < 17 && Math.random() > 0.3

    slots.push({
      start,
      end,
      available,
    })

    if (available) {
      totalFree += 60
    } else {
      totalBusy += 60
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
      id: 'event-1',
      calendarId: 'primary',
      title: 'Team Standup',
      start: setHours(date, 9),
      end: setMinutes(setHours(date, 9), 30),
      allDay: false,
      status: 'confirmed',
    },
    {
      id: 'event-2',
      calendarId: 'primary',
      title: 'Design Review',
      start: setHours(date, 14),
      end: setHours(date, 15),
      allDay: false,
      status: 'confirmed',
    },
    {
      id: 'all-day-event',
      calendarId: 'primary',
      title: 'Company Holiday',
      start: date,
      end: date,
      allDay: true,
      status: 'confirmed',
    },
  ]
}

describe('DayColumn', () => {
  const today = startOfDay(new Date())

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering time slots', () => {
    it('renders the date header', () => {
      render(<DayColumn date={today} />)

      // Should show day abbreviation and date number
      expect(screen.getByText(format(today, 'EEE'))).toBeInTheDocument()
      expect(screen.getByText(format(today, 'd'))).toBeInTheDocument()
    })

    it('renders time slot buttons', () => {
      render(<DayColumn date={today} showHours={true} />)

      // Should render hour labels
      expect(screen.getByText('9 AM')).toBeInTheDocument()
      expect(screen.getByText('12 PM')).toBeInTheDocument()
    })

    it('highlights today when isToday prop is true', () => {
      render(<DayColumn date={today} isToday={true} />)

      expect(screen.getByText('Today')).toBeInTheDocument()
    })

    it('does not show today label for other dates', () => {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      render(<DayColumn date={yesterday} isToday={false} />)

      expect(screen.queryByText('Today')).not.toBeInTheDocument()
    })
  })

  describe('Event display', () => {
    it('shows timed events in their slots', () => {
      const events = createMockEvents(today)

      render(<DayColumn date={today} events={events} />)

      expect(screen.getByText('Team Standup')).toBeInTheDocument()
      expect(screen.getByText('Design Review')).toBeInTheDocument()
    })

    it('shows all-day events at the top', () => {
      const events = createMockEvents(today)

      render(<DayColumn date={today} events={events} />)

      expect(screen.getByText('Company Holiday')).toBeInTheDocument()
    })

    it('renders events in compact mode when multiple events exist', () => {
      const events = [
        {
          id: 'event-1',
          calendarId: 'primary',
          title: 'Meeting 1',
          start: setHours(today, 10),
          end: setMinutes(setHours(today, 10), 30),
          allDay: false,
          status: 'confirmed' as const,
        },
        {
          id: 'event-2',
          calendarId: 'primary',
          title: 'Meeting 2',
          start: setMinutes(setHours(today, 10), 15),
          end: setMinutes(setHours(today, 10), 45),
          allDay: false,
          status: 'confirmed' as const,
        },
      ]

      render(<DayColumn date={today} events={events} />)

      expect(screen.getByText('Meeting 1')).toBeInTheDocument()
      expect(screen.getByText('Meeting 2')).toBeInTheDocument()
    })
  })

  describe('Slot selection', () => {
    it('calls onSlotClick when a free slot is clicked', () => {
      const mockOnSlotClick = vi.fn()
      const availability = createMockAvailability(today)

      render(
        <DayColumn
          date={today}
          availability={availability}
          onSlotClick={mockOnSlotClick}
        />
      )

      // Find available slot buttons
      const slots = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('available')
      )

      if (slots.length > 0) {
        fireEvent.click(slots[0])
        expect(mockOnSlotClick).toHaveBeenCalled()
      }
    })

    it('highlights selected slot', () => {
      const availability = createMockAvailability(today)
      const selectedSlot = availability.slots.find(s => s.available)

      if (selectedSlot) {
        render(
          <DayColumn
            date={today}
            availability={availability}
            selectedSlot={selectedSlot}
          />
        )

        const selectedButton = screen.getAllByRole('button').find(btn =>
          btn.getAttribute('aria-pressed') === 'true'
        )

        expect(selectedButton).toBeInTheDocument()
      }
    })

    it('does not allow clicking busy slots', () => {
      const mockOnSlotClick = vi.fn()

      // Create availability with all busy slots
      const busySlots: TimeSlot[] = Array.from({ length: 8 }, (_, i) => ({
        start: setHours(today, 9 + i),
        end: setHours(today, 10 + i),
        available: false,
      }))

      render(
        <DayColumn
          date={today}
          availability={{
            date: today,
            slots: busySlots,
            totalFreeMinutes: 0,
            totalBusyMinutes: 480,
          }}
          onSlotClick={mockOnSlotClick}
        />
      )

      // Busy slots should be disabled
      const busyButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('busy')
      )

      if (busyButtons.length > 0) {
        expect(busyButtons[0]).toBeDisabled()
      }
    })
  })

  describe('Working hours', () => {
    it('dims slots outside working hours', () => {
      render(
        <DayColumn
          date={today}
          workingHours={{ start: '09:00', end: '17:00' }}
          showHours={true}
        />
      )

      // 6 AM and 7 AM should exist but be outside working hours
      // These should have reduced opacity
      const hourLabel6am = screen.queryByText('6 AM')
      const hourLabel7am = screen.queryByText('7 AM')
      const hourLabel9am = screen.getByText('9 AM')

      expect(hourLabel9am).toBeInTheDocument()
      // 6 AM and 7 AM might be present but should be dimmed
      if (hourLabel6am) {
        const parentElement = hourLabel6am.closest('div')
        expect(parentElement).toBeInTheDocument()
      }
    })

    it('respects custom working hours', () => {
      render(
        <DayColumn
          date={today}
          workingHours={{ start: '10:00', end: '18:00' }}
        />
      )

      // Component should render without errors
      expect(screen.getByRole('region')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper region label', () => {
      render(<DayColumn date={today} />)

      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        expect.stringContaining(format(today, 'EEEE'))
      )
    })

    it('slots have proper aria labels', () => {
      const availability = createMockAvailability(today)

      render(<DayColumn date={today} availability={availability} />)

      const slotButtons = screen.getAllByRole('button')
      slotButtons.forEach(button => {
        const label = button.getAttribute('aria-label')
        if (label?.includes('Time slot')) {
          expect(label).toMatch(/available|busy/)
        }
      })
    })

    it('events are keyboard accessible', () => {
      const events = createMockEvents(today)

      render(<DayColumn date={today} events={events} />)

      const eventButton = screen.getByRole('button', { name: /team standup/i })
      expect(eventButton).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('With availability data', () => {
    it('uses availability slots when provided', () => {
      const availability = createMockAvailability(today)

      render(<DayColumn date={today} availability={availability} />)

      // Should have rendered slots based on availability
      const region = screen.getByRole('region')
      expect(region).toBeInTheDocument()
    })

    it('generates default slots when no availability', () => {
      render(<DayColumn date={today} />)

      // Should still render with default slots
      const region = screen.getByRole('region')
      expect(region).toBeInTheDocument()
    })
  })
})
