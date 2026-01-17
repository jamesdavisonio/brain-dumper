/**
 * Main hook for scheduling operations
 * Provides suggestions, proposals, confirmations, and quick actions for scheduling tasks
 * @module hooks/useScheduling
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import type { Task, TimeSlot, SchedulingSuggestion } from '@/types'
import {
  getSuggestions as getSuggestionsService,
  proposeSchedule as proposeScheduleService,
  confirmSchedule as confirmScheduleService,
  scheduleTask as scheduleTaskService,
  unscheduleTask as unscheduleTaskService,
  rescheduleTask as rescheduleTaskService,
  type ScheduleProposal,
  type ConfirmResult,
  type ProposeScheduleOptions,
  type TaskApproval,
} from '@/services/scheduling'

/**
 * Approval decision for a task in a schedule proposal
 */
export interface ApprovalDecision {
  /** ID of the task being approved/rejected */
  taskId: string
  /** Whether the task is approved for scheduling */
  approved: boolean
  /** Index of the selected suggestion slot */
  selectedSlotIndex?: number
}

/**
 * Selected slot for UI state management
 */
export interface SelectedSlot {
  /** ID of the task this slot is for */
  taskId: string
  /** The selected time slot */
  slot: TimeSlot
}

/**
 * Result type for the useScheduling hook
 */
export interface UseSchedulingResult {
  // Suggestions
  /** Current suggestions for the active task */
  suggestions: SchedulingSuggestion[]
  /** Whether suggestions are being loaded */
  isLoadingSuggestions: boolean
  /** Get suggestions for a specific task */
  getSuggestions: (taskId: string, count?: number, dateRange?: { start: Date; end: Date }) => Promise<void>
  /** Clear current suggestions */
  clearSuggestions: () => void

  // Proposal (for batch scheduling)
  /** Current schedule proposal */
  proposal: ScheduleProposal | null
  /** Whether a proposal is being generated */
  isProposing: boolean
  /** Generate a schedule proposal for tasks */
  proposeSchedule: (tasks: Task[], options?: ProposeScheduleOptions) => Promise<void>
  /** Clear the current proposal */
  clearProposal: () => void

  // Confirmation
  /** Whether a confirmation is in progress */
  isConfirming: boolean
  /** Confirm a schedule proposal with approvals */
  confirmSchedule: (approvals: ApprovalDecision[], displacementsApproved?: boolean) => Promise<ConfirmResult>

  // Quick actions
  /** Quick schedule a single task to a slot */
  scheduleTask: (taskId: string, slot: TimeSlot, calendarId?: string) => Promise<boolean>
  /** Unschedule a task */
  unscheduleTask: (taskId: string) => Promise<boolean>
  /** Reschedule a task to a new slot */
  rescheduleTask: (taskId: string, newSlot: TimeSlot) => Promise<boolean>

  // State
  /** Whether any scheduling operation is in progress */
  isScheduling: boolean
  /** Current error, if any */
  error: Error | null
  /** Clear the current error */
  clearError: () => void

  // Selected slot for UI
  /** Currently selected slot for a task */
  selectedSlot: SelectedSlot | null
  /** Select a slot for a task */
  selectSlot: (taskId: string, slot: TimeSlot) => void
  /** Clear the selected slot */
  clearSelectedSlot: () => void
}

/**
 * Cache entry for suggestions
 */
interface SuggestionsCacheEntry {
  suggestions: SchedulingSuggestion[]
  timestamp: number
}

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000

/**
 * Hook for managing scheduling operations
 * Provides a comprehensive API for scheduling tasks, including suggestions,
 * batch proposals, confirmations, and quick actions.
 *
 * @example
 * ```tsx
 * function SchedulingPanel() {
 *   const {
 *     suggestions,
 *     isLoadingSuggestions,
 *     getSuggestions,
 *     scheduleTask,
 *     error,
 *   } = useScheduling();
 *
 *   const handleTaskClick = async (taskId: string) => {
 *     await getSuggestions(taskId);
 *   };
 *
 *   const handleSlotSelect = async (taskId: string, slot: TimeSlot) => {
 *     const success = await scheduleTask(taskId, slot);
 *     if (success) {
 *       console.log('Task scheduled!');
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {isLoadingSuggestions && <Spinner />}
 *       {suggestions.map(s => (
 *         <SlotOption key={s.slot.start.toISOString()} suggestion={s} />
 *       ))}
 *       {error && <Error message={error.message} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns UseSchedulingResult - Scheduling state and actions
 */
export function useScheduling(): UseSchedulingResult {
  // State
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null)
  const [isProposing, setIsProposing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isQuickScheduling, setIsQuickScheduling] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)

  // Suggestions cache
  const suggestionsCache = useRef<Map<string, SuggestionsCacheEntry>>(new Map())

  // Computed state
  const isScheduling = useMemo(
    () => isLoadingSuggestions || isProposing || isConfirming || isQuickScheduling,
    [isLoadingSuggestions, isProposing, isConfirming, isQuickScheduling]
  )

  /**
   * Generate a cache key for suggestions
   */
  const generateCacheKey = useCallback(
    (taskId: string, count?: number, dateRange?: { start: Date; end: Date }): string => {
      const parts = [taskId]
      if (count !== undefined) parts.push(`c:${count}`)
      if (dateRange) {
        parts.push(`s:${dateRange.start.toISOString()}`)
        parts.push(`e:${dateRange.end.toISOString()}`)
      }
      return parts.join('|')
    },
    []
  )

  /**
   * Check if cache entry is still valid
   */
  const isCacheValid = useCallback((entry: SuggestionsCacheEntry): boolean => {
    return Date.now() - entry.timestamp < CACHE_TTL
  }, [])

  /**
   * Get suggestions for a task
   */
  const getSuggestions = useCallback(
    async (
      taskId: string,
      count?: number,
      dateRange?: { start: Date; end: Date }
    ): Promise<void> => {
      setError(null)

      // Check cache first
      const cacheKey = generateCacheKey(taskId, count, dateRange)
      const cached = suggestionsCache.current.get(cacheKey)
      if (cached && isCacheValid(cached)) {
        setSuggestions(cached.suggestions)
        return
      }

      setIsLoadingSuggestions(true)

      try {
        const result = await getSuggestionsService({
          taskId,
          count,
          dateRange,
        })

        setSuggestions(result.suggestions)

        // Update cache
        suggestionsCache.current.set(cacheKey, {
          suggestions: result.suggestions,
          timestamp: Date.now(),
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to get suggestions')
        setError(error)
        setSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    },
    [generateCacheKey, isCacheValid]
  )

  /**
   * Clear current suggestions
   */
  const clearSuggestions = useCallback((): void => {
    setSuggestions([])
  }, [])

  /**
   * Propose a schedule for multiple tasks
   */
  const proposeSchedule = useCallback(
    async (tasks: Task[], options?: ProposeScheduleOptions): Promise<void> => {
      if (tasks.length === 0) {
        return
      }

      setError(null)
      setIsProposing(true)

      try {
        const result = await proposeScheduleService({ tasks, options })
        setProposal(result)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to propose schedule')
        setError(error)
        setProposal(null)
      } finally {
        setIsProposing(false)
      }
    },
    []
  )

  /**
   * Clear the current proposal
   */
  const clearProposal = useCallback((): void => {
    setProposal(null)
  }, [])

  /**
   * Confirm a schedule proposal
   */
  const confirmSchedule = useCallback(
    async (
      approvals: ApprovalDecision[],
      displacementsApproved = false
    ): Promise<ConfirmResult> => {
      if (!proposal) {
        throw new Error('No proposal to confirm')
      }

      setError(null)
      setIsConfirming(true)

      try {
        // Convert ApprovalDecision to TaskApproval format
        const taskApprovals: TaskApproval[] = approvals.map((a) => ({
          taskId: a.taskId,
          slotIndex: a.selectedSlotIndex ?? 0,
          confirmed: a.approved,
        }))

        const result = await confirmScheduleService({
          proposalId: proposal.id,
          approved: taskApprovals,
          displacementsApproved,
        })

        // Clear proposal on success
        if (result.success) {
          setProposal(null)
        }

        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to confirm schedule')
        setError(error)
        throw error
      } finally {
        setIsConfirming(false)
      }
    },
    [proposal]
  )

  /**
   * Quick schedule a single task
   */
  const scheduleTask = useCallback(
    async (taskId: string, slot: TimeSlot, calendarId?: string): Promise<boolean> => {
      setError(null)
      setIsQuickScheduling(true)

      try {
        const result = await scheduleTaskService({
          taskId,
          slot,
          calendarId: calendarId || 'primary',
          includeBuffers: true,
        })

        // Invalidate suggestions cache for this task
        const keysToDelete: string[] = []
        suggestionsCache.current.forEach((_, key) => {
          if (key.startsWith(taskId)) {
            keysToDelete.push(key)
          }
        })
        keysToDelete.forEach((key) => suggestionsCache.current.delete(key))

        return result.success
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to schedule task')
        setError(error)
        return false
      } finally {
        setIsQuickScheduling(false)
      }
    },
    []
  )

  /**
   * Unschedule a task
   */
  const unscheduleTask = useCallback(async (taskId: string): Promise<boolean> => {
    setError(null)
    setIsQuickScheduling(true)

    try {
      const result = await unscheduleTaskService(taskId)

      // Invalidate suggestions cache for this task
      const keysToDelete: string[] = []
      suggestionsCache.current.forEach((_, key) => {
        if (key.startsWith(taskId)) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach((key) => suggestionsCache.current.delete(key))

      return result.success
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to unschedule task')
      setError(error)
      return false
    } finally {
      setIsQuickScheduling(false)
    }
  }, [])

  /**
   * Reschedule a task to a new slot
   */
  const rescheduleTask = useCallback(
    async (taskId: string, newSlot: TimeSlot): Promise<boolean> => {
      setError(null)
      setIsQuickScheduling(true)

      try {
        const result = await rescheduleTaskService({
          taskId,
          newSlot,
          updateBuffers: true,
        })

        // Invalidate suggestions cache for this task
        const keysToDelete: string[] = []
        suggestionsCache.current.forEach((_, key) => {
          if (key.startsWith(taskId)) {
            keysToDelete.push(key)
          }
        })
        keysToDelete.forEach((key) => suggestionsCache.current.delete(key))

        return result.success
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to reschedule task')
        setError(error)
        return false
      } finally {
        setIsQuickScheduling(false)
      }
    },
    []
  )

  /**
   * Clear the current error
   */
  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  /**
   * Select a slot for a task
   */
  const selectSlot = useCallback((taskId: string, slot: TimeSlot): void => {
    setSelectedSlot({ taskId, slot })
  }, [])

  /**
   * Clear the selected slot
   */
  const clearSelectedSlot = useCallback((): void => {
    setSelectedSlot(null)
  }, [])

  return {
    // Suggestions
    suggestions,
    isLoadingSuggestions,
    getSuggestions,
    clearSuggestions,

    // Proposal
    proposal,
    isProposing,
    proposeSchedule,
    clearProposal,

    // Confirmation
    isConfirming,
    confirmSchedule,

    // Quick actions
    scheduleTask,
    unscheduleTask,
    rescheduleTask,

    // State
    isScheduling,
    error,
    clearError,

    // Selected slot
    selectedSlot,
    selectSlot,
    clearSelectedSlot,
  }
}
