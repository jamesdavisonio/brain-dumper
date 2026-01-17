import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CalendarConnection, type CalendarContextType } from '../CalendarConnection'
import type { ConnectedCalendar } from '../CalendarItem'

const mockCalendars: ConnectedCalendar[] = [
  { id: 'cal-1', name: 'Work Calendar', color: '#4285F4', isPrimary: true, type: 'work' },
  { id: 'cal-2', name: 'Personal Calendar', color: '#34A853', isPrimary: false, type: 'personal' },
]

const createMockContext = (overrides: Partial<CalendarContextType> = {}): CalendarContextType => ({
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  calendars: [],
  isLoadingCalendars: false,
  enabledCalendarIds: [],
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  toggleCalendar: vi.fn().mockResolvedValue(undefined),
  setCalendarType: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('CalendarConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Disconnected State', () => {
    it('renders Google Calendar title and description', () => {
      render(<CalendarConnection context={createMockContext()} />)

      expect(screen.getByText('Google Calendar')).toBeInTheDocument()
      // Card description contains this text
      expect(screen.getByText(/automatically schedule tasks around your existing events/i)).toBeInTheDocument()
    })

    it('shows not connected status', () => {
      render(<CalendarConnection context={createMockContext()} />)

      expect(screen.getByText('Not connected')).toBeInTheDocument()
    })

    it('renders connect button', () => {
      render(<CalendarConnection context={createMockContext()} />)

      expect(screen.getByRole('button', { name: /connect with google calendar/i })).toBeInTheDocument()
    })

    it('calls connect when button is clicked', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined)
      render(
        <CalendarConnection
          context={createMockContext({ connect: mockConnect })}
        />
      )

      const connectButton = screen.getByRole('button', { name: /connect with google calendar/i })
      fireEvent.click(connectButton)

      expect(mockConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('Connecting State', () => {
    it('shows loading state on connect button', () => {
      render(
        <CalendarConnection
          context={createMockContext({ isConnecting: true })}
        />
      )

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connecting to google calendar/i })).toBeDisabled()
    })
  })

  describe('Connected State', () => {
    it('shows connected status with email', () => {
      render(
        <CalendarConnection
          context={createMockContext({
            isConnected: true,
            connectedEmail: 'john@example.com',
            connectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          })}
        />
      )

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('Connected 3 days ago')).toBeInTheDocument()
    })

    it('renders calendar selector when connected', () => {
      render(
        <CalendarConnection
          context={createMockContext({
            isConnected: true,
            calendars: mockCalendars,
            enabledCalendarIds: ['cal-1'],
          })}
        />
      )

      expect(screen.getByText('Your Calendars')).toBeInTheDocument()
      expect(screen.getByText('Work Calendar')).toBeInTheDocument()
      expect(screen.getByText('Personal Calendar')).toBeInTheDocument()
    })

    it('shows loading skeleton when loading calendars', () => {
      render(
        <CalendarConnection
          context={createMockContext({
            isConnected: true,
            isLoadingCalendars: true,
          })}
        />
      )

      expect(screen.getByRole('status', { name: /loading calendars/i })).toBeInTheDocument()
    })

    it('renders disconnect button', () => {
      render(
        <CalendarConnection
          context={createMockContext({ isConnected: true })}
        />
      )

      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
    })

    it('opens disconnect dialog when disconnect is clicked', () => {
      render(
        <CalendarConnection
          context={createMockContext({ isConnected: true })}
        />
      )

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      fireEvent.click(disconnectButton)

      expect(screen.getByText('Disconnect Google Calendar?')).toBeInTheDocument()
      expect(screen.getByText(/this will remove access to your calendar/i)).toBeInTheDocument()
    })

    it('calls disconnect when confirmed in dialog', async () => {
      const mockDisconnect = vi.fn().mockResolvedValue(undefined)
      render(
        <CalendarConnection
          context={createMockContext({
            isConnected: true,
            disconnect: mockDisconnect,
          })}
        />
      )

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))

      // Confirm disconnect
      const confirmButton = screen.getByRole('button', { name: /^disconnect$/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledTimes(1)
      })
    })

    it('closes dialog when cancel is clicked', async () => {
      render(
        <CalendarConnection
          context={createMockContext({ isConnected: true })}
        />
      )

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
      expect(screen.getByText('Disconnect Google Calendar?')).toBeInTheDocument()

      // Click cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByText('Disconnect Google Calendar?')).not.toBeInTheDocument()
      })
    })

    it('calls toggleCalendar when calendar is toggled', async () => {
      const mockToggle = vi.fn().mockResolvedValue(undefined)
      render(
        <CalendarConnection
          context={createMockContext({
            isConnected: true,
            calendars: mockCalendars,
            enabledCalendarIds: ['cal-1'],
            toggleCalendar: mockToggle,
          })}
        />
      )

      const switches = screen.getAllByRole('switch')
      fireEvent.click(switches[0])

      expect(mockToggle).toHaveBeenCalledWith('cal-1', false)
    })
  })

  describe('Error State', () => {
    it('shows error message when connectionError exists', () => {
      render(
        <CalendarConnection
          context={createMockContext({
            connectionError: 'Failed to authenticate with Google',
          })}
        />
      )

      expect(screen.getByText('Connection failed')).toBeInTheDocument()
      expect(screen.getByText('Failed to authenticate with Google')).toBeInTheDocument()
    })

    it('shows retry button in error state', () => {
      render(
        <CalendarConnection
          context={createMockContext({
            connectionError: 'Network error',
          })}
        />
      )

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('calls connect when retry button is clicked', () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined)
      render(
        <CalendarConnection
          context={createMockContext({
            connectionError: 'Network error',
            connect: mockConnect,
          })}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      expect(mockConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('Context Integration', () => {
    it('uses context from useCalendarContext hook when provided', () => {
      const mockContext = createMockContext({
        isConnected: true,
        connectedEmail: 'hook@example.com',
      })
      const useCalendarContext = vi.fn().mockReturnValue(mockContext)

      render(<CalendarConnection useCalendarContext={useCalendarContext} />)

      expect(useCalendarContext).toHaveBeenCalled()
      expect(screen.getByText('hook@example.com')).toBeInTheDocument()
    })

    it('prefers useCalendarContext over context prop', () => {
      const contextProp = createMockContext({
        isConnected: true,
        connectedEmail: 'prop@example.com',
      })
      const hookContext = createMockContext({
        isConnected: true,
        connectedEmail: 'hook@example.com',
      })
      const useCalendarContext = vi.fn().mockReturnValue(hookContext)

      render(
        <CalendarConnection
          context={contextProp}
          useCalendarContext={useCalendarContext}
        />
      )

      expect(screen.getByText('hook@example.com')).toBeInTheDocument()
      expect(screen.queryByText('prop@example.com')).not.toBeInTheDocument()
    })
  })
})
