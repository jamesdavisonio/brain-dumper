/**
 * Unit tests for useScheduling hook
 * @module hooks/__tests__/useScheduling.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useScheduling } from '../useScheduling'
import type { SchedulingSuggestion, Task, TimeSlot } from '@/types'
import type { ScheduleProposal, ConfirmResult } from '@/services/scheduling'

// Mock the scheduling service
vi.mock('@/services/scheduling', () => ({
  getSuggestions: vi.fn(),
  proposeSchedule: vi.fn(),
  confirmSchedule: vi.fn(),
  scheduleTask: vi.fn(),
  unscheduleTask: vi.fn(),
  rescheduleTask: vi.fn(),
}))

import {
  getSuggestions,
  proposeSchedule,
  confirmSchedule,
  scheduleTask,
  unscheduleTask,
  rescheduleTask,
} from '@/services/scheduling'

const mockGetSuggestions = vi.mocked(getSuggestions)
const mockProposeSchedule = vi.mocked(proposeSchedule)
const mockConfirmSchedule = vi.mocked(confirmSchedule)
const mockScheduleTask = vi.mocked(scheduleTask)
const mockUnscheduleTask = vi.mocked(unscheduleTask)
const mockRescheduleTask = vi.mocked(rescheduleTask)

// Helper to create mock suggestions
function createMockSuggestion(date: Date, score: number): SchedulingSuggestion {
  return {
    slot: {
      start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
      end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0),
      available: true,
    },
    score,
    reasoning: 'Good time slot based on preferences',
    factors: [
      { name: 'preference', weight: 0.5, value: 80, description: 'Matches preferences' },
    ],
    conflicts: [],
  }
}

// Helper to create mock task
function createMockTask(id: string): Task {
  return {
    id,
    content: `Task ${id}`,
    priority: 'medium',
    completed: false,
    archived: false,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
  }
}

// Helper to create mock proposal
function createMockProposal(taskIds: string[]): ScheduleProposal {
  return {
    id: 'proposal-1',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    assignments: taskIds.map((taskId, index) => ({
      taskId,
      task: createMockTask(taskId),
      suggestions: [createMockSuggestion(new Date(), 90 - index * 10)],
      recommendedSlotIndex: 0,
    })),
    displacements: [],
    summary: {
      totalTasks: taskIds.length,
      schedulableTasks: taskIds.length,
      conflictedTasks: 0,
      totalMinutes: taskIds.length * 60,
    },
  }
}

describe('useScheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty initial state', () => {
      const { result } = renderHook(() => useScheduling())

      expect(result.current.suggestions).toEqual([])
      expect(result.current.isLoadingSuggestions).toBe(false)
      expect(result.current.proposal).toBeNull()
      expect(result.current.isProposing).toBe(false)
      expect(result.current.isConfirming).toBe(false)
      expect(result.current.isScheduling).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.selectedSlot).toBeNull()
    })
  })

  describe('getSuggestions', () => {
    it('should fetch and return suggestions', async () => {
      const mockSuggestions = [
        createMockSuggestion(new Date(2024, 0, 15), 95),
        createMockSuggestion(new Date(2024, 0, 16), 85),
      ]

      mockGetSuggestions.mockResolvedValue({
        suggestions: mockSuggestions,
        task: createMockTask('task-1'),
        appliedRules: [],
      })

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.getSuggestions('task-1')
      })

      expect(result.current.suggestions).toHaveLength(2)
      expect(result.current.isLoadingSuggestions).toBe(false)
      expect(mockGetSuggestions).toHaveBeenCalledWith({
        taskId: 'task-1',
        count: undefined,
        dateRange: undefined,
      })
    })

    it('should show loading state while fetching', async () => {
      let resolvePromise: (value: unknown) => void
      mockGetSuggestions.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useScheduling())

      act(() => {
        result.current.getSuggestions('task-1')
      })

      expect(result.current.isLoadingSuggestions).toBe(true)
      expect(result.current.isScheduling).toBe(true)

      await act(async () => {
        resolvePromise!({
          suggestions: [],
          task: createMockTask('task-1'),
          appliedRules: [],
        })
      })

      await waitFor(() => {
        expect(result.current.isLoadingSuggestions).toBe(false)
      })
    })

    it('should pass count and dateRange parameters', async () => {
      mockGetSuggestions.mockResolvedValue({
        suggestions: [],
        task: createMockTask('task-1'),
        appliedRules: [],
      })

      const { result } = renderHook(() => useScheduling())

      const dateRange = {
        start: new Date(2024, 0, 15),
        end: new Date(2024, 0, 21),
      }

      await act(async () => {
        await result.current.getSuggestions('task-1', 5, dateRange)
      })

      expect(mockGetSuggestions).toHaveBeenCalledWith({
        taskId: 'task-1',
        count: 5,
        dateRange,
      })
    })

    it('should cache suggestions', async () => {
      const mockSuggestions = [createMockSuggestion(new Date(2024, 0, 15), 95)]

      mockGetSuggestions.mockResolvedValue({
        suggestions: mockSuggestions,
        task: createMockTask('task-1'),
        appliedRules: [],
      })

      const { result } = renderHook(() => useScheduling())

      // First call
      await act(async () => {
        await result.current.getSuggestions('task-1')
      })

      expect(mockGetSuggestions).toHaveBeenCalledTimes(1)

      // Second call with same params - should use cache
      await act(async () => {
        await result.current.getSuggestions('task-1')
      })

      expect(mockGetSuggestions).toHaveBeenCalledTimes(1)
    })

    it('should handle fetch errors', async () => {
      mockGetSuggestions.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.getSuggestions('task-1')
      })

      expect(result.current.error?.message).toBe('Network error')
      expect(result.current.suggestions).toEqual([])
    })

    it('should clear suggestions', async () => {
      mockGetSuggestions.mockResolvedValue({
        suggestions: [createMockSuggestion(new Date(), 90)],
        task: createMockTask('task-1'),
        appliedRules: [],
      })

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.getSuggestions('task-1')
      })

      expect(result.current.suggestions).toHaveLength(1)

      act(() => {
        result.current.clearSuggestions()
      })

      expect(result.current.suggestions).toEqual([])
    })
  })

  describe('proposeSchedule', () => {
    it('should generate a proposal for tasks', async () => {
      const mockProposal = createMockProposal(['task-1', 'task-2'])
      mockProposeSchedule.mockResolvedValue(mockProposal)

      const { result } = renderHook(() => useScheduling())

      const tasks = [createMockTask('task-1'), createMockTask('task-2')]

      await act(async () => {
        await result.current.proposeSchedule(tasks)
      })

      expect(result.current.proposal).toEqual(mockProposal)
      expect(result.current.isProposing).toBe(false)
    })

    it('should show proposing state', async () => {
      let resolvePromise: (value: ScheduleProposal) => void
      mockProposeSchedule.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useScheduling())

      act(() => {
        result.current.proposeSchedule([createMockTask('task-1')])
      })

      expect(result.current.isProposing).toBe(true)
      expect(result.current.isScheduling).toBe(true)

      await act(async () => {
        resolvePromise!(createMockProposal(['task-1']))
      })

      await waitFor(() => {
        expect(result.current.isProposing).toBe(false)
      })
    })

    it('should not call service with empty tasks', async () => {
      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.proposeSchedule([])
      })

      expect(mockProposeSchedule).not.toHaveBeenCalled()
    })

    it('should pass options to service', async () => {
      mockProposeSchedule.mockResolvedValue(createMockProposal(['task-1']))

      const { result } = renderHook(() => useScheduling())

      const tasks = [createMockTask('task-1')]
      const options = {
        respectPriority: true,
        includeBuffers: true,
        preferredCalendarId: 'cal-1',
      }

      await act(async () => {
        await result.current.proposeSchedule(tasks, options)
      })

      expect(mockProposeSchedule).toHaveBeenCalledWith({ tasks, options })
    })

    it('should handle proposal errors', async () => {
      mockProposeSchedule.mockRejectedValue(new Error('Failed to propose'))

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.proposeSchedule([createMockTask('task-1')])
      })

      expect(result.current.error?.message).toBe('Failed to propose')
      expect(result.current.proposal).toBeNull()
    })

    it('should clear proposal', async () => {
      mockProposeSchedule.mockResolvedValue(createMockProposal(['task-1']))

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.proposeSchedule([createMockTask('task-1')])
      })

      expect(result.current.proposal).not.toBeNull()

      act(() => {
        result.current.clearProposal()
      })

      expect(result.current.proposal).toBeNull()
    })
  })

  describe('confirmSchedule', () => {
    it('should confirm a proposal with approvals', async () => {
      const mockProposal = createMockProposal(['task-1', 'task-2'])
      mockProposeSchedule.mockResolvedValue(mockProposal)

      const mockResult: ConfirmResult = {
        success: true,
        scheduledTasks: [
          {
            taskId: 'task-1',
            calendarEventId: 'event-1',
            slot: {
              start: new Date(),
              end: new Date(),
              available: true,
            },
          },
        ],
        failedTasks: [],
        appliedDisplacements: [],
      }
      mockConfirmSchedule.mockResolvedValue(mockResult)

      const { result } = renderHook(() => useScheduling())

      // First create a proposal
      await act(async () => {
        await result.current.proposeSchedule([createMockTask('task-1')])
      })

      // Then confirm it
      let confirmResult: ConfirmResult | undefined
      await act(async () => {
        confirmResult = await result.current.confirmSchedule([
          { taskId: 'task-1', approved: true, selectedSlotIndex: 0 },
        ])
      })

      expect(confirmResult?.success).toBe(true)
      expect(result.current.proposal).toBeNull() // Cleared on success
    })

    it('should throw error if no proposal', async () => {
      const { result } = renderHook(() => useScheduling())

      await expect(
        act(async () => {
          await result.current.confirmSchedule([])
        })
      ).rejects.toThrow('No proposal to confirm')
    })

    it('should show confirming state', async () => {
      mockProposeSchedule.mockResolvedValue(createMockProposal(['task-1']))

      let resolveConfirm: (value: ConfirmResult) => void
      mockConfirmSchedule.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfirm = resolve
          })
      )

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.proposeSchedule([createMockTask('task-1')])
      })

      act(() => {
        result.current.confirmSchedule([{ taskId: 'task-1', approved: true }])
      })

      expect(result.current.isConfirming).toBe(true)

      await act(async () => {
        resolveConfirm!({
          success: true,
          scheduledTasks: [],
          failedTasks: [],
          appliedDisplacements: [],
        })
      })

      await waitFor(() => {
        expect(result.current.isConfirming).toBe(false)
      })
    })
  })

  describe('quick schedule actions', () => {
    describe('scheduleTask', () => {
      it('should schedule a task to a slot', async () => {
        mockScheduleTask.mockResolvedValue({
          success: true,
          calendarEventId: 'event-1',
        })

        const { result } = renderHook(() => useScheduling())

        const slot: TimeSlot = {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 10, 0),
          available: true,
        }

        let success: boolean = false
        await act(async () => {
          success = await result.current.scheduleTask('task-1', slot, 'cal-1')
        })

        expect(success).toBe(true)
        expect(mockScheduleTask).toHaveBeenCalledWith({
          taskId: 'task-1',
          slot,
          calendarId: 'cal-1',
          includeBuffers: true,
        })
      })

      it('should use default calendar if not specified', async () => {
        mockScheduleTask.mockResolvedValue({ success: true })

        const { result } = renderHook(() => useScheduling())

        const slot: TimeSlot = {
          start: new Date(),
          end: new Date(),
          available: true,
        }

        await act(async () => {
          await result.current.scheduleTask('task-1', slot)
        })

        expect(mockScheduleTask).toHaveBeenCalledWith(
          expect.objectContaining({
            calendarId: 'primary',
          })
        )
      })

      it('should handle schedule errors', async () => {
        mockScheduleTask.mockRejectedValue(new Error('Calendar error'))

        const { result } = renderHook(() => useScheduling())

        const slot: TimeSlot = {
          start: new Date(),
          end: new Date(),
          available: true,
        }

        let success: boolean = true
        await act(async () => {
          success = await result.current.scheduleTask('task-1', slot)
        })

        expect(success).toBe(false)
        expect(result.current.error?.message).toBe('Calendar error')
      })
    })

    describe('unscheduleTask', () => {
      it('should unschedule a task', async () => {
        mockUnscheduleTask.mockResolvedValue({ success: true })

        const { result } = renderHook(() => useScheduling())

        let success: boolean = false
        await act(async () => {
          success = await result.current.unscheduleTask('task-1')
        })

        expect(success).toBe(true)
        expect(mockUnscheduleTask).toHaveBeenCalledWith('task-1')
      })

      it('should handle unschedule errors', async () => {
        mockUnscheduleTask.mockRejectedValue(new Error('Unschedule failed'))

        const { result } = renderHook(() => useScheduling())

        let success: boolean = true
        await act(async () => {
          success = await result.current.unscheduleTask('task-1')
        })

        expect(success).toBe(false)
        expect(result.current.error?.message).toBe('Unschedule failed')
      })
    })

    describe('rescheduleTask', () => {
      it('should reschedule a task to a new slot', async () => {
        mockRescheduleTask.mockResolvedValue({ success: true })

        const { result } = renderHook(() => useScheduling())

        const newSlot: TimeSlot = {
          start: new Date(2024, 0, 16, 14, 0),
          end: new Date(2024, 0, 16, 15, 0),
          available: true,
        }

        let success: boolean = false
        await act(async () => {
          success = await result.current.rescheduleTask('task-1', newSlot)
        })

        expect(success).toBe(true)
        expect(mockRescheduleTask).toHaveBeenCalledWith({
          taskId: 'task-1',
          newSlot,
          updateBuffers: true,
        })
      })

      it('should handle reschedule errors', async () => {
        mockRescheduleTask.mockRejectedValue(new Error('Reschedule failed'))

        const { result } = renderHook(() => useScheduling())

        const newSlot: TimeSlot = {
          start: new Date(),
          end: new Date(),
          available: true,
        }

        let success: boolean = true
        await act(async () => {
          success = await result.current.rescheduleTask('task-1', newSlot)
        })

        expect(success).toBe(false)
        expect(result.current.error?.message).toBe('Reschedule failed')
      })
    })
  })

  describe('error handling', () => {
    it('should clear error', async () => {
      mockGetSuggestions.mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() => useScheduling())

      await act(async () => {
        await result.current.getSuggestions('task-1')
      })

      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('selected slot', () => {
    it('should select a slot', () => {
      const { result } = renderHook(() => useScheduling())

      const slot: TimeSlot = {
        start: new Date(2024, 0, 15, 9, 0),
        end: new Date(2024, 0, 15, 10, 0),
        available: true,
      }

      act(() => {
        result.current.selectSlot('task-1', slot)
      })

      expect(result.current.selectedSlot).toEqual({
        taskId: 'task-1',
        slot,
      })
    })

    it('should clear selected slot', () => {
      const { result } = renderHook(() => useScheduling())

      const slot: TimeSlot = {
        start: new Date(),
        end: new Date(),
        available: true,
      }

      act(() => {
        result.current.selectSlot('task-1', slot)
      })

      expect(result.current.selectedSlot).not.toBeNull()

      act(() => {
        result.current.clearSelectedSlot()
      })

      expect(result.current.selectedSlot).toBeNull()
    })
  })
})
