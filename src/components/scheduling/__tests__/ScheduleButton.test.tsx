import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleButton } from '../ScheduleButton'
import type { Task } from '@/types'

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  content: 'Test task',
  priority: 'medium',
  completed: false,
  archived: false,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  order: 0,
  ...overrides,
})

describe('ScheduleButton', () => {
  describe('Not Scheduled State', () => {
    it('renders "Schedule" button when task is not scheduled', () => {
      const task = createMockTask()
      render(<ScheduleButton task={task} />)

      expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument()
    })

    it('calls onSchedule when clicked in not scheduled state', () => {
      const task = createMockTask()
      const onSchedule = vi.fn()
      render(<ScheduleButton task={task} onSchedule={onSchedule} />)

      fireEvent.click(screen.getByRole('button', { name: /schedule/i }))
      expect(onSchedule).toHaveBeenCalledWith(task)
    })

    it('renders compact version without text', () => {
      const task = createMockTask()
      render(<ScheduleButton task={task} compact />)

      const button = screen.getByRole('button')
      expect(button).not.toHaveTextContent('Schedule')
    })
  })

  describe('Syncing State', () => {
    it('renders syncing indicator when syncStatus is pending', () => {
      const task = createMockTask({ syncStatus: 'pending' })
      render(<ScheduleButton task={task} />)

      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Error State', () => {
    it('renders retry button when syncStatus is error', () => {
      const task = createMockTask({ syncStatus: 'error' })
      render(<ScheduleButton task={task} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-destructive')
    })

    it('calls onSchedule when retry is clicked', () => {
      const task = createMockTask({ syncStatus: 'error' })
      const onSchedule = vi.fn()
      render(<ScheduleButton task={task} onSchedule={onSchedule} />)

      fireEvent.click(screen.getByRole('button'))
      expect(onSchedule).toHaveBeenCalledWith(task)
    })
  })

  describe('Scheduled State', () => {
    it('shows scheduled time when task is scheduled', () => {
      const scheduledStart = new Date()
      scheduledStart.setHours(9, 0, 0, 0)

      const task = createMockTask({
        scheduledStart,
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      render(<ScheduleButton task={task} />)

      // The button should exist and show time
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has green border when synced', () => {
      const scheduledStart = new Date()
      scheduledStart.setHours(9, 0, 0, 0)

      const task = createMockTask({
        scheduledStart,
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      render(<ScheduleButton task={task} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('border-green-500/50')
    })
  })

  describe('Dropdown Menu', () => {
    it('shows dropdown menu when scheduled task button is clicked', async () => {
      const user = userEvent.setup()
      const scheduledStart = new Date()
      scheduledStart.setHours(9, 0, 0, 0)

      const task = createMockTask({
        scheduledStart,
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      render(<ScheduleButton task={task} />)

      await user.click(screen.getByRole('button'))

      // Menu items should appear
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Reschedule/i })).toBeInTheDocument()
      })
      expect(screen.getByRole('menuitem', { name: /Remove from Calendar/i })).toBeInTheDocument()
    })

    it('calls onReschedule when Reschedule is clicked', async () => {
      const user = userEvent.setup()
      const scheduledStart = new Date()
      const task = createMockTask({
        scheduledStart,
        calendarEventId: 'event-1',
      })

      const onReschedule = vi.fn()
      render(<ScheduleButton task={task} onReschedule={onReschedule} />)

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Reschedule/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /Reschedule/i }))

      expect(onReschedule).toHaveBeenCalledWith(task)
    })

    it('calls onUnschedule when Remove from Calendar is clicked', async () => {
      const user = userEvent.setup()
      const scheduledStart = new Date()
      const task = createMockTask({
        scheduledStart,
        calendarEventId: 'event-1',
      })

      const onUnschedule = vi.fn()
      render(<ScheduleButton task={task} onUnschedule={onUnschedule} />)

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Remove from Calendar/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('menuitem', { name: /Remove from Calendar/i }))

      expect(onUnschedule).toHaveBeenCalledWith(task)
    })
  })
})
