/**
 * Unit tests for useTaskSchedule hook
 * @module hooks/__tests__/useTaskSchedule.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTaskSchedule } from '../useTaskSchedule'
import type { SchedulingSuggestion, Task, TimeSlot } from '@/types'

// Mock the scheduling service
vi.mock('@/services/scheduling', () => ({
  getSuggestions: vi.fn(),
  scheduleTask: vi.fn(),
  unscheduleTask: vi.fn(),
  rescheduleTask: vi.fn(),
}))

import {
  getSuggestions,
  scheduleTask,
  unscheduleTask,
  rescheduleTask,
} from '@/services/scheduling'

const mockGetSuggestions = vi.mocked(getSuggestions)
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
    reasoning: 'Good time slot',
    factors: [],
    conflicts: [],
  }
}

// Helper to create mock task
function createMockTask(
  id: string,
  options: {
    scheduled?: boolean
    scheduledStart?: Date
    scheduledEnd?: Date
    calendarEventId?: string
    syncStatus?: 'pending' | 'synced' | 'error' | 'orphaned'
  } = {}
): Task {
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
    calendarEventId: options.calendarEventId,
    scheduledStart: options.scheduledStart,
    scheduledEnd: options.scheduledEnd,
    syncStatus: options.syncStatus,
  }
}

describe('useTaskSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state without task', () => {
    it('should have unscheduled initial state', () => {
      const { result } = renderHook(() => useTaskSchedule('task-1'))

      expect(result.current.isScheduled).toBe(false)
      expect(result.current.scheduledSlot).toBeNull()
      expect(result.current.calendarEventId).toBeNull()
      expect(result.current.syncStatus).toBeNull()
      expect(result.current.suggestions).toEqual([])
      expect(result.current.isLoadingSuggestions).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('initial state with scheduled task', () => {
    it('should reflect scheduled task state', () => {
      const scheduledStart = new Date(2024, 0, 15, 9, 0)
      const scheduledEnd = new Date(2024, 0, 15, 10, 0)

      const task = createMockTask('task-1', {
        scheduled: true,
        scheduledStart,
        scheduledEnd,
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      const { result } = renderHook(() => useTaskSchedule('task-1', { task }))

      expect(result.current.isScheduled).toBe(true)
      expect(result.current.scheduledSlot).toEqual({
        start: scheduledStart,
        end: scheduledEnd,
        available: false,
      })
      expect(result.current.calendarEventId).toBe('event-1')
      expect(result.current.syncStatus).toBe('synced')
    })
  })

  describe('loadSuggestions', () => {
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

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      await act(async () => {
        await result.current.loadSuggestions()
      })

      expect(result.current.suggestions).toHaveLength(2)
      expect(result.current.isLoadingSuggestions).toBe(false)
    })

    it('should show loading state while fetching', async () => {
      let resolvePromise: (value: unknown) => void
      mockGetSuggestions.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      act(() => {
        result.current.loadSuggestions()
      })

      expect(result.current.isLoadingSuggestions).toBe(true)
      expect(result.current.isLoading).toBe(true)

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

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      const dateRange = {
        start: new Date(2024, 0, 15),
        end: new Date(2024, 0, 21),
      }

      await act(async () => {
        await result.current.loadSuggestions(5, dateRange)
      })

      expect(mockGetSuggestions).toHaveBeenCalledWith({
        taskId: 'task-1',
        count: 5,
        dateRange,
      })
    })

    it('should handle fetch errors', async () => {
      mockGetSuggestions.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      await act(async () => {
        await result.current.loadSuggestions()
      })

      expect(result.current.error?.message).toBe('Network error')
      expect(result.current.suggestions).toEqual([])
    })
  })

  describe('schedule', () => {
    it('should schedule task and update state', async () => {
      mockScheduleTask.mockResolvedValue({
        success: true,
        calendarEventId: 'event-1',
      })

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      const slot: TimeSlot = {
        start: new Date(2024, 0, 15, 9, 0),
        end: new Date(2024, 0, 15, 10, 0),
        available: true,
      }

      let success: boolean = false
      await act(async () => {
        success = await result.current.schedule(slot)
      })

      expect(success).toBe(true)
      expect(result.current.isScheduled).toBe(true)
      expect(result.current.scheduledSlot).toEqual(slot)
      expect(result.current.calendarEventId).toBe('event-1')
      expect(result.current.syncStatus).toBe('synced')
    })

    it('should call onScheduled callback', async () => {
      const onScheduled = vi.fn()

      mockScheduleTask.mockResolvedValue({
        success: true,
        calendarEventId: 'event-1',
      })

      const { result } = renderHook(() =>
        useTaskSchedule('task-1', { onScheduled })
      )

      const slot: TimeSlot = {
        start: new Date(2024, 0, 15, 9, 0),
        end: new Date(2024, 0, 15, 10, 0),
        available: true,
      }

      await act(async () => {
        await result.current.schedule(slot)
      })

      expect(onScheduled).toHaveBeenCalledWith(slot, 'event-1')
    })

    it('should use default calendar if not specified', async () => {
      mockScheduleTask.mockResolvedValue({ success: true, calendarEventId: 'event-1' })

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      const slot: TimeSlot = {
        start: new Date(),
        end: new Date(),
        available: true,
      }

      await act(async () => {
        await result.current.schedule(slot)
      })

      expect(mockScheduleTask).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
        })
      )
    })

    it('should handle schedule errors', async () => {
      mockScheduleTask.mockRejectedValue(new Error('Calendar error'))

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      const slot: TimeSlot = {
        start: new Date(),
        end: new Date(),
        available: true,
      }

      let success: boolean = true
      await act(async () => {
        success = await result.current.schedule(slot)
      })

      expect(success).toBe(false)
      expect(result.current.error?.message).toBe('Calendar error')
      expect(result.current.isScheduled).toBe(false)
    })

    it('should not update state if scheduling fails', async () => {
      mockScheduleTask.mockResolvedValue({
        success: false,
      })

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      const slot: TimeSlot = {
        start: new Date(),
        end: new Date(),
        available: true,
      }

      await act(async () => {
        await result.current.schedule(slot)
      })

      expect(result.current.isScheduled).toBe(false)
      expect(result.current.scheduledSlot).toBeNull()
    })
  })

  describe('unschedule', () => {
    it('should unschedule task and update state', async () => {
      mockUnscheduleTask.mockResolvedValue({ success: true })

      const scheduledStart = new Date(2024, 0, 15, 9, 0)
      const scheduledEnd = new Date(2024, 0, 15, 10, 0)

      const task = createMockTask('task-1', {
        scheduledStart,
        scheduledEnd,
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      const { result } = renderHook(() => useTaskSchedule('task-1', { task }))

      expect(result.current.isScheduled).toBe(true)

      let success: boolean = false
      await act(async () => {
        success = await result.current.unschedule()
      })

      expect(success).toBe(true)
      expect(result.current.isScheduled).toBe(false)
      expect(result.current.scheduledSlot).toBeNull()
      expect(result.current.calendarEventId).toBeNull()
      expect(result.current.syncStatus).toBeNull()
    })

    it('should call onUnscheduled callback', async () => {
      const onUnscheduled = vi.fn()

      mockUnscheduleTask.mockResolvedValue({ success: true })

      const task = createMockTask('task-1', {
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        calendarEventId: 'event-1',
      })

      const { result } = renderHook(() =>
        useTaskSchedule('task-1', { task, onUnscheduled })
      )

      await act(async () => {
        await result.current.unschedule()
      })

      expect(onUnscheduled).toHaveBeenCalled()
    })

    it('should handle unschedule errors', async () => {
      mockUnscheduleTask.mockRejectedValue(new Error('Unschedule failed'))

      const task = createMockTask('task-1', {
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        calendarEventId: 'event-1',
      })

      const { result } = renderHook(() => useTaskSchedule('task-1', { task }))

      let success: boolean = true
      await act(async () => {
        success = await result.current.unschedule()
      })

      expect(success).toBe(false)
      expect(result.current.error?.message).toBe('Unschedule failed')
      // State should not change on error
      expect(result.current.isScheduled).toBe(true)
    })
  })

  describe('reschedule', () => {
    it('should reschedule task and update state', async () => {
      mockRescheduleTask.mockResolvedValue({ success: true })

      const originalStart = new Date(2024, 0, 15, 9, 0)
      const originalEnd = new Date(2024, 0, 15, 10, 0)

      const task = createMockTask('task-1', {
        scheduledStart: originalStart,
        scheduledEnd: originalEnd,
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      const { result } = renderHook(() => useTaskSchedule('task-1', { task }))

      const newSlot: TimeSlot = {
        start: new Date(2024, 0, 16, 14, 0),
        end: new Date(2024, 0, 16, 15, 0),
        available: true,
      }

      let success: boolean = false
      await act(async () => {
        success = await result.current.reschedule(newSlot)
      })

      expect(success).toBe(true)
      expect(result.current.scheduledSlot).toEqual(newSlot)
      expect(result.current.syncStatus).toBe('synced')
    })

    it('should call onRescheduled callback', async () => {
      const onRescheduled = vi.fn()

      mockRescheduleTask.mockResolvedValue({ success: true })

      const task = createMockTask('task-1', {
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        calendarEventId: 'event-1',
      })

      const { result } = renderHook(() =>
        useTaskSchedule('task-1', { task, onRescheduled })
      )

      const newSlot: TimeSlot = {
        start: new Date(2024, 0, 16, 14, 0),
        end: new Date(2024, 0, 16, 15, 0),
        available: true,
      }

      await act(async () => {
        await result.current.reschedule(newSlot)
      })

      expect(onRescheduled).toHaveBeenCalledWith(newSlot)
    })

    it('should handle reschedule errors', async () => {
      mockRescheduleTask.mockRejectedValue(new Error('Reschedule failed'))

      const originalSlot = {
        start: new Date(2024, 0, 15, 9, 0),
        end: new Date(2024, 0, 15, 10, 0),
      }

      const task = createMockTask('task-1', {
        scheduledStart: originalSlot.start,
        scheduledEnd: originalSlot.end,
        calendarEventId: 'event-1',
      })

      const { result } = renderHook(() => useTaskSchedule('task-1', { task }))

      const newSlot: TimeSlot = {
        start: new Date(2024, 0, 16, 14, 0),
        end: new Date(2024, 0, 16, 15, 0),
        available: true,
      }

      let success: boolean = true
      await act(async () => {
        success = await result.current.reschedule(newSlot)
      })

      expect(success).toBe(false)
      expect(result.current.error?.message).toBe('Reschedule failed')
      // Should keep original slot
      expect(result.current.scheduledSlot?.start).toEqual(originalSlot.start)
    })
  })

  describe('task prop updates', () => {
    it('should update state when task prop changes', () => {
      const task1 = createMockTask('task-1')

      const { result, rerender } = renderHook(
        ({ task }) => useTaskSchedule('task-1', { task }),
        { initialProps: { task: task1 } }
      )

      expect(result.current.isScheduled).toBe(false)

      const task2 = createMockTask('task-1', {
        scheduledStart: new Date(2024, 0, 15, 9, 0),
        scheduledEnd: new Date(2024, 0, 15, 10, 0),
        calendarEventId: 'event-1',
        syncStatus: 'synced',
      })

      rerender({ task: task2 })

      expect(result.current.isScheduled).toBe(true)
      expect(result.current.calendarEventId).toBe('event-1')
      expect(result.current.syncStatus).toBe('synced')
    })
  })

  describe('loading state', () => {
    it('should combine loading states correctly', async () => {
      // Set up both operations to be pending
      let resolveSuggestions: (value: unknown) => void
      let resolveSchedule: (value: unknown) => void

      mockGetSuggestions.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSuggestions = resolve
          })
      )

      mockScheduleTask.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSchedule = resolve
          })
      )

      const { result } = renderHook(() => useTaskSchedule('task-1'))

      // Start loading suggestions
      act(() => {
        result.current.loadSuggestions()
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isLoadingSuggestions).toBe(true)

      // Resolve suggestions but start scheduling
      await act(async () => {
        resolveSuggestions!({
          suggestions: [],
          task: createMockTask('task-1'),
          appliedRules: [],
        })
      })

      await waitFor(() => {
        expect(result.current.isLoadingSuggestions).toBe(false)
      })

      act(() => {
        result.current.schedule({
          start: new Date(),
          end: new Date(),
          available: true,
        })
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolveSchedule!({ success: true, calendarEventId: 'event-1' })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
