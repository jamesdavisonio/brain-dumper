/**
 * Calendar Sync module
 * Handles creating, updating, and deleting calendar events for tasks
 * @module sync/calendarSync
 */

import { calendar_v3 } from 'googleapis';
import { getCalendarClient, updateSyncMetadata, toDate } from './syncUtils';
import { buildTaskEvent } from '../scheduling/eventBuilder';
import { TaskType, Task } from '../types';

/**
 * Task data structure for sync operations
 */
export interface TaskData {
  /** Task document ID */
  id: string;
  /** User ID who owns the task */
  userId: string;
  /** Task title/content */
  title: string;
  /** Task description */
  description?: string;
  /** Scheduled start time */
  scheduledStart?: Date | string;
  /** Scheduled end time */
  scheduledEnd?: Date | string;
  /** Calendar ID where the event should be created */
  calendarId?: string;
  /** Google Calendar event ID (if already synced) */
  calendarEventId?: string;
  /** Whether the task is completed */
  completed: boolean;
  /** Whether the task is archived */
  archived: boolean;
  /** Task type for scheduling purposes */
  taskType: string;
  /** Task priority */
  priority: 'high' | 'medium' | 'low';
  /** Buffer time before task in minutes */
  bufferBefore?: number;
  /** Buffer time after task in minutes */
  bufferAfter?: number;
  /** Project the task belongs to */
  project?: string;
  /** Task category */
  category?: string;
  /** Estimated time in minutes */
  timeEstimate?: number;
  /** Due date */
  dueDate?: string;
  /** Due time */
  dueTime?: string;
}

/**
 * Convert TaskData to the full Task format expected by buildTaskEvent
 */
function toEventTask(task: TaskData): Task {
  const now = new Date().toISOString();
  const startDate = toDate(task.scheduledStart);
  const endDate = toDate(task.scheduledEnd);

  return {
    id: task.id,
    content: task.title,
    taskType: task.taskType as TaskType,
    priority: task.priority,
    project: task.project,
    category: task.category,
    timeEstimate: task.timeEstimate,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    completed: task.completed,
    archived: task.archived,
    userId: task.userId,
    createdAt: now,
    updatedAt: now,
    order: 0,
    scheduledStart: startDate?.toISOString(),
    scheduledEnd: endDate?.toISOString(),
    calendarId: task.calendarId,
    calendarEventId: task.calendarEventId,
    bufferBefore: task.bufferBefore,
    bufferAfter: task.bufferAfter,
  };
}

/**
 * Create a calendar event for a task
 *
 * @param task - The task to create an event for
 * @returns The created event ID or null if creation failed
 */
export async function createCalendarEvent(task: TaskData): Promise<string | null> {
  const calendar = await getCalendarClient(task.userId);

  if (!calendar) {
    console.error(`No calendar client available for user ${task.userId}`);
    await updateSyncMetadata(task.id, {
      syncStatus: 'error',
      syncError: 'Failed to get calendar client'
    });
    return null;
  }

  const startDate = toDate(task.scheduledStart);
  const endDate = toDate(task.scheduledEnd);

  if (!startDate || !task.calendarId) {
    console.error(`Task ${task.id} missing scheduledStart or calendarId`);
    return null;
  }

  try {
    const eventTask = toEventTask(task);

    const event = buildTaskEvent({
      task: eventTask,
      slot: {
        start: startDate.toISOString(),
        end: endDate ? endDate.toISOString() : new Date(startDate.getTime() + 60 * 60000).toISOString(),
      },
      calendarId: task.calendarId
    });

    const response = await calendar.events.insert({
      calendarId: task.calendarId,
      requestBody: event
    });

    const eventId = response.data.id || null;

    await updateSyncMetadata(task.id, {
      calendarEventId: eventId,
      syncStatus: 'synced'
    });

    console.log(`Created calendar event ${eventId} for task ${task.id}`);
    return eventId;
  } catch (error: any) {
    console.error(`Failed to create calendar event for task ${task.id}:`, error);
    await updateSyncMetadata(task.id, {
      syncStatus: 'error',
      syncError: error.message || 'Failed to create calendar event'
    });
    return null;
  }
}

/**
 * Update an existing calendar event for a task
 *
 * @param task - The task with updated data
 * @returns True if update was successful
 */
export async function updateCalendarEvent(task: TaskData): Promise<boolean> {
  const calendar = await getCalendarClient(task.userId);

  if (!calendar) {
    console.error(`No calendar client available for user ${task.userId}`);
    return false;
  }

  if (!task.calendarEventId || !task.calendarId) {
    console.error(`Task ${task.id} missing calendarEventId or calendarId`);
    return false;
  }

  // If task is completed or archived, delete the event instead
  if (task.completed || task.archived) {
    console.log(`Task ${task.id} is completed/archived, deleting event`);
    return await deleteCalendarEvent(task);
  }

  try {
    const startDate = toDate(task.scheduledStart);
    const endDate = toDate(task.scheduledEnd);

    if (!startDate) {
      console.error(`Task ${task.id} has no scheduledStart`);
      return false;
    }

    const eventTask = toEventTask(task);

    const event = buildTaskEvent({
      task: eventTask,
      slot: {
        start: startDate.toISOString(),
        end: endDate ? endDate.toISOString() : new Date(startDate.getTime() + 60 * 60000).toISOString(),
      },
      calendarId: task.calendarId
    });

    await calendar.events.update({
      calendarId: task.calendarId,
      eventId: task.calendarEventId,
      requestBody: event
    });

    await updateSyncMetadata(task.id, {
      syncStatus: 'synced'
    });

    console.log(`Updated calendar event ${task.calendarEventId} for task ${task.id}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to update calendar event for task ${task.id}:`, error);

    // Check if the error is a 404 (event not found)
    if (error.code === 404 || error.response?.status === 404) {
      console.log(`Event ${task.calendarEventId} not found, clearing sync metadata`);
      await updateSyncMetadata(task.id, {
        calendarEventId: null,
        syncStatus: 'synced'
      });
      return true;
    }

    await updateSyncMetadata(task.id, {
      syncStatus: 'error',
      syncError: error.message || 'Failed to update calendar event'
    });
    return false;
  }
}

/**
 * Delete a calendar event for a task
 *
 * @param task - The task whose event should be deleted
 * @returns True if deletion was successful
 */
export async function deleteCalendarEvent(task: TaskData): Promise<boolean> {
  const calendar = await getCalendarClient(task.userId);

  if (!calendar) {
    console.error(`No calendar client available for user ${task.userId}`);
    return false;
  }

  if (!task.calendarEventId || !task.calendarId) {
    console.log(`Task ${task.id} has no calendar event to delete`);
    return true;
  }

  try {
    await calendar.events.delete({
      calendarId: task.calendarId,
      eventId: task.calendarEventId
    });

    await updateSyncMetadata(task.id, {
      calendarEventId: null,
      syncStatus: 'synced'
    });

    console.log(`Deleted calendar event ${task.calendarEventId} for task ${task.id}`);
    return true;
  } catch (error: any) {
    // 404 means event already deleted - that's fine
    if (error.code === 404 || error.response?.status === 404) {
      console.log(`Event ${task.calendarEventId} already deleted`);
      await updateSyncMetadata(task.id, {
        calendarEventId: null,
        syncStatus: 'synced'
      });
      return true;
    }

    console.error(`Failed to delete calendar event for task ${task.id}:`, error);
    await updateSyncMetadata(task.id, {
      syncStatus: 'error',
      syncError: error.message || 'Failed to delete calendar event'
    });
    return false;
  }
}

/**
 * Delete a calendar event directly (without updating task metadata)
 * Used when the task itself is being deleted
 *
 * @param calendar - The calendar client
 * @param calendarId - The calendar ID
 * @param eventId - The event ID to delete
 * @returns True if deletion was successful
 */
export async function deleteCalendarEventDirect(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    await calendar.events.delete({
      calendarId,
      eventId
    });
    console.log(`Deleted calendar event ${eventId}`);
    return true;
  } catch (error: any) {
    // 404 means event already deleted - that's fine
    if (error.code === 404 || error.response?.status === 404) {
      console.log(`Event ${eventId} already deleted`);
      return true;
    }
    console.error(`Failed to delete calendar event ${eventId}:`, error);
    return false;
  }
}
