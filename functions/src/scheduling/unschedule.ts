/**
 * Unschedule Task module
 * Removes tasks from Google Calendar
 * @module scheduling/unschedule
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Task } from '../types';
import { getCalendarClientOrThrow } from '../calendar/client';

const db = admin.firestore();

/**
 * Parameters for unscheduleTask function
 */
interface UnscheduleTaskParams {
  /** Task ID to unschedule */
  taskId: string;
}

/**
 * Response from unscheduleTask function
 */
interface UnscheduleTaskResponse {
  /** Whether the unscheduling was successful */
  success: boolean;
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
 * Clear task's calendar event info in Firestore
 */
async function clearTaskEventInfo(taskId: string): Promise<void> {
  const taskRef = db.collection('tasks').doc(taskId);
  await taskRef.update({
    calendarEventId: admin.firestore.FieldValue.delete(),
    calendarId: admin.firestore.FieldValue.delete(),
    scheduledStart: admin.firestore.FieldValue.delete(),
    scheduledEnd: admin.firestore.FieldValue.delete(),
    bufferBeforeEventId: admin.firestore.FieldValue.delete(),
    bufferAfterEventId: admin.firestore.FieldValue.delete(),
    syncStatus: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
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
    await calendar.events.delete({
      calendarId,
      eventId,
    });
    return true;
  } catch (error: any) {
    // Ignore 404 errors (event already deleted)
    if (error.code === 404 || error.response?.status === 404) {
      console.log(`Event ${eventId} already deleted or not found`);
      return true;
    }
    throw error;
  }
}

/**
 * Callable function to unschedule a task (remove from calendar)
 *
 * @example
 * const result = await unscheduleTask({ taskId: 'task123' });
 */
export const unscheduleTask = functions.https.onCall(
  async (data: UnscheduleTaskParams, context): Promise<UnscheduleTaskResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to unschedule a task'
      );
    }

    const userId = context.auth.uid;
    const { taskId } = data;

    // Validate input
    if (!taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Task ID is required'
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
          'You do not have permission to unschedule this task'
        );
      }

      // Check if task is scheduled
      if (!task.calendarEventId) {
        return {
          success: false,
          error: 'Task is not scheduled on the calendar',
        };
      }

      const calendarId = task.calendarId || 'primary';

      console.log(`Unscheduling task ${taskId} for user ${userId}`);

      // Get calendar client
      const calendar = await getCalendarClientOrThrow(userId);

      // Delete the main event
      await deleteCalendarEvent(calendar, calendarId, task.calendarEventId);
      console.log(`Deleted main event ${task.calendarEventId}`);

      // Delete buffer events if they exist
      // Use type assertion to access dynamic properties
      const taskData = task as any;

      if (taskData.bufferBeforeEventId) {
        try {
          await deleteCalendarEvent(calendar, calendarId, taskData.bufferBeforeEventId);
          console.log(`Deleted before buffer event ${taskData.bufferBeforeEventId}`);
        } catch (bufferError) {
          console.error(`Failed to delete before buffer event:`, bufferError);
          // Continue anyway - main event is deleted
        }
      }

      if (taskData.bufferAfterEventId) {
        try {
          await deleteCalendarEvent(calendar, calendarId, taskData.bufferAfterEventId);
          console.log(`Deleted after buffer event ${taskData.bufferAfterEventId}`);
        } catch (bufferError) {
          console.error(`Failed to delete after buffer event:`, bufferError);
          // Continue anyway - main event is deleted
        }
      }

      // Clear task's calendar event info
      await clearTaskEventInfo(taskId);

      console.log(`Task ${taskId} unscheduled successfully`);

      return {
        success: true,
      };
    } catch (error) {
      console.error(`Error unscheduling task ${taskId} for user ${userId}:`, error);
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

      throw new functions.https.HttpsError('internal', `Failed to unschedule task: ${errorMessage}`);
    }
  }
);

/**
 * Internal function to unschedule a task (for use by other server-side functions)
 *
 * @param userId - User's Firebase UID
 * @param taskId - Task ID to unschedule
 * @returns Unschedule result
 */
export async function unscheduleTaskInternal(
  userId: string,
  taskId: string
): Promise<UnscheduleTaskResponse> {
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
    const calendar = await getCalendarClientOrThrow(userId);

    // Delete main event
    await deleteCalendarEvent(calendar, calendarId, task.calendarEventId);

    // Delete buffers
    const taskData = task as any;
    if (taskData.bufferBeforeEventId) {
      try {
        await deleteCalendarEvent(calendar, calendarId, taskData.bufferBeforeEventId);
      } catch (e) {
        console.error('Failed to delete before buffer:', e);
      }
    }

    if (taskData.bufferAfterEventId) {
      try {
        await deleteCalendarEvent(calendar, calendarId, taskData.bufferAfterEventId);
      } catch (e) {
        console.error('Failed to delete after buffer:', e);
      }
    }

    // Clear task info
    await clearTaskEventInfo(taskId);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to unschedule task: ${errorMessage}` };
  }
}

/**
 * Unschedule multiple tasks at once
 *
 * @param userId - User's Firebase UID
 * @param taskIds - Array of task IDs to unschedule
 * @returns Results for each task
 */
export async function unscheduleTasksInternal(
  userId: string,
  taskIds: string[]
): Promise<Array<{ taskId: string; success: boolean; error?: string }>> {
  const results: Array<{ taskId: string; success: boolean; error?: string }> = [];

  for (const taskId of taskIds) {
    const result = await unscheduleTaskInternal(userId, taskId);
    results.push({
      taskId,
      success: result.success,
      error: result.error,
    });
  }

  return results;
}
