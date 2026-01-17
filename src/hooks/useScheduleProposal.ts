/**
 * Hook for managing schedule proposal approval flow
 * Provides state management for approving/rejecting tasks and displacements
 * @module hooks/useScheduleProposal
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  confirmSchedule as confirmScheduleService,
  type ScheduleProposal,
  type ConfirmResult,
  type TaskApproval,
} from '@/services/scheduling'

/**
 * Approval state for a single task in a proposal
 */
export interface ApprovalState {
  /** Whether this task is approved for scheduling */
  approved: boolean
  /** Index of the selected slot from suggestions */
  selectedSlotIndex: number
  /** Whether the user has modified this from the default */
  modified: boolean
}

/**
 * Summary of the current approval state
 */
export interface ApprovalSummary {
  /** Total number of tasks in the proposal */
  totalTasks: number
  /** Number of approved tasks */
  approved: number
  /** Number of rejected tasks */
  rejected: number
  /** Number of tasks pending decision */
  pending: number
  /** Whether there are any displacements */
  hasDisplacements: boolean
  /** Number of displacements */
  displacementCount: number
}

/**
 * Result type for the useScheduleProposal hook
 */
export interface UseScheduleProposalResult {
  /** The current proposal being reviewed */
  proposal: ScheduleProposal | null

  // Approval state
  /** Map of task approvals by taskId */
  approvals: Map<string, ApprovalState>
  /** Set the approval state for a task */
  setApproval: (taskId: string, state: Partial<ApprovalState>) => void
  /** Approve all tasks with their recommended slots */
  approveAll: () => void
  /** Reject all tasks */
  rejectAll: () => void

  // Displacement handling
  /** Whether displacements are approved */
  displacementsApproved: boolean
  /** Set whether displacements are approved */
  setDisplacementsApproved: (approved: boolean) => void

  // Summary
  /** Summary of the current approval state */
  summary: ApprovalSummary

  // Actions
  /** Confirm the schedule with current approvals */
  confirm: () => Promise<ConfirmResult>
  /** Whether a confirmation is in progress */
  isConfirming: boolean

  // Validation
  /** Whether the proposal can be confirmed (at least one task approved) */
  canConfirm: boolean
  /** List of validation errors */
  validationErrors: string[]
}

/**
 * Hook for managing schedule proposal approval flow
 * Tracks approval state for each task and provides actions for batch operations
 *
 * @example
 * ```tsx
 * function ApprovalScreen() {
 *   const { proposal } = useScheduling();
 *   const {
 *     approvals,
 *     setApproval,
 *     approveAll,
 *     rejectAll,
 *     summary,
 *     confirm,
 *     canConfirm,
 *     isConfirming,
 *   } = useScheduleProposal(proposal);
 *
 *   return (
 *     <div>
 *       <div>
 *         {summary.approved} approved / {summary.totalTasks} total
 *       </div>
 *
 *       {proposal?.assignments.map(assignment => {
 *         const approval = approvals.get(assignment.taskId);
 *         return (
 *           <TaskApprovalRow
 *             key={assignment.taskId}
 *             assignment={assignment}
 *             approval={approval}
 *             onApprove={() => setApproval(assignment.taskId, { approved: true })}
 *             onReject={() => setApproval(assignment.taskId, { approved: false })}
 *           />
 *         );
 *       })}
 *
 *       <div>
 *         <button onClick={approveAll}>Approve All</button>
 *         <button onClick={rejectAll}>Reject All</button>
 *       </div>
 *
 *       <button onClick={confirm} disabled={!canConfirm || isConfirming}>
 *         {isConfirming ? 'Confirming...' : 'Confirm Schedule'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param proposal - The schedule proposal to manage approvals for
 * @returns UseScheduleProposalResult - Approval state and actions
 */
export function useScheduleProposal(
  proposal: ScheduleProposal | null
): UseScheduleProposalResult {
  // State
  const [approvals, setApprovals] = useState<Map<string, ApprovalState>>(new Map())
  const [displacementsApproved, setDisplacementsApproved] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  /**
   * Initialize approvals when proposal changes
   * Default: all tasks approved with recommended slot
   */
  useEffect(() => {
    if (!proposal) {
      setApprovals(new Map())
      setDisplacementsApproved(false)
      return
    }

    const initialApprovals = new Map<string, ApprovalState>()
    for (const assignment of proposal.assignments) {
      initialApprovals.set(assignment.taskId, {
        approved: true, // Default to approved
        selectedSlotIndex: assignment.recommendedSlotIndex,
        modified: false,
      })
    }
    setApprovals(initialApprovals)

    // Default displacements to not approved (require explicit approval)
    setDisplacementsApproved(false)
  }, [proposal])

  /**
   * Set approval state for a single task
   */
  const setApproval = useCallback(
    (taskId: string, state: Partial<ApprovalState>): void => {
      setApprovals((prev) => {
        const newApprovals = new Map(prev)
        const current = prev.get(taskId)
        if (current) {
          newApprovals.set(taskId, {
            ...current,
            ...state,
            modified: true,
          })
        }
        return newApprovals
      })
    },
    []
  )

  /**
   * Approve all tasks with their recommended slots
   */
  const approveAll = useCallback((): void => {
    if (!proposal) return

    setApprovals((prev) => {
      const newApprovals = new Map<string, ApprovalState>()
      for (const assignment of proposal.assignments) {
        const current = prev.get(assignment.taskId)
        newApprovals.set(assignment.taskId, {
          approved: true,
          selectedSlotIndex: current?.selectedSlotIndex ?? assignment.recommendedSlotIndex,
          modified: true,
        })
      }
      return newApprovals
    })
  }, [proposal])

  /**
   * Reject all tasks
   */
  const rejectAll = useCallback((): void => {
    if (!proposal) return

    setApprovals((prev) => {
      const newApprovals = new Map<string, ApprovalState>()
      for (const assignment of proposal.assignments) {
        const current = prev.get(assignment.taskId)
        newApprovals.set(assignment.taskId, {
          approved: false,
          selectedSlotIndex: current?.selectedSlotIndex ?? assignment.recommendedSlotIndex,
          modified: true,
        })
      }
      return newApprovals
    })
  }, [proposal])

  /**
   * Calculate summary statistics
   */
  const summary = useMemo((): ApprovalSummary => {
    if (!proposal) {
      return {
        totalTasks: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        hasDisplacements: false,
        displacementCount: 0,
      }
    }

    let approved = 0
    let rejected = 0
    let pending = 0

    for (const assignment of proposal.assignments) {
      const approval = approvals.get(assignment.taskId)
      if (!approval) {
        pending++
      } else if (approval.approved) {
        approved++
      } else {
        rejected++
      }
    }

    return {
      totalTasks: proposal.assignments.length,
      approved,
      rejected,
      pending,
      hasDisplacements: proposal.displacements.length > 0,
      displacementCount: proposal.displacements.length,
    }
  }, [proposal, approvals])

  /**
   * Validation errors
   */
  const validationErrors = useMemo((): string[] => {
    const errors: string[] = []

    if (!proposal) {
      errors.push('No proposal to confirm')
      return errors
    }

    if (summary.approved === 0) {
      errors.push('At least one task must be approved')
    }

    if (summary.hasDisplacements && !displacementsApproved) {
      errors.push('Displacements must be approved or tasks causing them must be rejected')
    }

    return errors
  }, [proposal, summary, displacementsApproved])

  /**
   * Whether the proposal can be confirmed
   */
  const canConfirm = useMemo((): boolean => {
    if (!proposal) return false
    if (summary.approved === 0) return false
    if (summary.hasDisplacements && !displacementsApproved) {
      // Check if any approved task causes a displacement
      // For now, just require displacement approval if there are any displacements
      // and at least one task is approved
      return false
    }
    return true
  }, [proposal, summary, displacementsApproved])

  /**
   * Confirm the schedule with current approvals
   */
  const confirm = useCallback(async (): Promise<ConfirmResult> => {
    if (!proposal) {
      throw new Error('No proposal to confirm')
    }

    if (!canConfirm) {
      throw new Error('Cannot confirm: ' + validationErrors.join(', '))
    }

    setIsConfirming(true)

    try {
      // Convert approvals map to array of TaskApproval
      const taskApprovals: TaskApproval[] = []
      for (const [taskId, state] of approvals) {
        taskApprovals.push({
          taskId,
          slotIndex: state.selectedSlotIndex,
          confirmed: state.approved,
        })
      }

      const result = await confirmScheduleService({
        proposalId: proposal.id,
        approved: taskApprovals,
        displacementsApproved,
      })

      return result
    } finally {
      setIsConfirming(false)
    }
  }, [proposal, canConfirm, validationErrors, approvals, displacementsApproved])

  return {
    proposal,

    // Approval state
    approvals,
    setApproval,
    approveAll,
    rejectAll,

    // Displacement handling
    displacementsApproved,
    setDisplacementsApproved,

    // Summary
    summary,

    // Actions
    confirm,
    isConfirming,

    // Validation
    canConfirm,
    validationErrors,
  }
}
