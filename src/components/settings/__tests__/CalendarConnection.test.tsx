import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CalendarConnection } from '../CalendarConnection'
import type { CalendarContextType } from '@/context/CalendarContext'
import type { ConnectedCalendar } from '@/types/calendar'

// Mock the useCalendar hook
const mockUseCalendar = vi.fn()
vi.mock('@/context/CalendarContext', () => ({
  useCalendar: () => mockUseCalendar(),
}))

const mockCalendars: ConnectedCalendar[] = [
  {
    id: 'cal-1',
    name: 'Work Calendar',
    color: '#4285F4',
    primary: true,
    type: 'work',
    accessRole: 'owner',
    enabled: true,
  },
  {
    id: 'cal-2',
    name: 'Personal Calendar',
    color: '#34A853',
    primary: false,
    type: 'personal',
    accessRole: 'owner',
    enabled: true,
  },
]

const createMockContext = (overrides: Partial<CalendarContextType> = {}): CalendarContextType => ({
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  calendars: [],
  isLoadingCalendars: false,
  enabledCalendarIds: [],
  connectedEmail: null,
  connectedAt: null,
  workCalendarId: null,
  personalCalendarId: null,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  refreshCalendars: vi.fn().mockResolvedValue(undefined),
  toggleCalendar: vi.fn().mockResolvedValue(undefined),
  setCalendarType: vi.fn().mockResolvedValue(undefined),
  setDefaultCalendar: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('CalendarConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation
    mockUseCalendar.mockReturnValue(createMockContext())
  })

  describe('Disconnected State', () => {
    it('renders Google Calendar title and description', () => {
      render(<CalendarConnection />)

      expect(screen.getByText('Google Calendar')).toBeInTheDocument()
      // Card description contains this text
      expect(screen.getByText(/automatically schedule tasks around your existing events/i)).toBeInTheDocument()
    })

    it('shows not connected status', () => {
      render(<CalendarConnection />)

      expect(screen.getByText('Not connected')).toBeInTheDocument()
    })

    it('renders connect button', () => {
      render(<CalendarConnection />)

      expect(screen.getByRole('button', { name: /connect with google calendar/i })).toBeInTheDocument()
    })

    it('calls connect when button is clicked', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined)
      mockUseCalendar.mockReturnValue(createMockContext({ connect: mockConnect }))

      render(<CalendarConnection />)

      const connectButton = screen.getByRole('button', { name: /connect with google calendar/i })
      fireEvent.click(connectButton)

      expect(mockConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('Connecting State', () => {
    it('shows loading state on connect button', () => {
      mockUseCalendar.mockReturnValue(createMockContext({ isConnecting: true }))

      render(<CalendarConnection />)

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connecting to google calendar/i })).toBeDisabled()
    })
  })

  describe('Connected State', () => {
    it('shows connected status with email', () => {
      mockUseCalendar.mockReturnValue(createMockContext({
        isConnected: true,
        connectedEmail: 'john@example.com',
        connectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      }))

      render(<CalendarConnection />)

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('Connected 3 days ago')).toBeInTheDocument()
    })

    it('renders calendar selector when connected', () => {
      mockUseCalendar.mockReturnValue(createMockContext({
        isConnected: true,
        calendars: mockCalendars,
        enabledCalendarIds: ['cal-1'],
      }))

      render(<CalendarConnection />)

      expect(screen.getByText('Your Calendars')).toBeInTheDocument()
      expect(screen.getByText('Work Calendar')).toBeInTheDocument()
      expect(screen.getByText('Personal Calendar')).toBeInTheDocument()
    })

    it('shows loading skeleton when loading calendars', () => {
      mockUseCalendar.mockReturnValue(createMockContext({
        isConnected: true,
        isLoadingCalendars: true,
      }))

      render(<CalendarConnection />)

      expect(screen.getByRole('status', { name: /loading calendars/i })).toBeInTheDocument()
    })

    it('renders disconnect button', () => {
      mockUseCalendar.mockReturnValue(createMockContext({ isConnected: true }))

      render(<CalendarConnection />)

      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
    })

    it('opens disconnect dialog when disconnect is clicked', () => {
      mockUseCalendar.mockReturnValue(createMockContext({ isConnected: true }))

      render(<CalendarConnection />)

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      fireEvent.click(disconnectButton)

      expect(screen.getByText('Disconnect Google Calendar?')).toBeInTheDocument()
      expect(screen.getByText(/this will remove access to your calendar/i)).toBeInTheDocument()
    })

    it('calls disconnect when confirmed in dialog', async () => {
      const mockDisconnect = vi.fn().mockResolvedValue(undefined)
      mockUseCalendar.mockReturnValue(createMockContext({
        isConnected: true,
        disconnect: mockDisconnect,
      }))

      render(<CalendarConnection />)

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
      mockUseCalendar.mockReturnValue(createMockContext({ isConnected: true }))

      render(<CalendarConnection />)

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
      mockUseCalendar.mockReturnValue(createMockContext({
        isConnected: true,
        calendars: mockCalendars,
        enabledCalendarIds: ['cal-1'],
        toggleCalendar: mockToggle,
      }))

      render(<CalendarConnection />)

      const switches = screen.getAllByRole('switch')
      fireEvent.click(switches[0])

      expect(mockToggle).toHaveBeenCalledWith('cal-1', false)
    })
  })

  describe('Error State', () => {
    it('shows error message when connectionError exists', () => {
      mockUseCalendar.mockReturnValue(createMockContext({
        connectionError: 'Failed to authenticate with Google',
      }))

      render(<CalendarConnection />)

      expect(screen.getByText('Connection failed')).toBeInTheDocument()
      expect(screen.getByText('Failed to authenticate with Google')).toBeInTheDocument()
    })

    it('shows retry button in error state', () => {
      mockUseCalendar.mockReturnValue(createMockContext({
        connectionError: 'Network error',
      }))

      render(<CalendarConnection />)

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('calls connect when retry button is clicked', () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined)
      mockUseCalendar.mockReturnValue(createMockContext({
        connectionError: 'Network error',
        connect: mockConnect,
      }))

      render(<CalendarConnection />)

      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      expect(mockConnect).toHaveBeenCalledTimes(1)
    })
  })
})
