/**
 * Scheduling service for interacting with Cloud Functions
 * Handles scheduling suggestions, proposals, and confirmations
 * @module services/scheduling
 */

import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import type { Task, TimeSlot, SchedulingSuggestion, SchedulingRule, Conflict } from '@/types'

/**
 * Parameters for getting scheduling suggestions
 */
export interface GetSuggestionsParams {
  /** ID of the task to get suggestions for */
  taskId: string
  /** Number of suggestions to return (default: 3) */
  count?: number
  /** Date range to look for available slots */
  dateRange?: { start: Date; end: Date }
}

/**
 * Response from getting scheduling suggestions
 */
export interface GetSuggestionsResponse {
  /** Array of scheduling suggestions */
  suggestions: SchedulingSuggestion[]
  /** The task that was analyzed */
  task: Task
  /** Scheduling rules that were applied */
  appliedRules: SchedulingRule[]
}

/**
 * Task assignment in a schedule proposal
 */
export interface ProposedAssignment {
  /** ID of the task */
  taskId: string
  /** The task details */
  task: Task
  /** Suggested time slots with scores */
  suggestions: SchedulingSuggestion[]
  /** Recommended slot index (best suggestion) */
  recommendedSlotIndex: number
}

/**
 * Existing event that would be displaced by scheduling
 */
export interface Displacement {
  /** ID of the event being displaced */
  eventId: string
  /** Title of the event being displaced */
  eventTitle: string
  /** Original time slot of the event */
  originalSlot: TimeSlot
  /** Proposed new time slot for the event */
  proposedSlot: TimeSlot
  /** Reason for the displacement */
  reason: string
}

/**
 * Schedule proposal containing all task assignments
 */
export interface ScheduleProposal {
  /** Unique ID for this proposal */
  id: string
  /** When this proposal was created */
  createdAt: Date
  /** When this proposal expires */
  expiresAt: Date
  /** Task assignments in this proposal */
  assignments: ProposedAssignment[]
  /** Events that would be displaced */
  displacements: Displacement[]
  /** Summary statistics */
  summary: {
    /** Total tasks in the proposal */
    totalTasks: number
    /** Tasks that could be scheduled */
    schedulableTasks: number
    /** Tasks with conflicts */
    conflictedTasks: number
    /** Total time scheduled in minutes */
    totalMinutes: number
  }
}

/**
 * Options for proposing a schedule
 */
export interface ProposeScheduleOptions {
  /** Whether to respect task priority when scheduling */
  respectPriority?: boolean
  /** Whether to include buffer times */
  includeBuffers?: boolean
  /** Preferred calendar ID for scheduling */
  preferredCalendarId?: string
}

/**
 * Parameters for proposing a schedule
 */
export interface ProposeScheduleParams {
  /** Tasks to include in the schedule */
  tasks: Task[]
  /** Scheduling options */
  options?: ProposeScheduleOptions
}

/**
 * Approval for a single task in a schedule confirmation
 */
export interface TaskApproval {
  /** ID of the task */
  taskId: string
  /** Index of the selected slot (from suggestions) */
  slotIndex: number
  /** Whether this task was confirmed */
  confirmed: boolean
}

/**
 * Parameters for confirming a schedule
 */
export interface ConfirmScheduleParams {
  /** ID of the proposal being confirmed */
  proposalId: string
  /** Approvals for each task */
  approved: TaskApproval[]
  /** Whether displacements are approved */
  displacementsApproved: boolean
}

/**
 * Result of a schedule confirmation
 */
export interface ConfirmResult {
  /** Whether the confirmation was successful */
  success: boolean
  /** Tasks that were scheduled */
  scheduledTasks: Array<{
    taskId: string
    calendarEventId: string
    slot: TimeSlot
  }>
  /** Tasks that failed to schedule */
  failedTasks: Array<{
    taskId: string
    error: string
  }>
  /** Displacements that were applied */
  appliedDisplacements: Displacement[]
}

/**
 * Parameters for quick scheduling a task
 */
export interface ScheduleTaskParams {
  /** ID of the task to schedule */
  taskId: string
  /** Time slot to schedule the task in */
  slot: TimeSlot
  /** Calendar ID to schedule on */
  calendarId: string
  /** Whether to include buffer times */
  includeBuffers?: boolean
  /** Whether to force schedule even with conflicts */
  force?: boolean
}

/**
 * Result of quick scheduling a task
 */
export interface ScheduleTaskResult {
  /** Whether the scheduling was successful */
  success: boolean
  /** ID of the created calendar event */
  calendarEventId?: string
  /** Any conflicts that were detected */
  conflicts?: Conflict[]
  /** Whether user approval is required before proceeding */
  requiresApproval?: boolean
}

/**
 * Parameters for rescheduling a task
 */
export interface RescheduleTaskParams {
  /** ID of the task to reschedule */
  taskId: string
  /** New time slot for the task */
  newSlot: TimeSlot
  /** Whether to update buffer events */
  updateBuffers?: boolean
}

/**
 * Result of rescheduling a task
 */
export interface RescheduleTaskResult {
  /** Whether the rescheduling was successful */
  success: boolean
  /** Any conflicts that were detected */
  conflicts?: Conflict[]
  /** Whether user approval is required before proceeding */
  requiresApproval?: boolean
}

/**
 * Result of unscheduling a task
 */
export interface UnscheduleTaskResult {
  /** Whether the unscheduling was successful */
  success: boolean
}

/**
 * Get scheduling suggestions for a task
 * Analyzes the task and available time slots to provide ranked suggestions
 *
 * @param params - Parameters including taskId and optional count/dateRange
 * @returns Promise resolving to suggestions, task, and applied rules
 *
 * @example
 * ```typescript
 * const { suggestions, task, appliedRules } = await getSuggestions({
 *   taskId: 'task-123',
 *   count: 5,
 *   dateRange: { start: new Date(), end: addDays(new Date(), 7) }
 * });
 * ```
 */
export async function getSuggestions(params: GetSuggestionsParams): Promise<GetSuggestionsResponse> {
  const callable = httpsCallable<GetSuggestionsParams, GetSuggestionsResponse>(
    functions,
    'getSchedulingSuggestions'
  )

  const result = await callable({
    taskId: params.taskId,
    count: params.count,
    dateRange: params.dateRange
      ? {
          start: params.dateRange.start,
          end: params.dateRange.end,
        }
      : undefined,
  })

  // Convert date strings back to Date objects
  return {
    ...result.data,
    suggestions: result.data.suggestions.map(normalizeSuggestion),
    appliedRules: result.data.appliedRules.map(normalizeRule),
  }
}

/**
 * Propose a schedule for multiple tasks (batch scheduling)
 * Analyzes all tasks and creates an optimal schedule proposal
 *
 * @param params - Parameters including tasks and scheduling options
 * @returns Promise resolving to a schedule proposal
 *
 * @example
 * ```typescript
 * const proposal = await proposeSchedule({
 *   tasks: [task1, task2, task3],
 *   options: {
 *     respectPriority: true,
 *     includeBuffers: true,
 *   }
 * });
 * ```
 */
export async function proposeSchedule(params: ProposeScheduleParams): Promise<ScheduleProposal> {
  const callable = httpsCallable<ProposeScheduleParams, ScheduleProposal>(
    functions,
    'proposeSchedule'
  )

  const result = await callable(params)

  // Convert date strings back to Date objects
  return normalizeProposal(result.data)
}

/**
 * Confirm an approved schedule proposal
 * Creates calendar events for approved tasks and applies displacements
 *
 * @param params - Parameters including proposalId, approvals, and displacement approval
 * @returns Promise resolving to confirmation result
 *
 * @example
 * ```typescript
 * const result = await confirmSchedule({
 *   proposalId: 'proposal-123',
 *   approved: [
 *     { taskId: 'task-1', slotIndex: 0, confirmed: true },
 *     { taskId: 'task-2', slotIndex: 1, confirmed: true },
 *   ],
 *   displacementsApproved: true,
 * });
 * ```
 */
export async function confirmSchedule(params: ConfirmScheduleParams): Promise<ConfirmResult> {
  const callable = httpsCallable<ConfirmScheduleParams, ConfirmResult>(
    functions,
    'confirmSchedule'
  )

  const result = await callable(params)

  // Normalize the result
  return {
    ...result.data,
    scheduledTasks: result.data.scheduledTasks.map((st) => ({
      ...st,
      slot: normalizeTimeSlot(st.slot),
    })),
    appliedDisplacements: result.data.appliedDisplacements.map(normalizeDisplacement),
  }
}

/**
 * Quick schedule a single task
 * Immediately schedules a task to a specific slot
 *
 * @param params - Parameters including taskId, slot, calendarId, and options
 * @returns Promise resolving to scheduling result
 *
 * @example
 * ```typescript
 * const result = await scheduleTask({
 *   taskId: 'task-123',
 *   slot: { start: new Date(), end: addHours(new Date(), 1), available: true },
 *   calendarId: 'calendar-abc',
 *   includeBuffers: true,
 * });
 * ```
 */
export async function scheduleTask(params: ScheduleTaskParams): Promise<ScheduleTaskResult> {
  const callable = httpsCallable<ScheduleTaskParams, ScheduleTaskResult>(
    functions,
    'scheduleTask'
  )

  const result = await callable(params)

  return result.data
}

/**
 * Unschedule a task
 * Removes the calendar event associated with a task
 *
 * @param taskId - ID of the task to unschedule
 * @returns Promise resolving to unschedule result
 *
 * @example
 * ```typescript
 * const { success } = await unscheduleTask('task-123');
 * ```
 */
export async function unscheduleTask(taskId: string): Promise<UnscheduleTaskResult> {
  const callable = httpsCallable<{ taskId: string }, UnscheduleTaskResult>(
    functions,
    'unscheduleTask'
  )

  const result = await callable({ taskId })

  return result.data
}

/**
 * Reschedule a task to a new time slot
 * Updates the calendar event to a new time
 *
 * @param params - Parameters including taskId, newSlot, and options
 * @returns Promise resolving to reschedule result
 *
 * @example
 * ```typescript
 * const result = await rescheduleTask({
 *   taskId: 'task-123',
 *   newSlot: { start: tomorrow9am, end: tomorrow10am, available: true },
 *   updateBuffers: true,
 * });
 * ```
 */
export async function rescheduleTask(params: RescheduleTaskParams): Promise<RescheduleTaskResult> {
  const callable = httpsCallable<RescheduleTaskParams, RescheduleTaskResult>(
    functions,
    'rescheduleTask'
  )

  const result = await callable(params)

  return result.data
}

// Helper functions to normalize date strings from Firebase

function normalizeTimeSlot(slot: TimeSlot): TimeSlot {
  return {
    ...slot,
    start: normalizeDate(slot.start),
    end: normalizeDate(slot.end),
  }
}

function normalizeSuggestion(suggestion: SchedulingSuggestion): SchedulingSuggestion {
  return {
    ...suggestion,
    slot: normalizeTimeSlot(suggestion.slot),
  }
}

function normalizeRule(rule: SchedulingRule): SchedulingRule {
  return {
    ...rule,
    createdAt: normalizeDate(rule.createdAt),
    updatedAt: normalizeDate(rule.updatedAt),
  }
}

function normalizeDisplacement(displacement: Displacement): Displacement {
  return {
    ...displacement,
    originalSlot: normalizeTimeSlot(displacement.originalSlot),
    proposedSlot: normalizeTimeSlot(displacement.proposedSlot),
  }
}

function normalizeAssignment(assignment: ProposedAssignment): ProposedAssignment {
  return {
    ...assignment,
    suggestions: assignment.suggestions.map(normalizeSuggestion),
  }
}

function normalizeProposal(proposal: ScheduleProposal): ScheduleProposal {
  return {
    ...proposal,
    createdAt: normalizeDate(proposal.createdAt),
    expiresAt: normalizeDate(proposal.expiresAt),
    assignments: proposal.assignments.map(normalizeAssignment),
    displacements: proposal.displacements.map(normalizeDisplacement),
  }
}

function normalizeDate(date: Date | string): Date {
  if (date instanceof Date) {
    return date
  }
  return new Date(date)
}
