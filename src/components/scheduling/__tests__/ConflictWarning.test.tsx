import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictWarning } from '../ConflictWarning'
import type { Conflict } from '@/types'

interface Displacement {
  taskId: string
  taskName: string
  originalStart: Date
  originalEnd: Date
  newStart?: Date
  newEnd?: Date
  action: 'move' | 'unschedule'
  reason: string
}

const createMockConflict = (
  overrides: Partial<Conflict> = {}
): Conflict => ({
  type: 'overlap',
  description: 'Overlaps with existing meeting',
  severity: 'warning',
  ...overrides,
})

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
    originalStart,
    originalEnd,
    newStart,
    newEnd,
    action: 'move',
    reason: 'Lower priority task',
    ...overrides,
  }
}

describe('ConflictWarning', () => {
  describe('Basic Rendering', () => {
    it('renders alert dialog with warning title', () => {
      render(
        <ConflictWarning
          conflicts={[createMockConflict()]}
          displacements={[createMockDisplacement()]}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Scheduling Conflicts')).toBeInTheDocument()
    })

    it('shows explanation text', () => {
      render(
        <ConflictWarning
          conflicts={[]}
          displacements={[createMockDisplacement()]}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(
        screen.getByText(/Scheduling this task will affect other tasks/)
      ).toBeInTheDocument()
    })
  })

  describe('Conflicts Display', () => {
    it('renders conflict list', () => {
      const conflicts = [
        createMockConflict({ description: 'Overlaps with team meeting' }),
        createMockConflict({ description: 'Outside working hours' }),
      ]

      render(
        <ConflictWarning
          conflicts={conflicts}
          displacements={[]}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Overlaps with team meeting')).toBeInTheDocument()
      expect(screen.getByText('Outside working hours')).toBeInTheDocument()
    })

    it('shows correct icon for error severity', () => {
      const conflicts = [
        createMockConflict({ severity: 'error', description: 'Critical conflict' }),
      ]

      render(
        <ConflictWarning
          conflicts={conflicts}
          displacements={[]}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      // Error conflicts should have destructive styling
      const conflictItem = screen.getByText('Critical conflict').closest('div')
      expect(conflictItem).toHaveClass('bg-destructive/10')
    })
  })

  describe('Displacements Display', () => {
    it('shows count of affected tasks', () => {
      const displacements = [
        createMockDisplacement({ taskName: 'Task 1' }),
        createMockDisplacement({ taskId: 'task-2', taskName: 'Task 2' }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/2 other tasks/)).toBeInTheDocument()
    })

    it('displays task that will be moved', () => {
      const displacements = [
        createMockDisplacement({
          taskName: 'Team standup',
          action: 'move',
        }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Team standup')).toBeInTheDocument()
    })

    it('displays task that will be unscheduled', () => {
      const displacements = [
        createMockDisplacement({
          taskName: 'Email review',
          action: 'unschedule',
        }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Email review')).toBeInTheDocument()
      expect(screen.getByText('Will be unscheduled')).toBeInTheDocument()
    })

    it('shows original and new times for moved tasks', () => {
      const now = new Date()
      const originalStart = new Date(now)
      originalStart.setHours(10, 0, 0, 0)
      const newStart = new Date(now)
      newStart.setHours(14, 0, 0, 0)

      const displacements = [
        createMockDisplacement({
          originalStart,
          newStart,
          action: 'move',
        }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText(/10:00 AM/)).toBeInTheDocument()
      expect(screen.getByText(/2:00 PM/)).toBeInTheDocument()
    })

    it('shows reason for displacement', () => {
      const displacements = [
        createMockDisplacement({
          reason: 'Lower priority task',
        }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Lower priority task')).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('calls onReject when "Keep Existing" is clicked', () => {
      const onReject = vi.fn()

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={[createMockDisplacement()]}
          onApproveDisplacements={vi.fn()}
          onReject={onReject}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Keep Existing' }))
      expect(onReject).toHaveBeenCalled()
    })

    it('calls onApproveDisplacements when "Move Lower Priority" is clicked', () => {
      const onApprove = vi.fn()

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={[createMockDisplacement()]}
          onApproveDisplacements={onApprove}
          onReject={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Move Lower Priority' }))
      expect(onApprove).toHaveBeenCalled()
    })
  })

  describe('Styling', () => {
    it('applies warning styling to moved tasks', () => {
      const displacements = [
        createMockDisplacement({ action: 'move' }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      // Should show the task that will be moved (moved tasks show the new time, not "Will be moved" text)
      expect(screen.getByText('Team standup')).toBeInTheDocument()
    })

    it('applies destructive styling to unscheduled tasks', () => {
      const displacements = [
        createMockDisplacement({ action: 'unschedule' }),
      ]

      render(
        <ConflictWarning
          conflicts={[]}
          displacements={displacements}
          onApproveDisplacements={vi.fn()}
          onReject={vi.fn()}
        />
      )

      // Should show unschedule section
      expect(screen.getByText(/Will be unscheduled/)).toBeInTheDocument()
    })
  })
})
