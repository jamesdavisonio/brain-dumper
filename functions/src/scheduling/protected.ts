/**
 * Protected slots handler for scheduling
 * Manages protected time slots that should not be used for scheduling
 * @module scheduling/protected
 */

import type { Task, ProtectedSlot } from '../types';
import { createDateWithTime } from '../calendar/utils';

/**
 * Represents a time slot for scheduling
 */
export interface TimeSlot {
  /** Start time of the slot */
  start: Date;
  /** End time of the slot */
  end: Date;
  /** Whether this slot is available */
  available: boolean;
}

/**
 * Result from checking if a slot is protected
 */
export interface ProtectedCheckResult {
  /** Whether the slot overlaps with protected time */
  protected: boolean;
  /** The protected slot that overlaps, if any */
  slot?: ProtectedSlot;
  /** Whether the protection can be overridden */
  canOverride: boolean;
  /** Reason for protection */
  reason?: string;
}

/**
 * Expanded protected time instance for a specific date
 */
export interface ProtectedTimeInstance {
  /** Date of this instance */
  date: Date;
  /** Start time of the protected period */
  start: Date;
  /** End time of the protected period */
  end: Date;
  /** Name of the protected slot */
  name: string;
  /** ID of the protected slot */
  slotId: string;
  /** Whether urgent tasks can override */
  allowOverrideForUrgent: boolean;
}

/**
 * Default protected slot for ad-hoc calls
 * Reserves 3-4pm on weekdays for unexpected calls
 */
export const DEFAULT_ADHOC_SLOT: Omit<ProtectedSlot, 'createdAt'> = {
  id: 'default-adhoc',
  userId: '',
  name: 'Ad-hoc calls',
  enabled: true,
  recurrence: {
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '15:00',
    endTime: '16:00',
  },
  allowOverrideForUrgent: true,
};

/**
 * Default protected slot for lunch
 */
export const DEFAULT_LUNCH_SLOT: Omit<ProtectedSlot, 'createdAt'> = {
  id: 'default-lunch',
  userId: '',
  name: 'Lunch',
  enabled: true,
  recurrence: {
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '12:00',
    endTime: '13:00',
  },
  allowOverrideForUrgent: false, // Lunch is sacred!
};

/**
 * Get default protected slots for a user
 *
 * @param userId - The user ID
 * @returns Array of default protected slots
 */
export function getDefaultProtectedSlots(userId: string): ProtectedSlot[] {
  const now = new Date().toISOString();
  return [
    { ...DEFAULT_ADHOC_SLOT, userId, createdAt: now },
    { ...DEFAULT_LUNCH_SLOT, userId, createdAt: now },
  ];
}

/**
 * Check if a time slot overlaps with protected time
 *
 * @param slot - The time slot to check
 * @param protectedSlots - Array of protected slots to check against
 * @param timezone - User's timezone for calculating protected times
 * @returns ProtectedCheckResult indicating if and why the slot is protected
 */
export function isProtectedTime(
  slot: TimeSlot,
  protectedSlots: ProtectedSlot[],
  timezone: string = 'UTC'
): ProtectedCheckResult {
  const slotDate = new Date(slot.start);
  const dayOfWeek = slotDate.getDay();

  for (const protectedSlot of protectedSlots) {
    // Skip disabled slots
    if (!protectedSlot.enabled) {
      continue;
    }

    // Check if this day is in the recurrence pattern
    if (!protectedSlot.recurrence.daysOfWeek.includes(dayOfWeek)) {
      continue;
    }

    // Calculate protected time for this specific day
    const protectedStart = createDateWithTime(
      slotDate,
      protectedSlot.recurrence.startTime,
      timezone
    );
    const protectedEnd = createDateWithTime(
      slotDate,
      protectedSlot.recurrence.endTime,
      timezone
    );

    // Check for overlap
    if (slot.start < protectedEnd && slot.end > protectedStart) {
      return {
        protected: true,
        slot: protectedSlot,
        canOverride: protectedSlot.allowOverrideForUrgent,
        reason: `Overlaps with "${protectedSlot.name}" (${protectedSlot.recurrence.startTime}-${protectedSlot.recurrence.endTime})`,
      };
    }
  }

  return {
    protected: false,
    canOverride: true,
  };
}

/**
 * Get all protected time instances for a date range
 *
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @param protectedSlots - Array of protected slot configurations
 * @param timezone - User's timezone
 * @returns Array of expanded protected time instances
 */
export function getProtectedTimes(
  startDate: Date,
  endDate: Date,
  protectedSlots: ProtectedSlot[],
  timezone: string = 'UTC'
): ProtectedTimeInstance[] {
  const instances: ProtectedTimeInstance[] = [];

  // Iterate through each day in the range
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  const endDateNorm = new Date(endDate);
  endDateNorm.setHours(23, 59, 59, 999);

  while (currentDate <= endDateNorm) {
    const dayOfWeek = currentDate.getDay();

    for (const protectedSlot of protectedSlots) {
      // Skip disabled slots
      if (!protectedSlot.enabled) {
        continue;
      }

      // Check if this day is in the recurrence pattern
      if (!protectedSlot.recurrence.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }

      // Create the protected time instance for this day
      const start = createDateWithTime(
        currentDate,
        protectedSlot.recurrence.startTime,
        timezone
      );
      const end = createDateWithTime(
        currentDate,
        protectedSlot.recurrence.endTime,
        timezone
      );

      instances.push({
        date: new Date(currentDate),
        start,
        end,
        name: protectedSlot.name,
        slotId: protectedSlot.id,
        allowOverrideForUrgent: protectedSlot.allowOverrideForUrgent,
      });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return instances;
}

/**
 * Check if an urgent task can override a protected slot
 *
 * @param task - The task to check
 * @param protectedSlot - The protected slot to potentially override
 * @returns Boolean indicating if override is allowed
 */
export function canOverrideProtected(
  task: Task,
  protectedSlot: ProtectedSlot
): boolean {
  // Only high-priority tasks can override
  if (task.priority !== 'high') {
    return false;
  }

  // Check if the slot allows override for urgent tasks
  if (!protectedSlot.allowOverrideForUrgent) {
    return false;
  }

  // Check if task has an urgent due date (within 24 hours)
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Task is urgent if due within 24 hours
    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return true;
    }
  }

  // High priority tasks without due dates can override if allowed
  return protectedSlot.allowOverrideForUrgent;
}

/**
 * Filter out slots that overlap with protected times
 *
 * @param slots - Array of time slots to filter
 * @param protectedSlots - Array of protected slot configurations
 * @param task - The task being scheduled (used to check for urgent override)
 * @param timezone - User's timezone
 * @returns Filtered array of non-protected slots
 */
export function filterProtectedSlots(
  slots: TimeSlot[],
  protectedSlots: ProtectedSlot[],
  task: Task | null,
  timezone: string = 'UTC'
): TimeSlot[] {
  return slots.filter((slot) => {
    const result = isProtectedTime(slot, protectedSlots, timezone);

    // If not protected, include the slot
    if (!result.protected) {
      return true;
    }

    // If protected, check if task can override
    if (task && result.slot && canOverrideProtected(task, result.slot)) {
      return true;
    }

    // Protected and cannot override
    return false;
  });
}

/**
 * Get conflicts between a slot and protected times
 *
 * @param slot - The time slot to check
 * @param protectedSlots - Array of protected slot configurations
 * @param task - The task being scheduled
 * @param timezone - User's timezone
 * @returns Array of conflict descriptions
 */
export function getProtectedConflicts(
  slot: TimeSlot,
  protectedSlots: ProtectedSlot[],
  task: Task | null,
  timezone: string = 'UTC'
): Array<{
  type: 'protected_slot';
  description: string;
  severity: 'warning' | 'error';
  resolution?: string;
}> {
  const conflicts: Array<{
    type: 'protected_slot';
    description: string;
    severity: 'warning' | 'error';
    resolution?: string;
  }> = [];

  const result = isProtectedTime(slot, protectedSlots, timezone);

  if (result.protected && result.slot) {
    const canOverride = task && canOverrideProtected(task, result.slot);

    conflicts.push({
      type: 'protected_slot',
      description: result.reason || `Overlaps with protected time: ${result.slot.name}`,
      severity: canOverride ? 'warning' : 'error',
      resolution: canOverride
        ? 'High priority task can override this protected time'
        : result.slot.allowOverrideForUrgent
          ? 'Only high-priority urgent tasks can override this time'
          : 'This protected time cannot be overridden',
    });
  }

  return conflicts;
}

/**
 * Check if a task is considered urgent
 *
 * @param task - The task to check
 * @returns Boolean indicating if task is urgent
 */
export function isUrgentTask(task: Task): boolean {
  // High priority is urgent
  if (task.priority === 'high') {
    return true;
  }

  // Due within 24 hours is urgent
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return true;
    }
  }

  return false;
}
