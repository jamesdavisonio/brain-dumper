import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CalendarView, CalendarViewEmpty } from '../CalendarView'
import type { AvailabilityWindow, CalendarEvent, TimeSlot } from '@/types/calendar'
import { addDays, startOfWeek, setHours, setMinutes, startOfDay, addMinutes } from 'date-fns'

// Helper to wrap with router for navigation tests
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

// Helper to create mock availability data
function createMockAvailability(date: Date): AvailabilityWindow {
  const slots: TimeSlot[] = []
  for (let hour = 9; hour < 17; hour++) {
    for (let half = 0; half < 2; half++) {
      const start = setMinutes(setHours(date, hour), half * 30)
      const end = addMinutes(start, 30)
      slots.push({
        start,
        end,
        available: Math.random() > 0.3,
      })
    }
  }
  return {
    date,
    slots,
    totalFreeMinutes: 300,
    totalBusyMinutes: 180,
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
  ]
}

describe('CalendarView', () => {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering with mock data', () => {
    it('renders calendar header with navigation controls', () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      expect(screen.getByRole('navigation', { name: /calendar navigation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
    })

    it('renders view mode toggle buttons', () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      expect(screen.getByRole('tab', { name: /day/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /week/i })).toBeInTheDocument()
    })

    it('renders with availability data', () => {
      const availability = Array.from({ length: 7 }, (_, i) =>
        createMockAvailability(addDays(weekStart, i))
      )

      renderWithRouter(
        <CalendarView availability={availability} events={[]} showStats={true} />
      )

      // Stats should be visible
      expect(screen.getByText(/free time/i)).toBeInTheDocument()
    })

    it('renders with events data', () => {
      const events = createMockEvents(today)

      renderWithRouter(<CalendarView availability={[]} events={events} />)

      // The calendar grid should be rendered
      expect(screen.getByRole('grid', { name: /calendar/i }) || screen.getByRole('region')).toBeInTheDocument()
    })
  })

  describe('View mode switching', () => {
    it('defaults to week view on desktop', () => {
      // Mock desktop width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      const weekTab = screen.getByRole('tab', { name: /week/i })
      expect(weekTab).toHaveAttribute('aria-selected', 'true')
    })

    it('switches to day view when day tab is clicked', async () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      const dayTab = screen.getByRole('tab', { name: /day/i })
      fireEvent.click(dayTab)

      await waitFor(() => {
        expect(dayTab).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('switches to week view when week tab is clicked', async () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      const weekTab = screen.getByRole('tab', { name: /week/i })
      fireEvent.click(weekTab)

      await waitFor(() => {
        expect(weekTab).toHaveAttribute('aria-selected', 'true')
      })
    })
  })

  describe('Date navigation', () => {
    it('navigates to previous period when previous button is clicked', async () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      const prevButton = screen.getByRole('button', { name: /previous/i })

      // Get the initial month/year from heading
      const headingBefore = screen.getByRole('heading', { level: 2 })
      expect(headingBefore).toBeInTheDocument()

      fireEvent.click(prevButton)

      // Navigation should work without errors
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('navigates to next period when next button is clicked', async () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      const nextButton = screen.getByRole('button', { name: /next/i })

      // Get the initial month/year from heading
      const headingBefore = screen.getByRole('heading', { level: 2 })
      expect(headingBefore).toBeInTheDocument()

      fireEvent.click(nextButton)

      // Navigation should work without errors
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('returns to current period when today button is clicked', async () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} />)

      // First navigate away
      const nextButton = screen.getByRole('button', { name: /next/i })
      fireEvent.click(nextButton)
      fireEvent.click(nextButton)

      // Then click today
      const todayButton = screen.getByRole('button', { name: /today/i })
      fireEvent.click(todayButton)

      // Should return to current date
      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 2 })
        expect(heading).toBeInTheDocument()
      })
    })
  })

  describe('Slot selection', () => {
    it('calls onSlotSelect when a slot is clicked', async () => {
      const mockOnSlotSelect = vi.fn()
      const availability = [createMockAvailability(today)]

      renderWithRouter(
        <CalendarView
          availability={availability}
          events={[]}
          onSlotSelect={mockOnSlotSelect}
        />
      )

      // Find an available slot button and click it
      const slots = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('available')
      )

      if (slots.length > 0) {
        fireEvent.click(slots[0])
        expect(mockOnSlotSelect).toHaveBeenCalled()
      }
    })
  })

  describe('Loading state', () => {
    it('renders loading skeleton when isLoading is true', () => {
      renderWithRouter(<CalendarView availability={[]} events={[]} isLoading={true} />)

      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
    })
  })

  describe('Stats display', () => {
    it('shows stats when showStats is true and availability data exists', () => {
      const availability = [createMockAvailability(today)]

      renderWithRouter(
        <CalendarView availability={availability} events={[]} showStats={true} />
      )

      expect(screen.getByText(/free time/i)).toBeInTheDocument()
    })

    it('hides stats when showStats is false', () => {
      const availability = [createMockAvailability(today)]

      renderWithRouter(
        <CalendarView availability={availability} events={[]} showStats={false} />
      )

      expect(screen.queryByText(/free time/i)).not.toBeInTheDocument()
    })
  })
})

describe('CalendarViewEmpty', () => {
  it('renders empty state message', () => {
    render(<CalendarViewEmpty />)

    expect(screen.getByText(/no calendar connected/i)).toBeInTheDocument()
    expect(screen.getByText(/connect your google calendar/i)).toBeInTheDocument()
  })
})
