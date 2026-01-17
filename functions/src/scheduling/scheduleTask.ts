/**
 * Schedule Task module
 * Schedules individual tasks to Google Calendar
 * @module scheduling/scheduleTask
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  Task,
  SchedulingTimeSlot,
  ScheduleTaskResult,
} from '../types';
import { getCalendarClientOrThrow } from '../calendar/client';
import {
  buildTaskEvent,
  buildBufferEvent,
} from './eventBuilder';
import { checkConflicts } from './conflicts';

const db = admin.firestore();

/**
 * Parameters for scheduleTask function
 */
interface ScheduleTaskParams {
  /** Task ID to schedule */
  taskId: string;
  /** Time slot for the task */
  slot: SchedulingTimeSlot;
  /** Calendar ID to create the event on */
  calendarId: string;
  /** Whether to include buffer events */
  includeBuffers?: boolean;
  /** Skip conflict checking (force schedule) */
  force?: boolean;
  /** Timezone for the event (IANA format) */
  timezone?: string;
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
 * Update task with calendar event info
 */
async function updateTaskWithEventInfo(
  taskId: string,
  eventInfo: {
    calendarEventId: string;
    calendarId: string;
    scheduledStart: string;
    scheduledEnd: string;
    bufferBeforeEventId?: string;
    bufferAfterEventId?: string;
  }
): Promise<void> {
  const taskRef = db.collection('tasks').doc(taskId);
  await taskRef.update({
    calendarEventId: eventInfo.calendarEventId,
    calendarId: eventInfo.calendarId,
    scheduledStart: eventInfo.scheduledStart,
    scheduledEnd: eventInfo.scheduledEnd,
    bufferBeforeEventId: eventInfo.bufferBeforeEventId || null,
    bufferAfterEventId: eventInfo.bufferAfterEventId || null,
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Callable function to schedule a single task
 * Use this for quick scheduling without going through the full proposal flow
 *
 * @example
 * const result = await scheduleTask({
 *   taskId: 'task123',
 *   slot: { start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' },
 *   calendarId: 'primary'
 * });
 */
export const scheduleTask = functions.https.onCall(
  async (data: ScheduleTaskParams, context): Promise<ScheduleTaskResult> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to schedule a task'
      );
    }

    const userId = context.auth.uid;
    const {
      taskId,
      slot,
      calendarId,
      includeBuffers = false,
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

    if (!slot || !slot.start || !slot.end) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Valid time slot is required'
      );
    }

    if (!calendarId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Calendar ID is required'
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
          'You do not have permission to schedule this task'
        );
      }

      // Check if task is already scheduled
      if (task.calendarEventId) {
        return {
          success: false,
          error: 'Task is already scheduled. Use reschedule to move it.',
        };
      }

      // Check for conflicts unless force is true
      if (!force) {
        const conflictResult = await checkConflicts(
          userId,
          task,
          slot,
          [calendarId]
        );

        if (conflictResult.hasConflicts) {
          return {
            success: false,
            conflicts: conflictResult.conflicts,
            requiresApproval: true,
            error: 'Time slot has conflicts. Use force=true to override or use the proposal flow.',
          };
        }
      }

      // Get calendar client
      const calendar = await getCalendarClientOrThrow(userId);

      // Build and create the main event
      const eventPayload = buildTaskEvent({
        task,
        slot,
        calendarId,
        timezone,
      });

      console.log(`Scheduling task ${taskId} for user ${userId} on calendar ${calendarId}`);

      const eventResponse = await calendar.events.insert({
        calendarId,
        requestBody: eventPayload,
      });

      const eventId = eventResponse.data.id;

      if (!eventId) {
        throw new Error('Failed to create calendar event: no event ID returned');
      }

      // Create buffer events if requested
      let bufferBeforeEventId: string | undefined;
      let bufferAfterEventId: string | undefined;

      if (includeBuffers) {
        const bufferBefore = task.bufferBefore || 0;
        const bufferAfter = task.bufferAfter || 0;

        if (bufferBefore > 0) {
          const bufferBeforePayload = buildBufferEvent(
            task,
            'before',
            bufferBefore,
            new Date(slot.start),
            calendarId,
            timezone
          );

          try {
            const bufferBeforeResponse = await calendar.events.insert({
              calendarId,
              requestBody: bufferBeforePayload,
            });
            bufferBeforeEventId = bufferBeforeResponse.data.id || undefined;
          } catch (bufferError) {
            console.error('Failed to create before buffer event:', bufferError);
            // Continue without buffer
          }
        }

        if (bufferAfter > 0) {
          const bufferAfterPayload = buildBufferEvent(
            task,
            'after',
            bufferAfter,
            new Date(slot.end),
            calendarId,
            timezone
          );

          try {
            const bufferAfterResponse = await calendar.events.insert({
              calendarId,
              requestBody: bufferAfterPayload,
            });
            bufferAfterEventId = bufferAfterResponse.data.id || undefined;
          } catch (bufferError) {
            console.error('Failed to create after buffer event:', bufferError);
            // Continue without buffer
          }
        }
      }

      // Update task in Firestore
      await updateTaskWithEventInfo(taskId, {
        calendarEventId: eventId,
        calendarId,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        bufferBeforeEventId,
        bufferAfterEventId,
      });

      console.log(`Task ${taskId} scheduled successfully with event ${eventId}`);

      return {
        success: true,
        calendarEventId: eventId,
        bufferBeforeEventId,
        bufferAfterEventId,
      };
    } catch (error) {
      console.error(`Error scheduling task ${taskId} for user ${userId}:`, error);
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

      throw new functions.https.HttpsError('internal', `Failed to schedule task: ${errorMessage}`);
    }
  }
);

/**
 * Internal function to schedule a task (for use by other server-side functions)
 *
 * @param userId - User's Firebase UID
 * @param taskId - Task ID to schedule
 * @param slot - Time slot for the task
 * @param calendarId - Calendar ID
 * @param options - Additional options
 * @returns Schedule result
 */
export async function scheduleTaskInternal(
  userId: string,
  taskId: string,
  slot: SchedulingTimeSlot,
  calendarId: string,
  options: {
    includeBuffers?: boolean;
    force?: boolean;
    timezone?: string;
  } = {}
): Promise<ScheduleTaskResult> {
  const { includeBuffers = false, force = false, timezone = 'UTC' } = options;

  try {
    const task = await getTask(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.userId !== userId) {
      return { success: false, error: 'Permission denied' };
    }

    if (task.calendarEventId) {
      return { success: false, error: 'Task is already scheduled' };
    }

    if (!force) {
      const conflictResult = await checkConflicts(userId, task, slot, [calendarId]);
      if (conflictResult.hasConflicts) {
        return {
          success: false,
          conflicts: conflictResult.conflicts,
          requiresApproval: true,
          error: 'Time slot has conflicts',
        };
      }
    }

    const calendar = await getCalendarClientOrThrow(userId);
    const eventPayload = buildTaskEvent({ task, slot, calendarId, timezone });

    const eventResponse = await calendar.events.insert({
      calendarId,
      requestBody: eventPayload,
    });

    const eventId = eventResponse.data.id;
    if (!eventId) {
      throw new Error('Failed to create calendar event');
    }

    let bufferBeforeEventId: string | undefined;
    let bufferAfterEventId: string | undefined;

    if (includeBuffers) {
      const bufferBefore = task.bufferBefore || 0;
      const bufferAfter = task.bufferAfter || 0;

      if (bufferBefore > 0) {
        try {
          const bufferBeforePayload = buildBufferEvent(
            task, 'before', bufferBefore, new Date(slot.start), calendarId, timezone
          );
          const bufferBeforeResponse = await calendar.events.insert({
            calendarId, requestBody: bufferBeforePayload,
          });
          bufferBeforeEventId = bufferBeforeResponse.data.id || undefined;
        } catch (e) {
          console.error('Failed to create before buffer:', e);
        }
      }

      if (bufferAfter > 0) {
        try {
          const bufferAfterPayload = buildBufferEvent(
            task, 'after', bufferAfter, new Date(slot.end), calendarId, timezone
          );
          const bufferAfterResponse = await calendar.events.insert({
            calendarId, requestBody: bufferAfterPayload,
          });
          bufferAfterEventId = bufferAfterResponse.data.id || undefined;
        } catch (e) {
          console.error('Failed to create after buffer:', e);
        }
      }
    }

    await updateTaskWithEventInfo(taskId, {
      calendarEventId: eventId,
      calendarId,
      scheduledStart: slot.start,
      scheduledEnd: slot.end,
      bufferBeforeEventId,
      bufferAfterEventId,
    });

    return {
      success: true,
      calendarEventId: eventId,
      bufferBeforeEventId,
      bufferAfterEventId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to schedule task: ${errorMessage}` };
  }
}
