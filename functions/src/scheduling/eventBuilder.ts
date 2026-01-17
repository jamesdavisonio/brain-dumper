/**
 * Event Builder module
 * Builds Google Calendar event payloads from tasks
 * @module scheduling/eventBuilder
 */

import { calendar_v3 } from 'googleapis';
import { Task, SchedulingTimeSlot, Priority } from '../types';

/**
 * Options for building a task event
 */
export interface BuildEventOptions {
  /** The task to create an event for */
  task: Task;
  /** The time slot for the event */
  slot: SchedulingTimeSlot;
  /** Calendar ID where the event will be created */
  calendarId: string;
  /** Whether to include buffer events */
  includeBuffers?: boolean;
  /** Buffer time in minutes before the task */
  bufferBefore?: number;
  /** Buffer time in minutes after the task */
  bufferAfter?: number;
  /** Timezone for the event (IANA format) */
  timezone?: string;
}

/**
 * Extended properties keys for Brain Dumper metadata
 */
export const BRAIN_DUMPER_KEYS = {
  TASK_ID: 'brainDumperTaskId',
  BUFFER_TYPE: 'brainDumperBufferType',
  PRIORITY: 'brainDumperPriority',
  VERSION: 'brainDumperVersion',
} as const;

/**
 * Current version of Brain Dumper event format
 */
export const BRAIN_DUMPER_EVENT_VERSION = '1';

/**
 * Generate a color ID based on task priority
 * Google Calendar color IDs: 1-11
 * @param priority - Task priority
 * @returns Google Calendar color ID
 */
function getColorIdForPriority(priority: Priority): string {
  switch (priority) {
    case 'high':
      return '11'; // Red
    case 'medium':
      return '5'; // Yellow
    case 'low':
      return '9'; // Blue
    default:
      return '8'; // Gray
  }
}

/**
 * Build the event summary (title) from task content
 * @param task - The task
 * @returns Event summary string
 */
function buildEventSummary(task: Task): string {
  const prefix = task.taskType ? `[${task.taskType}] ` : '';
  return `${prefix}${task.content}`;
}

/**
 * Build the event description from task details
 * @param task - The task
 * @returns Event description string
 */
function buildEventDescription(task: Task): string {
  const lines: string[] = [];

  // Add task content
  lines.push(task.content);
  lines.push('');

  // Add metadata
  lines.push('--- Brain Dumper Task ---');
  lines.push(`Priority: ${task.priority}`);

  if (task.project) {
    lines.push(`Project: ${task.project}`);
  }

  if (task.category) {
    lines.push(`Category: ${task.category}`);
  }

  if (task.timeEstimate) {
    lines.push(`Estimated time: ${task.timeEstimate} minutes`);
  }

  if (task.dueDate) {
    lines.push(`Due: ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ''}`);
  }

  lines.push('');
  lines.push('This event was created by Brain Dumper.');
  lines.push('Do not modify the extended properties.');

  return lines.join('\n');
}

/**
 * Build a Google Calendar event payload from a task
 *
 * @param options - Event building options
 * @returns Google Calendar event schema
 *
 * @example
 * const event = buildTaskEvent({
 *   task: myTask,
 *   slot: { start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' },
 *   calendarId: 'primary'
 * });
 */
export function buildTaskEvent(options: BuildEventOptions): calendar_v3.Schema$Event {
  const { task, slot, timezone = 'UTC' } = options;

  const event: calendar_v3.Schema$Event = {
    summary: buildEventSummary(task),
    description: buildEventDescription(task),
    start: {
      dateTime: slot.start,
      timeZone: timezone,
    },
    end: {
      dateTime: slot.end,
      timeZone: timezone,
    },
    colorId: getColorIdForPriority(task.priority),
    status: 'confirmed',
    // Store Brain Dumper metadata in extended properties
    extendedProperties: {
      private: {
        [BRAIN_DUMPER_KEYS.TASK_ID]: task.id,
        [BRAIN_DUMPER_KEYS.PRIORITY]: task.priority,
        [BRAIN_DUMPER_KEYS.VERSION]: BRAIN_DUMPER_EVENT_VERSION,
      },
    },
    // Add reminders based on priority
    reminders: {
      useDefault: false,
      overrides: getRemindersForPriority(task.priority),
    },
  };

  return event;
}

/**
 * Get reminder overrides based on task priority
 * @param priority - Task priority
 * @returns Array of reminder overrides
 */
function getRemindersForPriority(
  priority: Priority
): calendar_v3.Schema$EventReminder[] {
  switch (priority) {
    case 'high':
      return [
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 10 },
      ];
    case 'medium':
      return [{ method: 'popup', minutes: 15 }];
    case 'low':
      return [{ method: 'popup', minutes: 5 }];
    default:
      return [{ method: 'popup', minutes: 10 }];
  }
}

/**
 * Build a buffer event (prep time or wind-down)
 *
 * @param task - The task this buffer is for
 * @param type - Buffer type ('before' for prep time, 'after' for wind-down)
 * @param duration - Buffer duration in minutes
 * @param referenceTime - Reference time (task start for 'before', task end for 'after')
 * @param calendarId - Calendar ID (unused but kept for consistency)
 * @param timezone - Timezone for the event (IANA format)
 * @returns Google Calendar event schema for the buffer
 *
 * @example
 * const bufferBefore = buildBufferEvent(
 *   myTask,
 *   'before',
 *   15,
 *   new Date('2024-01-15T09:00:00Z'),
 *   'primary'
 * );
 */
export function buildBufferEvent(
  task: Task,
  type: 'before' | 'after',
  duration: number,
  referenceTime: Date,
  calendarId: string,
  timezone: string = 'UTC'
): calendar_v3.Schema$Event {
  let start: Date;
  let end: Date;

  if (type === 'before') {
    // Buffer before: ends at task start
    end = new Date(referenceTime);
    start = new Date(end.getTime() - duration * 60 * 1000);
  } else {
    // Buffer after: starts at task end
    start = new Date(referenceTime);
    end = new Date(start.getTime() + duration * 60 * 1000);
  }

  const bufferTitle = type === 'before'
    ? `Prep: ${task.content}`
    : `Wind-down: ${task.content}`;

  const bufferDescription = type === 'before'
    ? `Preparation time for: ${task.content}\n\nUse this time to get ready for your task.`
    : `Wind-down time after: ${task.content}\n\nUse this time to wrap up and transition.`;

  const event: calendar_v3.Schema$Event = {
    summary: bufferTitle,
    description: bufferDescription,
    start: {
      dateTime: start.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: timezone,
    },
    colorId: '8', // Gray for buffers
    status: 'confirmed',
    // Mark as free time so it doesn't show as busy
    transparency: 'transparent',
    extendedProperties: {
      private: {
        [BRAIN_DUMPER_KEYS.TASK_ID]: task.id,
        [BRAIN_DUMPER_KEYS.BUFFER_TYPE]: type,
        [BRAIN_DUMPER_KEYS.VERSION]: BRAIN_DUMPER_EVENT_VERSION,
      },
    },
    // No reminders for buffer events
    reminders: {
      useDefault: false,
      overrides: [],
    },
  };

  return event;
}

/**
 * Check if an event is a Brain Dumper event
 *
 * @param event - Google Calendar event
 * @returns True if the event was created by Brain Dumper
 */
export function isBrainDumperEvent(event: calendar_v3.Schema$Event): boolean {
  const privateProps = event.extendedProperties?.private;
  return !!(privateProps && privateProps[BRAIN_DUMPER_KEYS.TASK_ID]);
}

/**
 * Check if an event is a Brain Dumper buffer event
 *
 * @param event - Google Calendar event
 * @returns True if the event is a buffer event
 */
export function isBufferEvent(event: calendar_v3.Schema$Event): boolean {
  const privateProps = event.extendedProperties?.private;
  return !!(privateProps && privateProps[BRAIN_DUMPER_KEYS.BUFFER_TYPE]);
}

/**
 * Get Brain Dumper metadata from an event
 *
 * @param event - Google Calendar event
 * @returns Brain Dumper metadata or null if not a Brain Dumper event
 */
export function getBrainDumperMetadata(
  event: calendar_v3.Schema$Event
): {
  taskId: string;
  priority?: Priority;
  bufferType?: 'before' | 'after';
  version?: string;
} | null {
  const privateProps = event.extendedProperties?.private;

  if (!privateProps || !privateProps[BRAIN_DUMPER_KEYS.TASK_ID]) {
    return null;
  }

  return {
    taskId: privateProps[BRAIN_DUMPER_KEYS.TASK_ID],
    priority: privateProps[BRAIN_DUMPER_KEYS.PRIORITY] as Priority | undefined,
    bufferType: privateProps[BRAIN_DUMPER_KEYS.BUFFER_TYPE] as 'before' | 'after' | undefined,
    version: privateProps[BRAIN_DUMPER_KEYS.VERSION],
  };
}

/**
 * Update event times (used for rescheduling)
 *
 * @param event - Existing event to update
 * @param newSlot - New time slot
 * @param timezone - Timezone for the event
 * @returns Updated event with new times
 */
export function updateEventTimes(
  event: calendar_v3.Schema$Event,
  newSlot: SchedulingTimeSlot,
  timezone: string = 'UTC'
): calendar_v3.Schema$Event {
  return {
    ...event,
    start: {
      dateTime: newSlot.start,
      timeZone: timezone,
    },
    end: {
      dateTime: newSlot.end,
      timeZone: timezone,
    },
  };
}

/**
 * Calculate buffer slot times relative to a task slot
 *
 * @param taskSlot - The main task's time slot
 * @param bufferBefore - Buffer duration before task (minutes)
 * @param bufferAfter - Buffer duration after task (minutes)
 * @returns Object with before and after buffer slots
 */
export function calculateBufferSlots(
  taskSlot: SchedulingTimeSlot,
  bufferBefore?: number,
  bufferAfter?: number
): {
  beforeSlot?: SchedulingTimeSlot;
  afterSlot?: SchedulingTimeSlot;
} {
  const result: {
    beforeSlot?: SchedulingTimeSlot;
    afterSlot?: SchedulingTimeSlot;
  } = {};

  if (bufferBefore && bufferBefore > 0) {
    const taskStart = new Date(taskSlot.start);
    const bufferStart = new Date(taskStart.getTime() - bufferBefore * 60 * 1000);
    result.beforeSlot = {
      start: bufferStart.toISOString(),
      end: taskStart.toISOString(),
    };
  }

  if (bufferAfter && bufferAfter > 0) {
    const taskEnd = new Date(taskSlot.end);
    const bufferEnd = new Date(taskEnd.getTime() + bufferAfter * 60 * 1000);
    result.afterSlot = {
      start: taskEnd.toISOString(),
      end: bufferEnd.toISOString(),
    };
  }

  return result;
}
