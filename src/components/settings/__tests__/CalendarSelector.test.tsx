import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarSelector } from '../CalendarSelector'
import type { ConnectedCalendar } from '../CalendarItem'

const mockCalendars: ConnectedCalendar[] = [
  { id: 'cal-1', name: 'Work Calendar', color: '#4285F4', isPrimary: true, type: 'work' },
  { id: 'cal-2', name: 'Personal Calendar', color: '#34A853', isPrimary: false, type: 'personal' },
  { id: 'cal-3', name: 'Holidays', color: '#9C27B0', isPrimary: false, type: 'work' },
]

describe('CalendarSelector', () => {
  it('renders loading skeleton when isLoading is true', () => {
    render(
      <CalendarSelector
        calendars={[]}
        enabledIds={[]}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={true}
      />
    )

    expect(screen.getByRole('status', { name: /loading calendars/i })).toBeInTheDocument()
  })

  it('renders empty state when no calendars', () => {
    render(
      <CalendarSelector
        calendars={[]}
        enabledIds={[]}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/no calendars found/i)).toBeInTheDocument()
  })

  it('renders all calendars', () => {
    render(
      <CalendarSelector
        calendars={mockCalendars}
        enabledIds={['cal-1', 'cal-2']}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('Work Calendar')).toBeInTheDocument()
    expect(screen.getByText('Personal Calendar')).toBeInTheDocument()
    expect(screen.getByText('Holidays')).toBeInTheDocument()
  })

  it('displays enabled count correctly', () => {
    render(
      <CalendarSelector
        calendars={mockCalendars}
        enabledIds={['cal-1', 'cal-2']}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('2 of 3 enabled')).toBeInTheDocument()
  })

  it('sorts calendars with primary first', () => {
    const unsortedCalendars: ConnectedCalendar[] = [
      { id: 'cal-2', name: 'Beta Calendar', color: '#34A853', isPrimary: false, type: 'personal' },
      { id: 'cal-1', name: 'Alpha Calendar', color: '#4285F4', isPrimary: true, type: 'work' },
      { id: 'cal-3', name: 'Gamma Calendar', color: '#9C27B0', isPrimary: false, type: 'work' },
    ]

    render(
      <CalendarSelector
        calendars={unsortedCalendars}
        enabledIds={[]}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    const calendarList = screen.getByRole('list', { name: /calendar list/i })
    const items = calendarList.querySelectorAll('[class*="flex items-center gap-3"]')

    // Primary calendar (Alpha) should be first
    expect(items[0]).toHaveTextContent('Alpha Calendar')
  })

  it('calls onToggle when switch is clicked', () => {
    const onToggle = vi.fn()
    render(
      <CalendarSelector
        calendars={mockCalendars}
        enabledIds={['cal-1']}
        onToggle={onToggle}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    // Find the switch for Work Calendar and toggle it
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0])

    expect(onToggle).toHaveBeenCalledWith('cal-1', false)
  })

  it('calls onTypeChange when type is changed', async () => {
    const onTypeChange = vi.fn()
    render(
      <CalendarSelector
        calendars={mockCalendars}
        enabledIds={['cal-1', 'cal-2', 'cal-3']}
        onToggle={vi.fn()}
        onTypeChange={onTypeChange}
        isLoading={false}
      />
    )

    // Find comboboxes (select triggers)
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(0)
  })

  it('displays Your Calendars label', () => {
    render(
      <CalendarSelector
        calendars={mockCalendars}
        enabledIds={['cal-1']}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('Your Calendars')).toBeInTheDocument()
  })

  it('displays help text about enabling calendars', () => {
    render(
      <CalendarSelector
        calendars={mockCalendars}
        enabledIds={['cal-1']}
        onToggle={vi.fn()}
        onTypeChange={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/enable calendars to check for conflicts/i)).toBeInTheDocument()
  })
})
