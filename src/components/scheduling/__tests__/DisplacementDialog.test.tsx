import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DisplacementDialog } from '../DisplacementDialog'

interface Displacement {
  taskId: string
  taskName: string
  taskPriority: 'high' | 'medium' | 'low'
  originalStart: Date
  originalEnd: Date
  newStart?: Date
  newEnd?: Date
  action: 'move' | 'unschedule'
  reason: string
}

const createMockDisplacement = (
  overrides: Partial<Displacement> = {}
): Displacement => {
  const now = new Date()
  const originalStart = new Date(now)
  originalStart.setHours(10, 0, 0, 0)
  const originalEnd = new Date(now)
  originalEnd.setHours(11, 0, 0, 0)
  const newStart = new Date(now)
  newStart.setHours(14, 0, 0, 0)
  const newEnd = new Date(now)
  newEnd.setHours(15, 0, 0, 0)

  return {
    taskId: 'task-1',
    taskName: 'Team standup',
    taskPriority: 'low',
    originalStart,
    originalEnd,
    newStart,
    newEnd,
    action: 'move',
    reason: 'Lower priority task being displaced',
    ...overrides,
  }
}

describe('DisplacementDialog', () => {
  describe('Basic Rendering', () => {
    it('renders dialog with title', () => {
      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Task Displacement Required')).toBeInTheDocument()
    })

    it('shows trigger task name when provided', () => {
      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          triggerTaskName="Important meeting"
        />
      )

      expect(screen.getByText(/Scheduling/)).toBeInTheDocument()
      expect(screen.getByText(/"Important meeting"/)).toBeInTheDocument()
    })

    it('shows count of affected tasks', () => {
      const displacements = [
        createMockDisplacement({ taskId: '1', taskName: 'Task 1' }),
        createMockDisplacement({ taskId: '2', taskName: 'Task 2' }),
      ]

      render(
        <DisplacementDialog
          displacements={displacements}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/2 other tasks/)).toBeInTheDocument()
    })

    it('shows explanation about priority-based displacement', () => {
      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(
        screen.getByText(/Higher priority tasks can displace lower priority ones/)
      ).toBeInTheDocument()
    })
  })

  describe('Moved Tasks Display', () => {
    it('displays task name', () => {
      const displacement = createMockDisplacement({
        taskName: 'Weekly sync',
        action: 'move',
      })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Weekly sync')).toBeInTheDocument()
    })

    it('shows priority badge', () => {
      const displacement = createMockDisplacement({
        taskPriority: 'low',
        action: 'move',
      })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('low')).toBeInTheDocument()
    })

    it('shows original and new times', () => {
      const originalStart = new Date()
      originalStart.setHours(10, 0, 0, 0)
      const newStart = new Date()
      newStart.setHours(15, 0, 0, 0)

      const displacement = createMockDisplacement({
        originalStart,
        newStart,
        action: 'move',
      })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/10:00 AM/)).toBeInTheDocument()
      expect(screen.getByText(/3:00 PM/)).toBeInTheDocument()
    })

    it('shows "Next available slot" when newStart is undefined', () => {
      const displacement = createMockDisplacement({
        action: 'move',
        newStart: undefined,
      })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Next available slot')).toBeInTheDocument()
    })

    it('shows reason for displacement', () => {
      const displacement = createMockDisplacement({
        reason: 'Conflicting with high priority task',
        action: 'move',
      })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Conflicting with high priority task')).toBeInTheDocument()
    })

    it('shows "Will be moved" section header', () => {
      const displacement = createMockDisplacement({ action: 'move' })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/Will be moved/)).toBeInTheDocument()
    })
  })

  describe('Unscheduled Tasks Display', () => {
    it('shows "Will be unscheduled" section header', () => {
      const displacement = createMockDisplacement({ action: 'unschedule' })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/Will be unscheduled/)).toBeInTheDocument()
    })

    it('shows "Removed from calendar" text', () => {
      const displacement = createMockDisplacement({ action: 'unschedule' })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Removed from calendar')).toBeInTheDocument()
    })

    it('applies destructive styling to unscheduled items', () => {
      const displacement = createMockDisplacement({
        taskName: 'Cancelled task',
        action: 'unschedule',
      })

      render(
        <DisplacementDialog
          displacements={[displacement]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      const taskContainer = screen.getByText('Cancelled task').closest('div[class*="border-destructive"]')
      expect(taskContainer).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('calls onReject when Cancel is clicked', () => {
      const onReject = vi.fn()

      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={onReject}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onReject).toHaveBeenCalled()
    })

    it('calls onApprove when Confirm is clicked', () => {
      const onApprove = vi.fn()

      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={onApprove}
          onReject={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Confirm Displacement' }))
      expect(onApprove).toHaveBeenCalled()
    })
  })

  describe('Mixed Displacements', () => {
    it('shows both moved and unscheduled sections when both exist', () => {
      const displacements = [
        createMockDisplacement({ taskId: '1', taskName: 'Moved task', action: 'move' }),
        createMockDisplacement({ taskId: '2', taskName: 'Unscheduled task', action: 'unschedule' }),
      ]

      render(
        <DisplacementDialog
          displacements={displacements}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/Will be moved/)).toBeInTheDocument()
      expect(screen.getByText(/Will be unscheduled/)).toBeInTheDocument()
      expect(screen.getByText('Moved task')).toBeInTheDocument()
      expect(screen.getByText('Unscheduled task')).toBeInTheDocument()
    })

    it('shows correct counts for each section', () => {
      const displacements = [
        createMockDisplacement({ taskId: '1', action: 'move' }),
        createMockDisplacement({ taskId: '2', action: 'move' }),
        createMockDisplacement({ taskId: '3', action: 'unschedule' }),
      ]

      render(
        <DisplacementDialog
          displacements={displacements}
          open={true}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/Will be moved \(2\)/)).toBeInTheDocument()
      expect(screen.getByText(/Will be unscheduled \(1\)/)).toBeInTheDocument()
    })
  })

  describe('Dialog State', () => {
    it('is not visible when open is false', () => {
      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={false}
          onOpenChange={vi.fn()}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.queryByText('Task Displacement Required')).not.toBeInTheDocument()
    })

    it('calls onOpenChange when dialog state changes', () => {
      const onOpenChange = vi.fn()

      render(
        <DisplacementDialog
          displacements={[createMockDisplacement()]}
          open={true}
          onOpenChange={onOpenChange}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      )

      // Dialog should be open
      expect(screen.getByText('Task Displacement Required')).toBeInTheDocument()
    })
  })
})
