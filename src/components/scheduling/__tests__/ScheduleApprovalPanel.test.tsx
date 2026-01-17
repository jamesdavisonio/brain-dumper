import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScheduleApprovalPanel } from '../ScheduleApprovalPanel'
import type { Task, TimeSlot, SchedulingSuggestion } from '@/types'

type ApprovalState = 'pending' | 'approved' | 'rejected' | 'modified'

interface ScheduledTaskItem {
  task: Task
  proposedSlot: TimeSlot | null
  suggestions: SchedulingSuggestion[]
  approvalState: ApprovalState
  error?: string
}

interface ScheduleProposal {
  items: ScheduledTaskItem[]
  generatedAt: Date
  summary: {
    totalTasks: number
    scheduled: number
    conflicts: number
    displacements: number
    unschedulable: number
  }
}

const createMockTask = (id: string, content: string): Task => ({
  id,
  content,
  priority: 'medium',
  completed: false,
  archived: false,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  order: 0,
  timeEstimate: 60,
  project: 'Work',
})

const createMockProposal = (
  items: Partial<ScheduledTaskItem>[]
): ScheduleProposal => {
  const fullItems: ScheduledTaskItem[] = items.map((item, idx) => {
    const task = item.task || createMockTask(`task-${idx}`, `Task ${idx + 1}`)
    const start = new Date()
    start.setHours(9 + idx, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)

    return {
      task,
      proposedSlot: item.proposedSlot !== undefined
        ? item.proposedSlot
        : { start, end, available: true },
      suggestions: item.suggestions || [],
      approvalState: item.approvalState || 'pending',
      error: item.error,
    }
  })

  const scheduled = fullItems.filter((i) => i.proposedSlot !== null).length
  const unschedulable = fullItems.filter((i) => i.proposedSlot === null).length

  return {
    items: fullItems,
    generatedAt: new Date(),
    summary: {
      totalTasks: fullItems.length,
      scheduled,
      conflicts: 0,
      displacements: 0,
      unschedulable,
    },
  }
}

describe('ScheduleApprovalPanel', () => {
  describe('Basic Rendering', () => {
    it('renders panel with title', () => {
      const proposal = createMockProposal([{}])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText('Proposed Schedule')).toBeInTheDocument()
    })

    it('shows summary stats', () => {
      const proposal = createMockProposal([{}, {}, { proposedSlot: null, error: 'No time' }])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText(/2 of 3 scheduled/)).toBeInTheDocument()
      expect(screen.getByText(/1 could not be scheduled/)).toBeInTheDocument()
    })

    it('renders all proposal items', () => {
      const proposal = createMockProposal([
        { task: createMockTask('1', 'First task') },
        { task: createMockTask('2', 'Second task') },
      ])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText('First task')).toBeInTheDocument()
      expect(screen.getByText('Second task')).toBeInTheDocument()
    })
  })

  describe('Approval States', () => {
    it('shows checkbox for each item', () => {
      const proposal = createMockProposal([{}])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('checkbox is checked when approved', () => {
      const proposal = createMockProposal([{ task: createMockTask('task-1', 'Test') }])
      const approvals = new Map<string, ApprovalState>([['task-1', 'approved']])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={approvals}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it('checkbox is unchecked when rejected', () => {
      const proposal = createMockProposal([{ task: createMockTask('task-1', 'Test') }])
      const approvals = new Map<string, ApprovalState>([['task-1', 'rejected']])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={approvals}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('calls onApprovalChange when checkbox is clicked', () => {
      const proposal = createMockProposal([{ task: createMockTask('task-1', 'Test') }])
      const onApprovalChange = vi.fn()

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={onApprovalChange}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('checkbox'))
      expect(onApprovalChange).toHaveBeenCalledWith('task-1', 'approved')
    })

    it('shows modified badge when state is modified', () => {
      const proposal = createMockProposal([{ task: createMockTask('task-1', 'Test') }])
      const approvals = new Map<string, ApprovalState>([['task-1', 'modified']])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={approvals}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText('Modified')).toBeInTheDocument()
    })

    it('shows strikethrough text when rejected', () => {
      const proposal = createMockProposal([{ task: createMockTask('task-1', 'Test task') }])
      const approvals = new Map<string, ApprovalState>([['task-1', 'rejected']])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={approvals}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      const taskText = screen.getByText('Test task')
      expect(taskText).toHaveClass('line-through')
    })
  })

  describe('Error States', () => {
    it('shows error message for unschedulable tasks', () => {
      const proposal = createMockProposal([
        {
          task: createMockTask('task-1', 'Problem task'),
          proposedSlot: null,
          error: 'No available time slots',
        },
      ])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText('No available time slots')).toBeInTheDocument()
    })
  })

  describe('Bulk Actions', () => {
    it('calls onApproveAll when Approve All is clicked', () => {
      const proposal = createMockProposal([{}])
      const onApproveAll = vi.fn()

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={onApproveAll}
          onRejectAll={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Approve All/i }))
      expect(onApproveAll).toHaveBeenCalled()
    })

    it('calls onRejectAll when Reject All is clicked', () => {
      const proposal = createMockProposal([{}])
      const onRejectAll = vi.fn()

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={onRejectAll}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Reject All/i }))
      expect(onRejectAll).toHaveBeenCalled()
    })

    it('disables buttons when processing', () => {
      const proposal = createMockProposal([{}])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
          isProcessing={true}
        />
      )

      expect(screen.getByRole('button', { name: /Approve All/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Reject All/i })).toBeDisabled()
    })
  })

  describe('Footer Stats', () => {
    it('shows approval counts in footer', () => {
      const proposal = createMockProposal([
        { task: createMockTask('1', 'Task 1') },
        { task: createMockTask('2', 'Task 2') },
        { task: createMockTask('3', 'Task 3') },
      ])
      const approvals = new Map<string, ApprovalState>([
        ['1', 'approved'],
        ['2', 'rejected'],
        ['3', 'pending'],
      ])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={approvals}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText(/1 approved/)).toBeInTheDocument()
      expect(screen.getByText(/1 rejected/)).toBeInTheDocument()
      expect(screen.getByText(/1 pending/)).toBeInTheDocument()
    })
  })

  describe('Time Slot Display', () => {
    it('shows proposed time for scheduled items', () => {
      const start = new Date()
      start.setHours(9, 0, 0, 0)
      const end = new Date()
      end.setHours(11, 0, 0, 0)

      const proposal = createMockProposal([
        {
          task: createMockTask('1', 'Morning task'),
          proposedSlot: { start, end, available: true },
        },
      ])

      render(
        <ScheduleApprovalPanel
          proposal={proposal}
          approvals={new Map()}
          onApprovalChange={vi.fn()}
          onApproveAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      )

      expect(screen.getByText(/9:00 AM/)).toBeInTheDocument()
      expect(screen.getByText(/11:00 AM/)).toBeInTheDocument()
    })
  })
})
