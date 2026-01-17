/**
 * Firestore Triggers for Task <-> Calendar Sync
 * Automatically syncs task state changes to Google Calendar
 * @module sync/taskTriggers
 */

import * as functions from 'firebase-functions';
import { shouldSyncTask, getCalendarClient, datesAreDifferent, toDate } from './syncUtils';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  deleteCalendarEventDirect,
  TaskData
} from './calendarSync';

/**
 * Convert Firestore document data to TaskData
 * Handles Firestore Timestamp conversion to Date
 *
 * @param data - Raw Firestore document data
 * @returns Normalized TaskData with proper Date objects
 */
function convertToTaskData(data: any): Omit<TaskData, 'id'> {
  return {
    userId: data.userId,
    title: data.content || data.title,
    description: data.description,
    scheduledStart: toDate(data.scheduledStart),
    scheduledEnd: toDate(data.scheduledEnd),
    calendarId: data.calendarId,
    calendarEventId: data.calendarEventId,
    completed: data.completed || false,
    archived: data.archived || false,
    taskType: data.taskType || 'other',
    priority: data.priority || 'medium',
    bufferBefore: data.bufferBefore,
    bufferAfter: data.bufferAfter,
    project: data.project,
    category: data.category,
    timeEstimate: data.timeEstimate,
    dueDate: data.dueDate,
    dueTime: data.dueTime,
  };
}

/**
 * Check if only sync metadata changed (to avoid infinite trigger loops)
 *
 * @param before - Data before update
 * @param after - Data after update
 * @returns True if only syncMetadata changed
 */
function onlySyncMetadataChanged(before: any, after: any): boolean {
  // Compare all fields except syncMetadata
  const beforeWithoutSync = { ...before };
  const afterWithoutSync = { ...after };
  delete beforeWithoutSync.syncMetadata;
  delete afterWithoutSync.syncMetadata;

  // If sync metadata didn't change, don't skip
  if (JSON.stringify(before.syncMetadata) === JSON.stringify(after.syncMetadata)) {
    return false;
  }

  // If other fields are the same, only sync metadata changed
  return JSON.stringify(beforeWithoutSync) === JSON.stringify(afterWithoutSync);
}

/**
 * Trigger: When a new task is created
 * Creates a calendar event if the task is already scheduled
 */
export const onTaskCreated = functions.firestore
  .document('tasks/{taskId}')
  .onCreate(async (snapshot, context) => {
    const taskId = context.params.taskId;
    const taskData = snapshot.data();

    console.log(`Task created: ${taskId}`);

    if (!taskData.userId) {
      console.log(`Task ${taskId} has no userId, skipping sync`);
      return;
    }

    if (!shouldSyncTask(taskData)) {
      console.log(`Task ${taskId} not scheduled, skipping calendar sync`);
      return;
    }

    const task: TaskData = {
      id: taskId,
      ...convertToTaskData(taskData)
    };

    console.log(`Creating calendar event for new task ${taskId}`);
    await createCalendarEvent(task);
  });

/**
 * Trigger: When a task is updated
 * Handles various update scenarios:
 * - Task becomes scheduled -> create event
 * - Task is unscheduled -> delete event
 * - Task is completed/archived -> delete event
 * - Task is uncompleted/unarchived -> recreate event
 * - Task details change -> update event
 */
export const onTaskUpdated = functions.firestore
  .document('tasks/{taskId}')
  .onUpdate(async (change, context) => {
    const taskId = context.params.taskId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    console.log(`Task updated: ${taskId}`);

    if (!afterData.userId) {
      console.log(`Task ${taskId} has no userId, skipping sync`);
      return;
    }

    // Avoid infinite loops: skip if only syncMetadata changed
    if (onlySyncMetadataChanged(beforeData, afterData)) {
      console.log(`Task ${taskId} only sync metadata changed, skipping to avoid loop`);
      return;
    }

    const before = convertToTaskData(beforeData);
    const after = convertToTaskData(afterData);

    const task: TaskData = {
      id: taskId,
      ...after
    };

    // Case 1: Task was unscheduled (had event, now doesn't have schedule)
    const hadEvent = !!beforeData.calendarEventId;
    const isScheduled = shouldSyncTask(afterData);

    if (hadEvent && !isScheduled) {
      console.log(`Task ${taskId} unscheduled, deleting calendar event`);
      const taskToDelete: TaskData = {
        ...task,
        calendarEventId: beforeData.calendarEventId,
        calendarId: beforeData.calendarId
      };
      await deleteCalendarEvent(taskToDelete);
      return;
    }

    // Case 2: Task was newly scheduled (didn't have event, now has schedule)
    if (!hadEvent && isScheduled) {
      console.log(`Task ${taskId} newly scheduled, creating calendar event`);
      await createCalendarEvent(task);
      return;
    }

    // Case 3: Task was completed or archived (delete event)
    const wasActive = !before.completed && !before.archived;
    const isActive = !after.completed && !after.archived;

    if (wasActive && !isActive && afterData.calendarEventId) {
      console.log(`Task ${taskId} completed/archived, deleting calendar event`);
      await deleteCalendarEvent(task);
      return;
    }

    // Case 4: Task was uncompleted or unarchived (recreate event if scheduled)
    if (!wasActive && isActive && isScheduled && !afterData.calendarEventId) {
      console.log(`Task ${taskId} uncompleted/unarchived, recreating calendar event`);
      await createCalendarEvent(task);
      return;
    }

    // Case 5: Task schedule or details changed (update event)
    if (afterData.calendarEventId && isScheduled) {
      const scheduleChanged =
        datesAreDifferent(beforeData.scheduledStart, afterData.scheduledStart) ||
        datesAreDifferent(beforeData.scheduledEnd, afterData.scheduledEnd) ||
        beforeData.calendarId !== afterData.calendarId;

      const detailsChanged =
        before.title !== after.title ||
        before.description !== after.description ||
        before.taskType !== after.taskType ||
        before.priority !== after.priority;

      if (scheduleChanged || detailsChanged) {
        console.log(`Task ${taskId} details/schedule changed, updating calendar event`);

        // If calendar changed, delete from old and create in new
        if (beforeData.calendarId !== afterData.calendarId && beforeData.calendarId) {
          console.log(`Task ${taskId} moved to different calendar, recreating event`);
          const oldTask: TaskData = {
            ...task,
            calendarId: beforeData.calendarId,
            calendarEventId: beforeData.calendarEventId
          };
          await deleteCalendarEvent(oldTask);
          await createCalendarEvent(task);
        } else {
          await updateCalendarEvent(task);
        }
      }
    }
  });

/**
 * Trigger: When a task is deleted
 * Deletes the associated calendar event if one exists
 */
export const onTaskDeleted = functions.firestore
  .document('tasks/{taskId}')
  .onDelete(async (snapshot, context) => {
    const taskId = context.params.taskId;
    const taskData = snapshot.data();

    console.log(`Task deleted: ${taskId}`);

    if (!taskData.calendarEventId || !taskData.calendarId) {
      console.log(`Task ${taskId} has no calendar event, nothing to delete`);
      return;
    }

    if (!taskData.userId) {
      console.log(`Task ${taskId} has no userId, cannot delete calendar event`);
      return;
    }

    // Get calendar client and delete directly (don't update task since it's deleted)
    const calendar = await getCalendarClient(taskData.userId);

    if (!calendar) {
      console.error(`No calendar client for user ${taskData.userId}, cannot delete event`);
      return;
    }

    console.log(`Deleting calendar event ${taskData.calendarEventId} for deleted task ${taskId}`);
    await deleteCalendarEventDirect(
      calendar,
      taskData.calendarId,
      taskData.calendarEventId
    );
  });
