/**
 * Unit tests for useScheduleProposal hook
 * @module hooks/__tests__/useScheduleProposal.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useScheduleProposal } from '../useScheduleProposal'
import type { SchedulingSuggestion, Task } from '@/types'
import type { ScheduleProposal, ConfirmResult } from '@/services/scheduling'

// Mock the scheduling service
vi.mock('@/services/scheduling', () => ({
  confirmSchedule: vi.fn(),
}))

import { confirmSchedule } from '@/services/scheduling'

const mockConfirmSchedule = vi.mocked(confirmSchedule)

// Helper to create mock suggestions
function createMockSuggestion(date: Date, score: number): SchedulingSuggestion {
  return {
    slot: {
      start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
      end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0),
      available: true,
    },
    score,
    reasoning: 'Good time slot',
    factors: [],
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
function createMockProposal(
  taskIds: string[],
  options: { withDisplacements?: boolean } = {}
): ScheduleProposal {
  return {
    id: 'proposal-1',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    assignments: taskIds.map((taskId, index) => ({
      taskId,
      task: createMockTask(taskId),
      suggestions: [
        createMockSuggestion(new Date(), 95 - index * 5),
        createMockSuggestion(new Date(Date.now() + 86400000), 85 - index * 5),
      ],
      recommendedSlotIndex: 0,
    })),
    displacements: options.withDisplacements
      ? [
          {
            eventId: 'event-1',
            eventTitle: 'Existing Meeting',
            originalSlot: {
              start: new Date(),
              end: new Date(),
              available: false,
            },
            proposedSlot: {
              start: new Date(Date.now() + 3600000),
              end: new Date(Date.now() + 7200000),
              available: true,
            },
            reason: 'Conflict with scheduled task',
          },
        ]
      : [],
    summary: {
      totalTasks: taskIds.length,
      schedulableTasks: taskIds.length,
      conflictedTasks: 0,
      totalMinutes: taskIds.length * 60,
    },
  }
}

describe('useScheduleProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state with null proposal', () => {
    it('should have empty initial state', () => {
      const { result } = renderHook(() => useScheduleProposal(null))

      expect(result.current.proposal).toBeNull()
      expect(result.current.approvals.size).toBe(0)
      expect(result.current.displacementsApproved).toBe(false)
      expect(result.current.isConfirming).toBe(false)
      expect(result.current.canConfirm).toBe(false)
    })

    it('should have empty summary', () => {
      const { result } = renderHook(() => useScheduleProposal(null))

      expect(result.current.summary).toEqual({
        totalTasks: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        hasDisplacements: false,
        displacementCount: 0,
      })
    })

    it('should have validation error for no proposal', () => {
      const { result } = renderHook(() => useScheduleProposal(null))

      expect(result.current.validationErrors).toContain('No proposal to confirm')
    })
  })

  describe('initial state with proposal', () => {
    it('should initialize approvals for all tasks', () => {
      const proposal = createMockProposal(['task-1', 'task-2', 'task-3'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.approvals.size).toBe(3)
      expect(result.current.approvals.get('task-1')).toEqual({
        approved: true,
        selectedSlotIndex: 0,
        modified: false,
      })
    })

    it('should default all tasks to approved', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.summary.approved).toBe(2)
      expect(result.current.summary.rejected).toBe(0)
    })

    it('should use recommended slot index', () => {
      const proposal = createMockProposal(['task-1'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      const approval = result.current.approvals.get('task-1')
      expect(approval?.selectedSlotIndex).toBe(0) // Matches recommendedSlotIndex
    })
  })

  describe('setApproval', () => {
    it('should update approval state for a task', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setApproval('task-1', { approved: false })
      })

      const approval = result.current.approvals.get('task-1')
      expect(approval?.approved).toBe(false)
      expect(approval?.modified).toBe(true)
    })

    it('should update selected slot index', () => {
      const proposal = createMockProposal(['task-1'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setApproval('task-1', { selectedSlotIndex: 1 })
      })

      const approval = result.current.approvals.get('task-1')
      expect(approval?.selectedSlotIndex).toBe(1)
    })

    it('should preserve other fields when updating', () => {
      const proposal = createMockProposal(['task-1'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setApproval('task-1', { selectedSlotIndex: 1 })
      })

      const approval = result.current.approvals.get('task-1')
      expect(approval?.approved).toBe(true) // Preserved
      expect(approval?.selectedSlotIndex).toBe(1)
    })
  })

  describe('approveAll', () => {
    it('should approve all tasks', () => {
      const proposal = createMockProposal(['task-1', 'task-2', 'task-3'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      // First reject some
      act(() => {
        result.current.setApproval('task-1', { approved: false })
        result.current.setApproval('task-2', { approved: false })
      })

      expect(result.current.summary.approved).toBe(1)

      // Then approve all
      act(() => {
        result.current.approveAll()
      })

      expect(result.current.summary.approved).toBe(3)
      expect(result.current.summary.rejected).toBe(0)
    })

    it('should mark all as modified', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.approveAll()
      })

      result.current.approvals.forEach((approval) => {
        expect(approval.modified).toBe(true)
      })
    })

    it('should preserve selected slot indices', () => {
      const proposal = createMockProposal(['task-1'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      // Change slot index
      act(() => {
        result.current.setApproval('task-1', { selectedSlotIndex: 1 })
      })

      // Then approve all
      act(() => {
        result.current.approveAll()
      })

      const approval = result.current.approvals.get('task-1')
      expect(approval?.selectedSlotIndex).toBe(1) // Preserved
    })
  })

  describe('rejectAll', () => {
    it('should reject all tasks', () => {
      const proposal = createMockProposal(['task-1', 'task-2', 'task-3'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.rejectAll()
      })

      expect(result.current.summary.approved).toBe(0)
      expect(result.current.summary.rejected).toBe(3)
    })

    it('should mark all as modified', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.rejectAll()
      })

      result.current.approvals.forEach((approval) => {
        expect(approval.modified).toBe(true)
      })
    })
  })

  describe('displacement handling', () => {
    it('should track displacements in summary', () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.summary.hasDisplacements).toBe(true)
      expect(result.current.summary.displacementCount).toBe(1)
    })

    it('should default displacements to not approved', () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.displacementsApproved).toBe(false)
    })

    it('should allow setting displacements approved', () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setDisplacementsApproved(true)
      })

      expect(result.current.displacementsApproved).toBe(true)
    })
  })

  describe('summary calculations', () => {
    it('should calculate correct summary', () => {
      const proposal = createMockProposal(['task-1', 'task-2', 'task-3'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setApproval('task-1', { approved: true })
        result.current.setApproval('task-2', { approved: false })
        // task-3 remains approved (default)
      })

      expect(result.current.summary).toEqual({
        totalTasks: 3,
        approved: 2,
        rejected: 1,
        pending: 0,
        hasDisplacements: false,
        displacementCount: 0,
      })
    })
  })

  describe('canConfirm validation', () => {
    it('should be true when at least one task is approved', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.canConfirm).toBe(true)
    })

    it('should be false when no tasks are approved', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.rejectAll()
      })

      expect(result.current.canConfirm).toBe(false)
    })

    it('should be false when displacements not approved', () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.canConfirm).toBe(false)
    })

    it('should be true when displacements are approved', () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setDisplacementsApproved(true)
      })

      expect(result.current.canConfirm).toBe(true)
    })
  })

  describe('validationErrors', () => {
    it('should include error for no approved tasks', () => {
      const proposal = createMockProposal(['task-1'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.rejectAll()
      })

      expect(result.current.validationErrors).toContain(
        'At least one task must be approved'
      )
    })

    it('should include error for unapproved displacements', () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.validationErrors).toContain(
        'Displacements must be approved or tasks causing them must be rejected'
      )
    })

    it('should have no errors when valid', () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      expect(result.current.validationErrors).toHaveLength(0)
    })
  })

  describe('confirm', () => {
    it('should call confirmSchedule with correct parameters', async () => {
      const proposal = createMockProposal(['task-1', 'task-2'])

      mockConfirmSchedule.mockResolvedValue({
        success: true,
        scheduledTasks: [],
        failedTasks: [],
        appliedDisplacements: [],
      })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      // Approve one, reject one
      act(() => {
        result.current.setApproval('task-2', { approved: false })
      })

      await act(async () => {
        await result.current.confirm()
      })

      expect(mockConfirmSchedule).toHaveBeenCalledWith({
        proposalId: 'proposal-1',
        approved: expect.arrayContaining([
          expect.objectContaining({ taskId: 'task-1', confirmed: true }),
          expect.objectContaining({ taskId: 'task-2', confirmed: false }),
        ]),
        displacementsApproved: false,
      })
    })

    it('should show confirming state', async () => {
      const proposal = createMockProposal(['task-1'])

      let resolveConfirm: (value: ConfirmResult) => void
      mockConfirmSchedule.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfirm = resolve
          })
      )

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.confirm()
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

    it('should throw error if no proposal', async () => {
      const { result } = renderHook(() => useScheduleProposal(null))

      await expect(
        act(async () => {
          await result.current.confirm()
        })
      ).rejects.toThrow('No proposal to confirm')
    })

    it('should throw error if cannot confirm', async () => {
      const proposal = createMockProposal(['task-1'])

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.rejectAll()
      })

      await expect(
        act(async () => {
          await result.current.confirm()
        })
      ).rejects.toThrow('Cannot confirm')
    })

    it('should pass displacement approval', async () => {
      const proposal = createMockProposal(['task-1'], { withDisplacements: true })

      mockConfirmSchedule.mockResolvedValue({
        success: true,
        scheduledTasks: [],
        failedTasks: [],
        appliedDisplacements: [],
      })

      const { result } = renderHook(() => useScheduleProposal(proposal))

      act(() => {
        result.current.setDisplacementsApproved(true)
      })

      await act(async () => {
        await result.current.confirm()
      })

      expect(mockConfirmSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          displacementsApproved: true,
        })
      )
    })
  })

  describe('proposal changes', () => {
    it('should reset approvals when proposal changes', () => {
      const proposal1 = createMockProposal(['task-1'])
      const proposal2 = createMockProposal(['task-2', 'task-3'])

      const { result, rerender } = renderHook(
        ({ proposal }) => useScheduleProposal(proposal),
        { initialProps: { proposal: proposal1 } }
      )

      expect(result.current.approvals.size).toBe(1)
      expect(result.current.approvals.has('task-1')).toBe(true)

      rerender({ proposal: proposal2 })

      expect(result.current.approvals.size).toBe(2)
      expect(result.current.approvals.has('task-1')).toBe(false)
      expect(result.current.approvals.has('task-2')).toBe(true)
      expect(result.current.approvals.has('task-3')).toBe(true)
    })

    it('should reset displacements approved when proposal changes', () => {
      const proposal1 = createMockProposal(['task-1'], { withDisplacements: true })
      const proposal2 = createMockProposal(['task-2'])

      const { result, rerender } = renderHook(
        ({ proposal }) => useScheduleProposal(proposal),
        { initialProps: { proposal: proposal1 } }
      )

      act(() => {
        result.current.setDisplacementsApproved(true)
      })

      expect(result.current.displacementsApproved).toBe(true)

      rerender({ proposal: proposal2 })

      expect(result.current.displacementsApproved).toBe(false)
    })
  })
})
