/**
 * Reschedule Task module
 * Moves tasks to a new time on Google Calendar
 * @module scheduling/reschedule
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Task, SchedulingTimeSlot, Conflict } from '../types';
import { getCalendarClientOrThrow } from '../calendar/client';
import { buildBufferEvent } from './eventBuilder';
import { checkConflicts } from './conflicts';

const db = admin.firestore();

/**
 * Parameters for rescheduleTask function
 */
interface RescheduleTaskParams {
  /** Task ID to reschedule */
  taskId: string;
  /** New time slot for the task */
  newSlot: SchedulingTimeSlot;
  /** Whether to update buffer events */
  updateBuffers?: boolean;
  /** Skip conflict checking (force reschedule) */
  force?: boolean;
  /** Timezone for the event (IANA format) */
  timezone?: string;
}

/**
 * Response from rescheduleTask function
 */
interface RescheduleTaskResponse {
  /** Whether the rescheduling was successful */
  success: boolean;
  /** Conflicts if any (only if requiresApproval is true) */
  conflicts?: Conflict[];
  /** Whether user approval is required */
  requiresApproval?: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Get task from Firestore
 */
async function getTask(taskId: string): Promise<Task | null> {
  const taskDoc = await db.collection('tasks').doc(taskId).get();
  if (!taskDoc.exists) {
    return null;
  }
  return { id: taskDoc.id, ...taskDoc.data() } as Task;
}

/**
 * Update task's scheduling info in Firestore
 */
async function updateTaskSchedulingInfo(
  taskId: string,
  slot: SchedulingTimeSlot,
  bufferEventIds?: {
    bufferBeforeEventId?: string | null;
    bufferAfterEventId?: string | null;
  }
): Promise<void> {
  const taskRef = db.collection('tasks').doc(taskId);
  const updates: any = {
    scheduledStart: slot.start,
    scheduledEnd: slot.end,
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
  };

  if (bufferEventIds) {
    if (bufferEventIds.bufferBeforeEventId !== undefined) {
      updates.bufferBeforeEventId = bufferEventIds.bufferBeforeEventId;
    }
    if (bufferEventIds.bufferAfterEventId !== undefined) {
      updates.bufferAfterEventId = bufferEventIds.bufferAfterEventId;
    }
  }

  await taskRef.update(updates);
}

/**
 * Delete calendar event, ignoring 404 errors
 */
async function deleteCalendarEvent(
  calendar: any,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (error: any) {
    if (error.code === 404 || error.response?.status === 404) {
      return true;
    }
    throw error;
  }
}

/**
 * Callable function to reschedule a task (move to a new time)
 *
 * @example
 * const result = await rescheduleTask({
 *   taskId: 'task123',
 *   newSlot: { start: '2024-01-15T14:00:00Z', end: '2024-01-15T15:00:00Z' }
 * });
 */
export const rescheduleTask = functions.https.onCall(
  async (data: RescheduleTaskParams, context): Promise<RescheduleTaskResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to reschedule a task'
      );
    }

    const userId = context.auth.uid;
    const {
      taskId,
      newSlot,
      updateBuffers = true,
      force = false,
      timezone = 'UTC',
    } = data;

    // Validate input
    if (!taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Task ID is required'
      );
    }

    if (!newSlot || !newSlot.start || !newSlot.end) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Valid new time slot is required'
      );
    }

    try {
      // Get the task
      const task = await getTask(taskId);

      if (!task) {
        return {
          success: false,
          error: 'Task not found',
        };
      }

      // Verify task belongs to user
      if (task.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to reschedule this task'
        );
      }

      // Check if task is scheduled
      if (!task.calendarEventId) {
        return {
          success: false,
          error: 'Task is not scheduled. Use scheduleTask to add it to the calendar.',
        };
      }

      const calendarId = task.calendarId || 'primary';

      // Check for conflicts at new time unless force is true
      if (!force) {
        const conflictResult = await checkConflicts(
          userId,
          task,
          newSlot,
          [calendarId]
        );

        // Exclude the task's own event from conflicts
        const realConflicts = conflictResult.conflicts.filter(
          (c) => c.brainDumperTaskId !== taskId
        );

        if (realConflicts.length > 0) {
          return {
            success: false,
            conflicts: realConflicts,
            requiresApproval: true,
            error: 'New time slot has conflicts. Use force=true to override.',
          };
        }
      }

      console.log(`Rescheduling task ${taskId} for user ${userId}`);

      // Get calendar client
      const calendar = await getCalendarClientOrThrow(userId);

      // Update the main event
      await calendar.events.patch({
        calendarId,
        eventId: task.calendarEventId,
        requestBody: {
          start: {
            dateTime: newSlot.start,
            timeZone: timezone,
          },
          end: {
            dateTime: newSlot.end,
            timeZone: timezone,
          },
        },
      });

      console.log(`Updated main event ${task.calendarEventId}`);

      // Handle buffer events
      const taskData = task as any;
      let newBufferBeforeEventId: string | null = taskData.bufferBeforeEventId || null;
      let newBufferAfterEventId: string | null = taskData.bufferAfterEventId || null;

      if (updateBuffers) {
        const bufferBefore = task.bufferBefore || 0;
        const bufferAfter = task.bufferAfter || 0;

        // Delete old buffer events
        if (taskData.bufferBeforeEventId) {
          try {
            await deleteCalendarEvent(calendar, calendarId, taskData.bufferBeforeEventId);
            console.log(`Deleted old before buffer event`);
            newBufferBeforeEventId = null;
          } catch (e) {
            console.error('Failed to delete old before buffer:', e);
          }
        }

        if (taskData.bufferAfterEventId) {
          try {
            await deleteCalendarEvent(calendar, calendarId, taskData.bufferAfterEventId);
            console.log(`Deleted old after buffer event`);
            newBufferAfterEventId = null;
          } catch (e) {
            console.error('Failed to delete old after buffer:', e);
          }
        }

        // Create new buffer events if configured
        if (bufferBefore > 0) {
          try {
            const bufferBeforePayload = buildBufferEvent(
              task,
              'before',
              bufferBefore,
              new Date(newSlot.start),
              calendarId,
              timezone
            );

            const bufferBeforeResponse = await calendar.events.insert({
              calendarId,
              requestBody: bufferBeforePayload,
            });

            newBufferBeforeEventId = bufferBeforeResponse.data.id || null;
            console.log(`Created new before buffer event ${newBufferBeforeEventId}`);
          } catch (bufferError) {
            console.error('Failed to create new before buffer:', bufferError);
          }
        }

        if (bufferAfter > 0) {
          try {
            const bufferAfterPayload = buildBufferEvent(
              task,
              'after',
              bufferAfter,
              new Date(newSlot.end),
              calendarId,
              timezone
            );

            const bufferAfterResponse = await calendar.events.insert({
              calendarId,
              requestBody: bufferAfterPayload,
            });

            newBufferAfterEventId = bufferAfterResponse.data.id || null;
            console.log(`Created new after buffer event ${newBufferAfterEventId}`);
          } catch (bufferError) {
            console.error('Failed to create new after buffer:', bufferError);
          }
        }
      }

      // Update task in Firestore
      await updateTaskSchedulingInfo(taskId, newSlot, {
        bufferBeforeEventId: newBufferBeforeEventId,
        bufferAfterEventId: newBufferAfterEventId,
      });

      console.log(`Task ${taskId} rescheduled successfully`);

      return {
        success: true,
      };
    } catch (error) {
      console.error(`Error rescheduling task ${taskId} for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error types
      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired or revoked')
      ) {
        return {
          success: false,
          error: 'Calendar access has been revoked. Please reconnect your calendar.',
        };
      }

      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        return {
          success: false,
          error: 'Calendar event not found. The task may have been unscheduled externally.',
        };
      }

      throw new functions.https.HttpsError('internal', `Failed to reschedule task: ${errorMessage}`);
    }
  }
);

/**
 * Internal function to reschedule a task (for use by other server-side functions)
 *
 * @param userId - User's Firebase UID
 * @param taskId - Task ID to reschedule
 * @param newSlot - New time slot
 * @param options - Additional options
 * @returns Reschedule result
 */
export async function rescheduleTaskInternal(
  userId: string,
  taskId: string,
  newSlot: SchedulingTimeSlot,
  options: {
    updateBuffers?: boolean;
    force?: boolean;
    timezone?: string;
  } = {}
): Promise<RescheduleTaskResponse> {
  const { updateBuffers = true, force = false, timezone = 'UTC' } = options;

  try {
    const task = await getTask(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.userId !== userId) {
      return { success: false, error: 'Permission denied' };
    }

    if (!task.calendarEventId) {
      return { success: false, error: 'Task is not scheduled' };
    }

    const calendarId = task.calendarId || 'primary';

    if (!force) {
      const conflictResult = await checkConflicts(userId, task, newSlot, [calendarId]);
      const realConflicts = conflictResult.conflicts.filter(
        (c) => c.brainDumperTaskId !== taskId
      );

      if (realConflicts.length > 0) {
        return {
          success: false,
          conflicts: realConflicts,
          requiresApproval: true,
          error: 'New time slot has conflicts',
        };
      }
    }

    const calendar = await getCalendarClientOrThrow(userId);

    // Update main event
    await calendar.events.patch({
      calendarId,
      eventId: task.calendarEventId,
      requestBody: {
        start: { dateTime: newSlot.start, timeZone: timezone },
        end: { dateTime: newSlot.end, timeZone: timezone },
      },
    });

    const taskData = task as any;
    let newBufferBeforeEventId: string | null = taskData.bufferBeforeEventId || null;
    let newBufferAfterEventId: string | null = taskData.bufferAfterEventId || null;

    if (updateBuffers) {
      const bufferBefore = task.bufferBefore || 0;
      const bufferAfter = task.bufferAfter || 0;

      // Delete old buffers
      if (taskData.bufferBeforeEventId) {
        try {
          await deleteCalendarEvent(calendar, calendarId, taskData.bufferBeforeEventId);
          newBufferBeforeEventId = null;
        } catch (e) {
          console.error('Failed to delete old before buffer:', e);
        }
      }

      if (taskData.bufferAfterEventId) {
        try {
          await deleteCalendarEvent(calendar, calendarId, taskData.bufferAfterEventId);
          newBufferAfterEventId = null;
        } catch (e) {
          console.error('Failed to delete old after buffer:', e);
        }
      }

      // Create new buffers
      if (bufferBefore > 0) {
        try {
          const bufferBeforePayload = buildBufferEvent(
            task, 'before', bufferBefore, new Date(newSlot.start), calendarId, timezone
          );
          const response = await calendar.events.insert({
            calendarId, requestBody: bufferBeforePayload,
          });
          newBufferBeforeEventId = response.data.id || null;
        } catch (e) {
          console.error('Failed to create new before buffer:', e);
        }
      }

      if (bufferAfter > 0) {
        try {
          const bufferAfterPayload = buildBufferEvent(
            task, 'after', bufferAfter, new Date(newSlot.end), calendarId, timezone
          );
          const response = await calendar.events.insert({
            calendarId, requestBody: bufferAfterPayload,
          });
          newBufferAfterEventId = response.data.id || null;
        } catch (e) {
          console.error('Failed to create new after buffer:', e);
        }
      }
    }

    await updateTaskSchedulingInfo(taskId, newSlot, {
      bufferBeforeEventId: newBufferBeforeEventId,
      bufferAfterEventId: newBufferAfterEventId,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to reschedule task: ${errorMessage}` };
  }
}
