/**
 * Hook that extends the approval flow with scheduling capabilities
 * Combines task approval with schedule proposal generation and confirmation
 * @module hooks/useApprovalWithScheduling
 */

import { useState, useCallback, useMemo } from 'react'
import type { Task, ParsedTask } from '@/types'
import {
  proposeSchedule as proposeScheduleService,
  type ScheduleProposal,
  type ProposeScheduleOptions,
} from '@/services/scheduling'
import { useScheduleProposal, type ApprovalState } from './useScheduleProposal'

/**
 * Approval state for a parsed task
 */
export interface TaskApprovalState {
  /** Whether this task is approved for creation */
  approved: boolean
  /** Whether the user has modified this from the default */
  modified: boolean
}

/**
 * Schedule approval state
 */
export interface ScheduleApprovalState {
  /** Task ID */
  taskId: string
  /** Whether this task should be scheduled */
  approved: boolean
  /** Index of the selected slot from suggestions */
  selectedSlotIndex: number
}

/**
 * Result type for the useApprovalWithScheduling hook
 */
export interface UseApprovalWithSchedulingResult {
  // From existing approval (task creation)
  /** Parsed tasks from brain dump */
  parsedTasks: ParsedTask[]
  /** Set parsed tasks */
  setParsedTasks: (tasks: ParsedTask[]) => void
  /** Task approval states */
  taskApprovals: Map<number, TaskApprovalState>
  /** Set approval for a task */
  setTaskApproval: (index: number, approved: boolean) => void
  /** Approve all tasks */
  approveAllTasks: () => void
  /** Reject all tasks */
  rejectAllTasks: () => void

  // Scheduling additions
  /** Schedule proposal for approved tasks */
  scheduleProposal: ScheduleProposal | null
  /** Whether a schedule proposal is being generated */
  isGeneratingSchedule: boolean
  /** Generate a schedule proposal for approved tasks */
  generateScheduleProposal: (createdTasks: Task[], options?: ProposeScheduleOptions) => Promise<void>
  /** Clear the schedule proposal */
  clearScheduleProposal: () => void

  // From useScheduleProposal
  /** Schedule approvals (from useScheduleProposal) */
  scheduleApprovals: Map<string, ApprovalState>
  /** Set schedule approval for a task */
  setScheduleApproval: (taskId: string, state: Partial<ApprovalState>) => void
  /** Approve all schedule suggestions */
  approveAllSchedules: () => void
  /** Reject all schedule suggestions */
  rejectAllSchedules: () => void
  /** Whether displacements are approved */
  displacementsApproved: boolean
  /** Set whether displacements are approved */
  setDisplacementsApproved: (approved: boolean) => void

  // Combined state
  /** Summary of task approvals */
  taskSummary: {
    total: number
    approved: number
    rejected: number
  }
  /** Summary of schedule approvals (from useScheduleProposal) */
  scheduleSummary: {
    totalTasks: number
    approved: number
    rejected: number
    pending: number
    hasDisplacements: boolean
    displacementCount: number
  }

  // Error handling
  /** Current error, if any */
  error: Error | null
  /** Clear the current error */
  clearError: () => void
}

/**
 * Hook that combines task approval with scheduling proposal
 * Used in the approval flow to allow users to approve tasks and schedule them
 *
 * @example
 * ```tsx
 * function ApprovalWithSchedulingScreen({ parsedTasks, onComplete }) {
 *   const {
 *     setParsedTasks,
 *     taskApprovals,
 *     setTaskApproval,
 *     approveAllTasks,
 *     taskSummary,
 *     scheduleProposal,
 *     isGeneratingSchedule,
 *     generateScheduleProposal,
 *     scheduleApprovals,
 *     setScheduleApproval,
 *     scheduleSummary,
 *   } = useApprovalWithScheduling();
 *
 *   useEffect(() => {
 *     setParsedTasks(parsedTasks);
 *   }, [parsedTasks, setParsedTasks]);
 *
 *   const handleCreateAndSchedule = async () => {
 *     // First create approved tasks
 *     const createdTasks = await createTasks(
 *       parsedTasks.filter((_, i) => taskApprovals.get(i)?.approved)
 *     );
 *
 *     // Then generate schedule proposal
 *     await generateScheduleProposal(createdTasks);
 *   };
 *
 *   return (
 *     <div>
 *       <TaskApprovalList
 *         tasks={parsedTasks}
 *         approvals={taskApprovals}
 *         onApprovalChange={setTaskApproval}
 *       />
 *
 *       <div>
 *         <button onClick={approveAllTasks}>Approve All</button>
 *         <span>{taskSummary.approved} / {taskSummary.total} tasks approved</span>
 *       </div>
 *
 *       <button onClick={handleCreateAndSchedule} disabled={isGeneratingSchedule}>
 *         {isGeneratingSchedule ? 'Generating Schedule...' : 'Create & Schedule'}
 *       </button>
 *
 *       {scheduleProposal && (
 *         <ScheduleProposalReview
 *           proposal={scheduleProposal}
 *           approvals={scheduleApprovals}
 *           onApprovalChange={setScheduleApproval}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns UseApprovalWithSchedulingResult - Combined approval and scheduling state
 */
export function useApprovalWithScheduling(): UseApprovalWithSchedulingResult {
  // Parsed tasks state
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
  const [taskApprovals, setTaskApprovals] = useState<Map<number, TaskApprovalState>>(new Map())

  // Scheduling state
  const [scheduleProposal, setScheduleProposal] = useState<ScheduleProposal | null>(null)
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Use the schedule proposal hook for managing schedule approvals
  const {
    approvals: scheduleApprovals,
    setApproval: setScheduleApproval,
    approveAll: approveAllSchedules,
    rejectAll: rejectAllSchedules,
    displacementsApproved,
    setDisplacementsApproved,
    summary: scheduleSummary,
  } = useScheduleProposal(scheduleProposal)

  /**
   * Set parsed tasks and initialize approvals
   */
  const handleSetParsedTasks = useCallback((tasks: ParsedTask[]): void => {
    setParsedTasks(tasks)

    // Initialize all tasks as approved by default
    const initialApprovals = new Map<number, TaskApprovalState>()
    tasks.forEach((_, index) => {
      initialApprovals.set(index, { approved: true, modified: false })
    })
    setTaskApprovals(initialApprovals)
  }, [])

  /**
   * Set approval for a single task
   */
  const setTaskApproval = useCallback((index: number, approved: boolean): void => {
    setTaskApprovals((prev) => {
      const newApprovals = new Map(prev)
      newApprovals.set(index, { approved, modified: true })
      return newApprovals
    })
  }, [])

  /**
   * Approve all tasks
   */
  const approveAllTasks = useCallback((): void => {
    setTaskApprovals(() => {
      const newApprovals = new Map<number, TaskApprovalState>()
      parsedTasks.forEach((_, index) => {
        newApprovals.set(index, { approved: true, modified: true })
      })
      return newApprovals
    })
  }, [parsedTasks])

  /**
   * Reject all tasks
   */
  const rejectAllTasks = useCallback((): void => {
    setTaskApprovals(() => {
      const newApprovals = new Map<number, TaskApprovalState>()
      parsedTasks.forEach((_, index) => {
        newApprovals.set(index, { approved: false, modified: true })
      })
      return newApprovals
    })
  }, [parsedTasks])

  /**
   * Generate a schedule proposal for created tasks
   */
  const generateScheduleProposal = useCallback(
    async (createdTasks: Task[], options?: ProposeScheduleOptions): Promise<void> => {
      if (createdTasks.length === 0) {
        return
      }

      setError(null)
      setIsGeneratingSchedule(true)

      try {
        const proposal = await proposeScheduleService({
          tasks: createdTasks,
          options,
        })
        setScheduleProposal(proposal)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to generate schedule')
        setError(error)
        setScheduleProposal(null)
      } finally {
        setIsGeneratingSchedule(false)
      }
    },
    []
  )

  /**
   * Clear the schedule proposal
   */
  const clearScheduleProposal = useCallback((): void => {
    setScheduleProposal(null)
  }, [])

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  /**
   * Calculate task approval summary
   */
  const taskSummary = useMemo(() => {
    let approved = 0
    let rejected = 0

    taskApprovals.forEach((state) => {
      if (state.approved) {
        approved++
      } else {
        rejected++
      }
    })

    return {
      total: parsedTasks.length,
      approved,
      rejected,
    }
  }, [parsedTasks, taskApprovals])

  return {
    // Task approval
    parsedTasks,
    setParsedTasks: handleSetParsedTasks,
    taskApprovals,
    setTaskApproval,
    approveAllTasks,
    rejectAllTasks,

    // Scheduling
    scheduleProposal,
    isGeneratingSchedule,
    generateScheduleProposal,
    clearScheduleProposal,

    // Schedule proposal management
    scheduleApprovals,
    setScheduleApproval,
    approveAllSchedules,
    rejectAllSchedules,
    displacementsApproved,
    setDisplacementsApproved,

    // Summaries
    taskSummary,
    scheduleSummary,

    // Error handling
    error,
    clearError,
  }
}
