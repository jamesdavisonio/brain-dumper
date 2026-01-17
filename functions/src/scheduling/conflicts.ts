/**
 * Conflict Detection module
 * Detects and categorizes scheduling conflicts
 * @module scheduling/conflicts
 */

import { calendar_v3 } from 'googleapis';
import {
  Task,
  Priority,
  Conflict,
  Displacement,
  ConflictCheckResult,
  SchedulingTimeSlot,
  CalendarEvent,
} from '../types';
import { getCalendarClientOrThrow } from '../calendar/client';
import { fetchEventsInternal } from '../calendar/fetchEvents';
import { getBrainDumperMetadata, isBrainDumperEvent } from './eventBuilder';

/**
 * Priority weight for comparison
 * Higher number = higher priority
 */
const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Compare two priorities
 * @param a - First priority
 * @param b - Second priority
 * @returns Positive if a > b, negative if a < b, 0 if equal
 */
export function comparePriorities(a: Priority, b: Priority): number {
  return PRIORITY_WEIGHT[a] - PRIORITY_WEIGHT[b];
}

/**
 * Check if a new task can displace an existing task based on priority
 * @param newPriority - Priority of the new task
 * @param existingPriority - Priority of the existing task
 * @returns True if new task can displace existing
 */
export function canDisplaceByPriority(
  newPriority: Priority,
  existingPriority: Priority
): boolean {
  return comparePriorities(newPriority, existingPriority) > 0;
}

/**
 * Check if two time slots overlap
 * @param slot1 - First time slot
 * @param slot2 - Second time slot
 * @returns True if slots overlap
 */
export function slotsOverlap(
  slot1: SchedulingTimeSlot,
  slot2: SchedulingTimeSlot
): boolean {
  const start1 = new Date(slot1.start).getTime();
  const end1 = new Date(slot1.end).getTime();
  const start2 = new Date(slot2.start).getTime();
  const end2 = new Date(slot2.end).getTime();

  // Slots overlap if one starts before the other ends and vice versa
  return start1 < end2 && start2 < end1;
}

/**
 * Convert a Google Calendar event to a Conflict object
 * @param event - Google Calendar event
 * @param calendarId - Calendar ID
 * @returns Conflict object
 */
function eventToConflict(
  event: calendar_v3.Schema$Event,
  calendarId: string
): Conflict {
  const metadata = getBrainDumperMetadata(event);

  return {
    eventId: event.id || '',
    eventTitle: event.summary || 'Untitled Event',
    calendarId,
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    isBrainDumperTask: isBrainDumperEvent(event),
    brainDumperPriority: metadata?.priority,
    brainDumperTaskId: metadata?.taskId,
  };
}

/**
 * Find conflicts for a proposed time slot
 *
 * @param calendar - Authenticated Google Calendar client
 * @param calendarIds - Calendar IDs to check for conflicts
 * @param slot - Proposed time slot
 * @returns Array of conflicts found
 */
export async function findConflicts(
  calendar: calendar_v3.Calendar,
  calendarIds: string[],
  slot: SchedulingTimeSlot
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  // Add buffer to query range to catch edge cases
  const queryStart = new Date(slot.start);
  queryStart.setMinutes(queryStart.getMinutes() - 1);
  const queryEnd = new Date(slot.end);
  queryEnd.setMinutes(queryEnd.getMinutes() + 1);

  for (const calendarId of calendarIds) {
    try {
      const { events } = await fetchEventsInternal(
        calendar,
        calendarId,
        queryStart.toISOString(),
        queryEnd.toISOString(),
        { singleEvents: true }
      );

      for (const event of events) {
        // Skip cancelled events
        if (event.status === 'cancelled') {
          continue;
        }

        // Check if event overlaps with proposed slot
        const eventSlot: SchedulingTimeSlot = {
          start: event.start,
          end: event.end,
        };

        if (slotsOverlap(slot, eventSlot)) {
          conflicts.push(
            eventToConflict(
              {
                id: event.id,
                summary: event.title,
                start: { dateTime: event.start },
                end: { dateTime: event.end },
                status: event.status,
                extendedProperties: event.brainDumperTaskId
                  ? {
                      private: {
                        brainDumperTaskId: event.brainDumperTaskId,
                        brainDumperPriority: event.brainDumperBufferType || '',
                      },
                    }
                  : undefined,
              },
              calendarId
            )
          );
        }
      }
    } catch (error) {
      console.error(`Error checking conflicts for calendar ${calendarId}:`, error);
      // Continue checking other calendars
    }
  }

  return conflicts;
}

/**
 * Check for conflicts and determine if displacement is possible
 *
 * @param userId - User's Firebase UID
 * @param task - Task to be scheduled
 * @param slot - Proposed time slot
 * @param calendarIds - Calendar IDs to check
 * @returns Conflict check result
 *
 * @example
 * const result = await checkConflicts(
 *   'user123',
 *   myTask,
 *   { start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' },
 *   ['primary']
 * );
 */
export async function checkConflicts(
  userId: string,
  task: Task,
  slot: SchedulingTimeSlot,
  calendarIds: string[]
): Promise<ConflictCheckResult> {
  const calendar = await getCalendarClientOrThrow(userId);
  const conflicts = await findConflicts(calendar, calendarIds, slot);

  if (conflicts.length === 0) {
    return {
      hasConflicts: false,
      conflicts: [],
      canDisplace: false,
      displacements: [],
    };
  }

  // Determine which conflicts can be displaced
  const displacements: Displacement[] = [];
  let canDisplaceAll = true;

  for (const conflict of conflicts) {
    if (conflict.isBrainDumperTask && conflict.brainDumperPriority) {
      // Check if new task has higher priority
      if (canDisplaceByPriority(task.priority, conflict.brainDumperPriority)) {
        displacements.push({
          existingTaskId: conflict.brainDumperTaskId || '',
          existingTaskName: conflict.eventTitle,
          existingPriority: conflict.brainDumperPriority,
          newTaskPriority: task.priority,
          reason: `Higher priority task (${task.priority}) displacing ${conflict.brainDumperPriority} priority task`,
        });
      } else {
        // Cannot displace this conflict
        canDisplaceAll = false;
      }
    } else {
      // Non-Brain Dumper events cannot be displaced
      canDisplaceAll = false;
    }
  }

  return {
    hasConflicts: true,
    conflicts,
    canDisplace: canDisplaceAll && displacements.length > 0,
    displacements,
  };
}

/**
 * Determine which existing events a task can displace
 *
 * @param newTask - The new task being scheduled
 * @param existingEvents - Existing calendar events that might be displaced
 * @returns Array of displacements
 */
export function canDisplaceExisting(
  newTask: Task,
  existingEvents: CalendarEvent[]
): Displacement[] {
  const displacements: Displacement[] = [];

  for (const event of existingEvents) {
    // Only Brain Dumper tasks can be displaced
    if (!event.brainDumperTaskId) {
      continue;
    }

    // Get the priority of the existing task
    // We need to infer priority from the event or assume medium if unknown
    const existingPriority: Priority = 'medium'; // Default assumption

    if (canDisplaceByPriority(newTask.priority, existingPriority)) {
      displacements.push({
        existingTaskId: event.brainDumperTaskId,
        existingTaskName: event.title,
        existingPriority,
        newTaskPriority: newTask.priority,
        reason: `Higher priority task (${newTask.priority}) displacing ${existingPriority} priority task`,
      });
    }
  }

  return displacements;
}

/**
 * Check conflicts for multiple time slots and return the best option
 *
 * @param userId - User's Firebase UID
 * @param task - Task to be scheduled
 * @param slots - Array of possible time slots (in preference order)
 * @param calendarIds - Calendar IDs to check
 * @returns Best slot with its conflict check result, or null if none available
 */
export async function findBestSlot(
  userId: string,
  task: Task,
  slots: SchedulingTimeSlot[],
  calendarIds: string[]
): Promise<{
  slot: SchedulingTimeSlot;
  result: ConflictCheckResult;
} | null> {
  // First, try to find a slot with no conflicts
  for (const slot of slots) {
    const result = await checkConflicts(userId, task, slot, calendarIds);
    if (!result.hasConflicts) {
      return { slot, result };
    }
  }

  // If all slots have conflicts, find one where we can displace
  for (const slot of slots) {
    const result = await checkConflicts(userId, task, slot, calendarIds);
    if (result.canDisplace) {
      return { slot, result };
    }
  }

  // No suitable slot found
  return null;
}

/**
 * Get all Brain Dumper events for a user in a time range
 *
 * @param userId - User's Firebase UID
 * @param calendarIds - Calendar IDs to check
 * @param timeMin - Start of time range
 * @param timeMax - End of time range
 * @returns Array of Brain Dumper events with their metadata
 */
export async function getBrainDumperEvents(
  userId: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string
): Promise<
  Array<{
    event: CalendarEvent;
    calendarId: string;
    taskId: string;
    priority?: Priority;
    isBuffer: boolean;
  }>
> {
  const calendar = await getCalendarClientOrThrow(userId);
  const results: Array<{
    event: CalendarEvent;
    calendarId: string;
    taskId: string;
    priority?: Priority;
    isBuffer: boolean;
  }> = [];

  for (const calendarId of calendarIds) {
    try {
      const { events } = await fetchEventsInternal(
        calendar,
        calendarId,
        timeMin,
        timeMax,
        { singleEvents: true }
      );

      for (const event of events) {
        if (event.brainDumperTaskId) {
          results.push({
            event,
            calendarId,
            taskId: event.brainDumperTaskId,
            priority: undefined, // Would need to look up in Firestore
            isBuffer: !!event.brainDumperBufferType,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);
    }
  }

  return results;
}

/**
 * Check if a time slot is within working hours
 *
 * @param slot - Time slot to check
 * @param workingHours - Working hours configuration
 * @param timezone - Timezone (IANA format)
 * @returns True if slot is within working hours
 */
export function isWithinWorkingHours(
  slot: SchedulingTimeSlot,
  workingHours: { start: string; end: string },
  timezone: string
): boolean {
  // Parse working hours
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);

  // Convert slot times to the specified timezone
  const slotStart = new Date(slot.start);
  const slotEnd = new Date(slot.end);

  // Get hours in timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const startParts = formatter.formatToParts(slotStart);
  const endParts = formatter.formatToParts(slotEnd);

  const slotStartHour = parseInt(startParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const slotStartMin = parseInt(startParts.find((p) => p.type === 'minute')?.value || '0', 10);
  const slotEndHour = parseInt(endParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const slotEndMin = parseInt(endParts.find((p) => p.type === 'minute')?.value || '0', 10);

  // Convert to minutes for easier comparison
  const workStart = startHour * 60 + startMin;
  const workEnd = endHour * 60 + endMin;
  const slotStartMins = slotStartHour * 60 + slotStartMin;
  const slotEndMins = slotEndHour * 60 + slotEndMin;

  return slotStartMins >= workStart && slotEndMins <= workEnd;
}
