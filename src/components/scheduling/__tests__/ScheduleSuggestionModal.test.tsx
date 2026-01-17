import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleSuggestionModal } from '../ScheduleSuggestionModal'
import type { Task, SchedulingSuggestion, AvailabilityWindow } from '@/types'

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  content: 'Review project proposal',
  priority: 'high',
  timeEstimate: 120,
  completed: false,
  archived: false,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  order: 0,
  project: 'Work',
  ...overrides,
})

const createMockSuggestion = (
  hoursFromNow: number,
  score: number
): SchedulingSuggestion => {
  const start = new Date()
  start.setHours(start.getHours() + hoursFromNow, 0, 0, 0)

  const end = new Date(start)
  end.setHours(end.getHours() + 2)

  return {
    slot: { start, end, available: true },
    score,
    reasoning: 'Good time slot',
    factors: [
      { name: 'Preference match', weight: 0.5, value: score, description: 'Good' },
    ],
    conflicts: [],
  }
}

describe('ScheduleSuggestionModal', () => {
  describe('Basic Rendering', () => {
    it('renders modal with task information', () => {
      const task = createMockTask()
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
        />
      )

      expect(screen.getByText('Schedule Task')).toBeInTheDocument()
      expect(screen.getByText('Review project proposal')).toBeInTheDocument()
      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })

    it('shows time estimate if provided', () => {
      const task = createMockTask({ timeEstimate: 120 })
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
        />
      )

      expect(screen.getByText('2h')).toBeInTheDocument()
    })

    it('shows project badge if task has project', () => {
      const task = createMockTask({ project: 'Marketing' })
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
        />
      )

      expect(screen.getByText('Marketing')).toBeInTheDocument()
    })
  })

  describe('Tabs', () => {
    it('shows two tabs: Suggested Times and Pick a Time', () => {
      const task = createMockTask()
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
        />
      )

      expect(screen.getByText('Suggested Times')).toBeInTheDocument()
      expect(screen.getByText('Pick a Time')).toBeInTheDocument()
    })

    it('switches between tabs', async () => {
      const user = userEvent.setup()
      const task = createMockTask()
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
        />
      )

      // Click on "Pick a Time" tab - find it by the tab text
      const pickATimeTab = screen.getByRole('tab', { name: /Pick a Time/i })
      await user.click(pickATimeTab)

      // Verify the tab is now selected
      await waitFor(() => {
        expect(pickATimeTab).toHaveAttribute('aria-selected', 'true')
      })
    })
  })

  describe('Suggestions Tab', () => {
    it('shows loading state when isLoading is true', () => {
      const task = createMockTask()
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          isLoading={true}
        />
      )

      expect(screen.getByText('Finding best times...')).toBeInTheDocument()
    })

    it('shows error message when error is provided', () => {
      const task = createMockTask()
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          error="Failed to fetch suggestions"
        />
      )

      expect(screen.getByText('Failed to load suggestions')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch suggestions')).toBeInTheDocument()
    })

    it('shows empty state when no suggestions', () => {
      const task = createMockTask()
      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          suggestions={[]}
        />
      )

      expect(screen.getByText('No suggestions available')).toBeInTheDocument()
      expect(screen.getByText('Try picking a time manually')).toBeInTheDocument()
    })

    it('renders suggestion cards when suggestions are provided', () => {
      const task = createMockTask()
      const suggestions = [
        createMockSuggestion(24, 90),
        createMockSuggestion(48, 75),
      ]

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          suggestions={suggestions}
        />
      )

      expect(screen.getByText('90/100')).toBeInTheDocument()
      expect(screen.getByText('75/100')).toBeInTheDocument()
    })

    it('selects first suggestion by default', () => {
      const task = createMockTask()
      const suggestions = [
        createMockSuggestion(24, 90),
        createMockSuggestion(48, 75),
      ]

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          suggestions={suggestions}
        />
      )

      // The first suggestion should be selected (has ring styling)
      const cards = document.querySelectorAll('[class*="ring-2"]')
      expect(cards.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Actions', () => {
    it('calls onOpenChange(false) when Cancel is clicked', () => {
      const task = createMockTask()
      const onOpenChange = vi.fn()

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={onOpenChange}
          onSchedule={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onSchedule with selected slot when Schedule is clicked', () => {
      const task = createMockTask()
      const suggestions = [createMockSuggestion(24, 90)]
      const onSchedule = vi.fn()

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={onSchedule}
          suggestions={suggestions}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
      expect(onSchedule).toHaveBeenCalledWith(suggestions[0].slot)
    })

    it('disables Schedule button when no slot is selected', () => {
      const task = createMockTask()

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          suggestions={[]}
        />
      )

      expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled()
    })

    it('disables Schedule button while loading', () => {
      const task = createMockTask()

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          isLoading={true}
        />
      )

      expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled()
    })
  })

  describe('Conflicts', () => {
    it('shows conflict warning when selected suggestion has conflicts', () => {
      const task = createMockTask()
      const suggestionWithConflict: SchedulingSuggestion = {
        ...createMockSuggestion(24, 70),
        conflicts: [
          {
            type: 'overlap',
            description: 'Overlaps with team meeting',
            severity: 'warning',
          },
        ],
      }

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          suggestions={[suggestionWithConflict]}
        />
      )

      expect(screen.getByText('1 conflict detected')).toBeInTheDocument()
    })

    it('shows "Review Changes" button when displacements exist', () => {
      const task = createMockTask()
      const suggestions = [createMockSuggestion(24, 90)]
      const displacements = [
        {
          taskId: 'task-2',
          taskName: 'Another task',
          originalStart: new Date(),
          originalEnd: new Date(),
          action: 'move' as const,
          reason: 'Lower priority',
        },
      ]

      render(
        <ScheduleSuggestionModal
          task={task}
          open={true}
          onOpenChange={vi.fn()}
          onSchedule={vi.fn()}
          suggestions={suggestions}
          displacements={displacements}
        />
      )

      expect(screen.getByText('Review Changes')).toBeInTheDocument()
    })
  })
})
