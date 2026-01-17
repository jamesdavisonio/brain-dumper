/**
 * Schedule Proposal module
 * Generates scheduling proposals for user approval
 * @module scheduling/propose
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  Task,
  ScheduleProposal,
  ProposedSlot,
  UnschedulableTask,
  ProposalSummary,
  SchedulingTimeSlot,
  UserSchedulingPreferences,
} from '../types';
import { calculateAvailabilityInternal } from '../calendar/availability';
import { checkConflicts, comparePriorities } from './conflicts';
import { storeProposal } from './proposalStorage';
import { calculateBufferSlots } from './eventBuilder';

const db = admin.firestore();

/**
 * Parameters for proposeSchedule function
 */
interface ProposeScheduleParams {
  /** Tasks to schedule */
  tasks: Task[];
  /** Scheduling options */
  options?: {
    /** Whether to allow high-priority tasks to displace lower priority */
    respectPriority?: boolean;
    /** Whether to include buffer events */
    includeBuffers?: boolean;
    /** Preferred calendar ID for scheduling */
    preferredCalendarId?: string;
    /** Start date for scheduling range (ISO date string YYYY-MM-DD) */
    startDate?: string;
    /** End date for scheduling range (ISO date string YYYY-MM-DD) */
    endDate?: string;
  };
}

/**
 * Response from proposeSchedule function
 */
interface ProposeScheduleResponse {
  /** Whether the proposal was generated successfully */
  success: boolean;
  /** Proposal ID for reference in confirmation */
  proposalId?: string;
  /** The generated proposal */
  proposal?: ScheduleProposal;
  /** Error message if failed */
  error?: string;
}

/**
 * Get user's scheduling preferences from Firestore
 * @param userId - User's Firebase UID
 * @returns User scheduling preferences or defaults
 */
async function getUserPreferences(userId: string): Promise<UserSchedulingPreferences> {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  const defaults: UserSchedulingPreferences = {
    defaultCalendarId: 'primary',
    workingHours: { start: '09:00', end: '17:00' },
    workingDays: [1, 2, 3, 4, 5], // Monday to Friday
    timezone: 'UTC',
    autoScheduleEnabled: false,
    preferContiguousBlocks: true,
  };

  if (!userData?.schedulingPreferences) {
    return defaults;
  }

  return {
    ...defaults,
    ...userData.schedulingPreferences,
  };
}

/**
 * Get user's enabled calendar IDs
 * @param userId - User's Firebase UID
 * @returns Array of enabled calendar IDs
 */
async function getEnabledCalendarIds(userId: string): Promise<string[]> {
  const calendarsRef = db.collection(`users/${userId}/calendars`);
  const snapshot = await calendarsRef.where('enabled', '==', true).get();

  const calendarIds: string[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.id) {
      calendarIds.push(data.id);
    }
  });

  return calendarIds.length > 0 ? calendarIds : ['primary'];
}

/**
 * Sort tasks by priority (highest first) and due date
 * @param tasks - Tasks to sort
 * @returns Sorted tasks
 */
function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // First sort by priority (high > medium > low)
    const priorityDiff = comparePriorities(b.priority, a.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // Then by due date (earliest first)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Finally by creation date
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Find available slot for a task within the available windows
 * @param task - Task to schedule
 * @param availableSlots - Available time slots
 * @param usedSlots - Slots already used by other tasks in this proposal
 * @returns Available slot or null
 */
function findAvailableSlot(
  task: Task,
  availableSlots: Array<{ start: string; end: string }>,
  usedSlots: SchedulingTimeSlot[]
): SchedulingTimeSlot | null {
  const taskDuration = task.timeEstimate || 60; // Default 60 minutes

  for (const available of availableSlots) {
    const availStart = new Date(available.start);
    const availEnd = new Date(available.end);
    const availDuration = (availEnd.getTime() - availStart.getTime()) / (60 * 1000);

    // Skip if available slot is too short
    if (availDuration < taskDuration) {
      continue;
    }

    // Try to fit task in this available slot
    let slotStart = new Date(availStart);

    while (slotStart.getTime() + taskDuration * 60 * 1000 <= availEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + taskDuration * 60 * 1000);
      const proposedSlot: SchedulingTimeSlot = {
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      };

      // Check if this slot overlaps with any used slots
      const overlaps = usedSlots.some((used) => {
        const usedStart = new Date(used.start).getTime();
        const usedEnd = new Date(used.end).getTime();
        const propStart = slotStart.getTime();
        const propEnd = slotEnd.getTime();
        return propStart < usedEnd && propEnd > usedStart;
      });

      if (!overlaps) {
        return proposedSlot;
      }

      // Move to next 30-minute block
      slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
    }
  }

  return null;
}

/**
 * Callable function to generate a schedule proposal
 *
 * @example
 * const result = await proposeSchedule({
 *   tasks: [task1, task2],
 *   options: {
 *     respectPriority: true,
 *     includeBuffers: true
 *   }
 * });
 */
export const proposeSchedule = functions.https.onCall(
  async (data: ProposeScheduleParams, context): Promise<ProposeScheduleResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to propose schedule'
      );
    }

    const userId = context.auth.uid;
    const { tasks, options = {} } = data;

    // Validate input
    if (!tasks || tasks.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one task is required'
      );
    }

    const {
      respectPriority = true,
      includeBuffers = false,
      preferredCalendarId,
      startDate,
      endDate,
    } = options;

    try {
      // Get user preferences
      const preferences = await getUserPreferences(userId);
      const calendarIds = await getEnabledCalendarIds(userId);
      const targetCalendarId = preferredCalendarId || preferences.defaultCalendarId;

      // Calculate date range (default: next 7 days)
      const now = new Date();
      const rangeStart = startDate || now.toISOString().split('T')[0];
      const defaultEndDate = new Date(now);
      defaultEndDate.setDate(defaultEndDate.getDate() + 7);
      const rangeEnd = endDate || defaultEndDate.toISOString().split('T')[0];

      console.log(`Generating proposal for user ${userId}, ${tasks.length} tasks, ${rangeStart} to ${rangeEnd}`);

      // Get availability for the date range
      const availabilityResult = await calculateAvailabilityInternal(
        userId,
        rangeStart,
        rangeEnd,
        {
          calendarIds,
          workingHours: preferences.workingHours,
          timezone: preferences.timezone,
        }
      );

      if (!availabilityResult.success) {
        return {
          success: false,
          error: availabilityResult.error || 'Failed to calculate availability',
        };
      }

      // Collect all available slots
      const allAvailableSlots: Array<{ start: string; end: string }> = [];
      for (const day of availabilityResult.availability) {
        // Skip non-working days
        if (!preferences.workingDays.includes(day.dayOfWeek)) {
          continue;
        }
        allAvailableSlots.push(...day.availableSlots);
      }

      // Sort tasks by priority if respecting priority
      const sortedTasks = respectPriority ? sortTasksByPriority(tasks) : tasks;

      // Track used slots to avoid double-booking within the proposal
      const usedSlots: SchedulingTimeSlot[] = [];

      // Generate proposals
      const proposedSlots: ProposedSlot[] = [];
      const unschedulable: UnschedulableTask[] = [];

      for (const task of sortedTasks) {
        // Skip already scheduled tasks
        if (task.calendarEventId) {
          unschedulable.push({
            task,
            reason: 'Task is already scheduled on the calendar',
          });
          continue;
        }

        // Try to find an available slot
        const availableSlot = findAvailableSlot(task, allAvailableSlots, usedSlots);

        if (availableSlot) {
          // Calculate buffer slots if needed
          let totalSlot = availableSlot;
          if (includeBuffers) {
            const bufferBefore = task.bufferBefore || 0;
            const bufferAfter = task.bufferAfter || 0;
            const bufferSlots = calculateBufferSlots(availableSlot, bufferBefore, bufferAfter);

            // Adjust total slot to include buffers
            if (bufferSlots.beforeSlot) {
              totalSlot = {
                start: bufferSlots.beforeSlot.start,
                end: totalSlot.end,
              };
            }
            if (bufferSlots.afterSlot) {
              totalSlot = {
                start: totalSlot.start,
                end: bufferSlots.afterSlot.end,
              };
            }
          }

          // Check for conflicts at this slot
          const conflictResult = await checkConflicts(
            userId,
            task,
            availableSlot,
            calendarIds
          );

          // Add to proposed slots
          proposedSlots.push({
            task,
            slot: availableSlot,
            calendarId: targetCalendarId,
            conflicts: conflictResult.conflicts,
            displacements: conflictResult.displacements,
          });

          // Mark slot as used (including buffers)
          usedSlots.push(totalSlot);
        } else {
          // Could not find a slot
          unschedulable.push({
            task,
            reason: 'No available time slot found within the scheduling range',
          });
        }
      }

      // Calculate summary
      const summary: ProposalSummary = {
        totalTasks: tasks.length,
        scheduled: proposedSlots.length,
        conflicts: proposedSlots.reduce((sum, p) => sum + p.conflicts.length, 0),
        displacements: proposedSlots.reduce((sum, p) => sum + p.displacements.length, 0),
      };

      // Create proposal object (without id, userId, createdAt, expiresAt - those are added by storeProposal)
      const proposalData = {
        proposedSlots,
        unschedulable,
        summary,
        options: {
          respectPriority,
          includeBuffers,
          preferredCalendarId: targetCalendarId,
        },
      };

      // Store proposal
      const proposalId = await storeProposal(userId, proposalData);

      // Retrieve stored proposal for response
      const fullProposal: ScheduleProposal = {
        ...proposalData,
        id: proposalId,
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };

      console.log(`Generated proposal ${proposalId}: ${proposedSlots.length} scheduled, ${unschedulable.length} unschedulable`);

      return {
        success: true,
        proposalId,
        proposal: fullProposal,
      };
    } catch (error) {
      console.error(`Error generating proposal for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new functions.https.HttpsError('internal', `Failed to generate proposal: ${errorMessage}`);
    }
  }
);

/**
 * Internal function to generate a schedule proposal (for use by other server-side functions)
 *
 * @param userId - User's Firebase UID
 * @param tasks - Tasks to schedule
 * @param options - Scheduling options
 * @returns Schedule proposal or error
 */
export async function proposeScheduleInternal(
  userId: string,
  tasks: Task[],
  options: {
    respectPriority?: boolean;
    includeBuffers?: boolean;
    preferredCalendarId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<{ success: boolean; proposalId?: string; proposal?: ScheduleProposal; error?: string }> {
  const {
    respectPriority = true,
    includeBuffers = false,
    preferredCalendarId,
    startDate,
    endDate,
  } = options;

  try {
    const preferences = await getUserPreferences(userId);
    const calendarIds = await getEnabledCalendarIds(userId);
    const targetCalendarId = preferredCalendarId || preferences.defaultCalendarId;

    const now = new Date();
    const rangeStart = startDate || now.toISOString().split('T')[0];
    const defaultEndDate = new Date(now);
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    const rangeEnd = endDate || defaultEndDate.toISOString().split('T')[0];

    const availabilityResult = await calculateAvailabilityInternal(
      userId,
      rangeStart,
      rangeEnd,
      {
        calendarIds,
        workingHours: preferences.workingHours,
        timezone: preferences.timezone,
      }
    );

    if (!availabilityResult.success) {
      return {
        success: false,
        error: availabilityResult.error || 'Failed to calculate availability',
      };
    }

    const allAvailableSlots: Array<{ start: string; end: string }> = [];
    for (const day of availabilityResult.availability) {
      if (!preferences.workingDays.includes(day.dayOfWeek)) {
        continue;
      }
      allAvailableSlots.push(...day.availableSlots);
    }

    const sortedTasks = respectPriority ? sortTasksByPriority(tasks) : tasks;
    const usedSlots: SchedulingTimeSlot[] = [];
    const proposedSlots: ProposedSlot[] = [];
    const unschedulable: UnschedulableTask[] = [];

    for (const task of sortedTasks) {
      if (task.calendarEventId) {
        unschedulable.push({
          task,
          reason: 'Task is already scheduled on the calendar',
        });
        continue;
      }

      const availableSlot = findAvailableSlot(task, allAvailableSlots, usedSlots);

      if (availableSlot) {
        let totalSlot = availableSlot;
        if (includeBuffers) {
          const bufferBefore = task.bufferBefore || 0;
          const bufferAfter = task.bufferAfter || 0;
          const bufferSlots = calculateBufferSlots(availableSlot, bufferBefore, bufferAfter);

          if (bufferSlots.beforeSlot) {
            totalSlot = { start: bufferSlots.beforeSlot.start, end: totalSlot.end };
          }
          if (bufferSlots.afterSlot) {
            totalSlot = { start: totalSlot.start, end: bufferSlots.afterSlot.end };
          }
        }

        const conflictResult = await checkConflicts(userId, task, availableSlot, calendarIds);

        proposedSlots.push({
          task,
          slot: availableSlot,
          calendarId: targetCalendarId,
          conflicts: conflictResult.conflicts,
          displacements: conflictResult.displacements,
        });

        usedSlots.push(totalSlot);
      } else {
        unschedulable.push({
          task,
          reason: 'No available time slot found within the scheduling range',
        });
      }
    }

    const summary: ProposalSummary = {
      totalTasks: tasks.length,
      scheduled: proposedSlots.length,
      conflicts: proposedSlots.reduce((sum, p) => sum + p.conflicts.length, 0),
      displacements: proposedSlots.reduce((sum, p) => sum + p.displacements.length, 0),
    };

    const proposalData = {
      proposedSlots,
      unschedulable,
      summary,
      options: { respectPriority, includeBuffers, preferredCalendarId: targetCalendarId },
    };

    const proposalId = await storeProposal(userId, proposalData);

    const fullProposal: ScheduleProposal = {
      ...proposalData,
      id: proposalId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };

    return { success: true, proposalId, proposal: fullProposal };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to generate proposal: ${errorMessage}` };
  }
}
