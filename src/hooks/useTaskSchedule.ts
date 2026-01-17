/**
 * Hook for individual task scheduling state and actions
 * Provides a focused API for managing a single task's schedule
 * @module hooks/useTaskSchedule
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { TimeSlot, SchedulingSuggestion, Task } from '@/types'
import {
  getSuggestions as getSuggestionsService,
  scheduleTask as scheduleTaskService,
  unscheduleTask as unscheduleTaskService,
  rescheduleTask as rescheduleTaskService,
} from '@/services/scheduling'

/**
 * Sync status for a scheduled task
 */
export type SyncStatus = 'pending' | 'synced' | 'error' | 'orphaned' | null

/**
 * Result type for the useTaskSchedule hook
 */
export interface UseTaskScheduleResult {
  // Current schedule state
  /** Whether the task is currently scheduled */
  isScheduled: boolean
  /** The scheduled time slot, if scheduled */
  scheduledSlot: TimeSlot | null
  /** ID of the calendar event, if scheduled */
  calendarEventId: string | null
  /** Current sync status with calendar */
  syncStatus: SyncStatus

  // Suggestions
  /** Available scheduling suggestions */
  suggestions: SchedulingSuggestion[]
  /** Whether suggestions are being loaded */
  isLoadingSuggestions: boolean
  /** Load suggestions for this task */
  loadSuggestions: (count?: number, dateRange?: { start: Date; end: Date }) => Promise<void>

  // Actions
  /** Schedule the task to a time slot */
  schedule: (slot: TimeSlot, calendarId?: string) => Promise<boolean>
  /** Unschedule the task */
  unschedule: () => Promise<boolean>
  /** Reschedule the task to a new slot */
  reschedule: (newSlot: TimeSlot) => Promise<boolean>

  // State
  /** Whether any operation is in progress */
  isLoading: boolean
  /** Current error, if any */
  error: Error | null
}

/**
 * Props for the useTaskSchedule hook
 */
export interface UseTaskScheduleOptions {
  /** Initial task data (optional, for pre-populating state) */
  task?: Task
  /** Callback when task is scheduled */
  onScheduled?: (slot: TimeSlot, calendarEventId: string) => void
  /** Callback when task is unscheduled */
  onUnscheduled?: () => void
  /** Callback when task is rescheduled */
  onRescheduled?: (newSlot: TimeSlot) => void
}

/**
 * Hook for managing a single task's scheduling state
 * Provides suggestions, schedule/unschedule/reschedule actions,
 * and tracks the current scheduling state.
 *
 * @example
 * ```tsx
 * function TaskSchedulePanel({ taskId }: { taskId: string }) {
 *   const {
 *     isScheduled,
 *     scheduledSlot,
 *     suggestions,
 *     isLoadingSuggestions,
 *     loadSuggestions,
 *     schedule,
 *     unschedule,
 *     isLoading,
 *     error,
 *   } = useTaskSchedule(taskId);
 *
 *   useEffect(() => {
 *     loadSuggestions();
 *   }, [loadSuggestions]);
 *
 *   if (isScheduled && scheduledSlot) {
 *     return (
 *       <div>
 *         <p>Scheduled: {scheduledSlot.start.toLocaleString()}</p>
 *         <button onClick={unschedule} disabled={isLoading}>
 *           Unschedule
 *         </button>
 *       </div>
 *     );
 *   }
 *
 *   return (
 *     <div>
 *       {isLoadingSuggestions && <Spinner />}
 *       {suggestions.map(s => (
 *         <SlotOption
 *           key={s.slot.start.toISOString()}
 *           suggestion={s}
 *           onSelect={() => schedule(s.slot)}
 *         />
 *       ))}
 *       {error && <Error message={error.message} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param taskId - ID of the task to manage
 * @param options - Optional configuration and callbacks
 * @returns UseTaskScheduleResult - Task scheduling state and actions
 */
export function useTaskSchedule(
  taskId: string,
  options: UseTaskScheduleOptions = {}
): UseTaskScheduleResult {
  const { task, onScheduled, onUnscheduled, onRescheduled } = options

  // State derived from task
  const [isScheduled, setIsScheduled] = useState(
    task ? Boolean(task.calendarEventId) : false
  )
  const [scheduledSlot, setScheduledSlot] = useState<TimeSlot | null>(() => {
    if (task?.scheduledStart && task?.scheduledEnd) {
      return {
        start: task.scheduledStart,
        end: task.scheduledEnd,
        available: false,
      }
    }
    return null
  })
  const [calendarEventId, setCalendarEventId] = useState<string | null>(
    task?.calendarEventId ?? null
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    task?.syncStatus ?? null
  )

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  // Operation state
  const [isOperating, setIsOperating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Refs for callbacks
  const onScheduledRef = useRef(onScheduled)
  const onUnscheduledRef = useRef(onUnscheduled)
  const onRescheduledRef = useRef(onRescheduled)

  // Keep refs updated
  useEffect(() => {
    onScheduledRef.current = onScheduled
    onUnscheduledRef.current = onUnscheduled
    onRescheduledRef.current = onRescheduled
  }, [onScheduled, onUnscheduled, onRescheduled])

  // Update state when task prop changes
  useEffect(() => {
    if (task) {
      setIsScheduled(Boolean(task.calendarEventId))
      if (task.scheduledStart && task.scheduledEnd) {
        setScheduledSlot({
          start: task.scheduledStart,
          end: task.scheduledEnd,
          available: false,
        })
      } else {
        setScheduledSlot(null)
      }
      setCalendarEventId(task.calendarEventId ?? null)
      setSyncStatus(task.syncStatus ?? null)
    }
  }, [task])

  // Computed loading state
  const isLoading = useMemo(
    () => isLoadingSuggestions || isOperating,
    [isLoadingSuggestions, isOperating]
  )

  /**
   * Load suggestions for this task
   */
  const loadSuggestions = useCallback(
    async (count?: number, dateRange?: { start: Date; end: Date }): Promise<void> => {
      setError(null)
      setIsLoadingSuggestions(true)

      try {
        const result = await getSuggestionsService({
          taskId,
          count,
          dateRange,
        })
        setSuggestions(result.suggestions)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load suggestions')
        setError(error)
        setSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    },
    [taskId]
  )

  /**
   * Schedule the task to a time slot
   */
  const schedule = useCallback(
    async (slot: TimeSlot, calendarId?: string): Promise<boolean> => {
      setError(null)
      setIsOperating(true)

      try {
        const result = await scheduleTaskService({
          taskId,
          slot,
          calendarId: calendarId || 'primary',
          includeBuffers: true,
        })

        if (result.success && result.calendarEventId) {
          setIsScheduled(true)
          setScheduledSlot(slot)
          setCalendarEventId(result.calendarEventId)
          setSyncStatus('synced')

          onScheduledRef.current?.(slot, result.calendarEventId)
        }

        return result.success
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to schedule task')
        setError(error)
        return false
      } finally {
        setIsOperating(false)
      }
    },
    [taskId]
  )

  /**
   * Unschedule the task
   */
  const unschedule = useCallback(async (): Promise<boolean> => {
    setError(null)
    setIsOperating(true)

    try {
      const result = await unscheduleTaskService(taskId)

      if (result.success) {
        setIsScheduled(false)
        setScheduledSlot(null)
        setCalendarEventId(null)
        setSyncStatus(null)

        onUnscheduledRef.current?.()
      }

      return result.success
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to unschedule task')
      setError(error)
      return false
    } finally {
      setIsOperating(false)
    }
  }, [taskId])

  /**
   * Reschedule the task to a new slot
   */
  const reschedule = useCallback(
    async (newSlot: TimeSlot): Promise<boolean> => {
      setError(null)
      setIsOperating(true)

      try {
        const result = await rescheduleTaskService({
          taskId,
          newSlot,
          updateBuffers: true,
        })

        if (result.success) {
          setScheduledSlot(newSlot)
          setSyncStatus('synced')

          onRescheduledRef.current?.(newSlot)
        }

        return result.success
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to reschedule task')
        setError(error)
        return false
      } finally {
        setIsOperating(false)
      }
    },
    [taskId]
  )

  return {
    // Current schedule state
    isScheduled,
    scheduledSlot,
    calendarEventId,
    syncStatus,

    // Suggestions
    suggestions,
    isLoadingSuggestions,
    loadSuggestions,

    // Actions
    schedule,
    unschedule,
    reschedule,

    // State
    isLoading,
    error,
  }
}
