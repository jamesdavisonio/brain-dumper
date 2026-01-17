/**
 * Scheduling types for Brain Dumper calendar integration
 * @module types/scheduling
 */

import type { Task } from './index'
import type { AvailabilityWindow, TimeSlot } from './calendar'

/**
 * Type of task for scheduling purposes
 * Used to apply different scheduling rules and preferences
 */
export type TaskType =
  | 'deep_work'
  | 'coding'
  | 'call'
  | 'meeting'
  | 'personal'
  | 'admin'
  | 'health'
  | 'other'

/**
 * Scheduling rule that defines preferences for a specific task type
 */
export interface SchedulingRule {
  /** Unique identifier for the rule */
  id: string;
  /** User who owns this rule */
  userId: string;
  /** Type of task this rule applies to */
  taskType: TaskType;
  /** Whether this rule is currently active */
  enabled: boolean;
  /** Preferred time range for scheduling this task type */
  preferredTimeRange: {
    /** Start time in "HH:mm" format (24-hour) */
    start: string;
    /** End time in "HH:mm" format (24-hour) */
    end: string;
  };
  /** Preferred days of the week (0 = Sunday, 6 = Saturday) */
  preferredDays: number[];
  /** Default duration in minutes for this task type */
  defaultDuration: number;
  /** Buffer time in minutes before the task */
  bufferBefore: number;
  /** Buffer time in minutes after the task */
  bufferAfter: number;
  /** Preferred calendar ID for scheduling this task type */
  calendarId?: string;
  /** When the rule was created */
  createdAt: Date;
  /** When the rule was last updated */
  updatedAt: Date;
}

/**
 * Protected time slot that should not be used for scheduling tasks
 * Examples: lunch breaks, exercise time, family time
 */
export interface ProtectedSlot {
  /** Unique identifier for the protected slot */
  id: string;
  /** User who owns this protected slot */
  userId: string;
  /** Display name for this protected time */
  name: string;
  /** Whether this protected slot is currently active */
  enabled: boolean;
  /** Recurrence pattern for this protected slot */
  recurrence: {
    /** Days of the week this applies to (0 = Sunday, 6 = Saturday) */
    daysOfWeek: number[];
    /** Start time in "HH:mm" format (24-hour) */
    startTime: string;
    /** End time in "HH:mm" format (24-hour) */
    endTime: string;
  };
  /** Whether urgent tasks can override this protected slot */
  allowOverrideForUrgent: boolean;
  /** When the protected slot was created */
  createdAt: Date;
}

/**
 * Represents a task that has been scheduled on the calendar
 */
export interface ScheduledTask {
  /** ID of the Brain Dumper task */
  taskId: string;
  /** ID of the calendar event for this task */
  calendarEventId: string;
  /** ID of the calendar the event was created on */
  calendarId: string;
  /** Scheduled start time */
  scheduledStart: Date;
  /** Scheduled end time */
  scheduledEnd: Date;
  /** ID of the buffer event before the task, if created */
  bufferBeforeEventId?: string;
  /** ID of the buffer event after the task, if created */
  bufferAfterEventId?: string;
  /** Current sync status with the calendar */
  syncStatus: 'pending' | 'synced' | 'error' | 'orphaned';
  /** Last time this was synced with the calendar */
  lastSyncAt?: Date;
  /** Error message if sync failed */
  syncError?: string;
}

/**
 * A scheduling suggestion with scoring information
 */
export interface SchedulingSuggestion {
  /** The suggested time slot */
  slot: TimeSlot;
  /** Overall score for this suggestion (0-100) */
  score: number;
  /** Human-readable explanation of why this slot was suggested */
  reasoning: string;
  /** Individual factors that contributed to the score */
  factors: ScoringFactor[];
  /** Any conflicts or warnings for this suggestion */
  conflicts: Conflict[];
}

/**
 * A factor that contributes to the scheduling score
 */
export interface ScoringFactor {
  /** Name of the scoring factor */
  name: string;
  /** Weight of this factor in the overall score */
  weight: number;
  /** Value of this factor (0-100) */
  value: number;
  /** Human-readable description of this factor's contribution */
  description: string;
}

/**
 * Represents a conflict or issue with a scheduling suggestion
 */
export interface Conflict {
  /** Type of conflict */
  type: 'overlap' | 'buffer' | 'rule_violation' | 'protected_slot' | 'outside_hours';
  /** Human-readable description of the conflict */
  description: string;
  /** Severity of the conflict */
  severity: 'info' | 'warning' | 'error';
  /** Suggested resolution for the conflict */
  resolution?: string;
  /** ID of the conflicting event, if applicable */
  conflictingEventId?: string;
}

/**
 * Context information used for scheduling a task
 */
export interface SchedulingContext {
  /** The task to be scheduled */
  task: Task;
  /** Applicable scheduling rules */
  rules: SchedulingRule[];
  /** Protected time slots to avoid */
  protectedSlots: ProtectedSlot[];
  /** Available time windows */
  availability: AvailabilityWindow[];
  /** Tasks already scheduled on the calendar */
  existingScheduledTasks: ScheduledTask[];
  /** User's scheduling preferences */
  userPreferences: UserSchedulingPreferences;
}

/**
 * Working hours for a specific day of the week
 */
export interface WorkingHoursDay {
  /** Day of week (0 = Sunday, 6 = Saturday) */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Whether this day is a working day */
  enabled: boolean;
  /** Start time in "HH:mm" format (24-hour) */
  startTime: string;
  /** End time in "HH:mm" format (24-hour) */
  endTime: string;
}

/**
 * Simplified scheduling rule for task type preferences
 */
export interface TaskTypeRule {
  /** Type of task this rule applies to */
  taskType: TaskType;
  /** Preferred time of day for this task type */
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'flexible';
  /** Default duration in minutes for this task type */
  defaultDuration: number;
  /** Buffer time in minutes before the task */
  bufferBefore: number;
  /** Buffer time in minutes after the task */
  bufferAfter: number;
}

/**
 * Protected time slot that should not be used for scheduling tasks (simplified)
 */
export interface ProtectedTimeSlotConfig {
  /** Unique identifier for the protected slot */
  id: string;
  /** Display name for this protected time */
  name: string;
  /** Recurrence pattern for this protected slot */
  recurrence: 'daily' | 'weekly' | 'weekdays' | 'custom';
  /** Days of the week this applies to (for custom recurrence) */
  dayOfWeek?: number[];
  /** Start time in "HH:mm" format (24-hour) */
  startTime: string;
  /** End time in "HH:mm" format (24-hour) */
  endTime: string;
  /** Whether this protected slot is currently active */
  enabled: boolean;
}

/**
 * User's scheduling preferences
 */
export interface UserSchedulingPreferences {
  /** User ID this preferences belong to */
  userId: string;
  /** Default calendar ID for scheduling tasks */
  defaultCalendarId: string;
  /** Preferred calendar ID for scheduling */
  preferredCalendarId: string | null;
  /** User's working hours per day of week */
  workingHours: WorkingHoursDay[];
  /** Task type specific rules */
  taskTypeRules: TaskTypeRule[];
  /** Protected time slots */
  protectedSlots: ProtectedTimeSlotConfig[];
  /** Default buffer time in minutes before tasks */
  defaultBufferBefore: number;
  /** Default buffer time in minutes after tasks */
  defaultBufferAfter: number;
  /** Whether to keep a slot free for ad-hoc calls */
  keepSlotFreeForCalls: boolean;
  /** Duration in minutes for call slots */
  callSlotDuration: number;
  /** Preferred time for call slots */
  callSlotPreferredTime: 'morning' | 'afternoon' | 'evening';
  /** User's timezone (IANA format, e.g., "America/New_York") */
  timezone: string;
  /** Whether automatic scheduling is enabled */
  autoScheduleEnabled: boolean;
  /** Whether to prefer scheduling tasks in contiguous blocks */
  preferContiguousBlocks: boolean;
}

/**
 * Extension interface for Task to include scheduling fields
 * These fields are added to the base Task interface for calendar integration
 */
export interface TaskSchedulingExtension {
  /** Type of task for scheduling rules */
  taskType?: TaskType;
  /** ID of the calendar event if scheduled */
  calendarEventId?: string;
  /** ID of the calendar the task is scheduled on */
  calendarId?: string;
  /** Scheduled start time */
  scheduledStart?: Date;
  /** Scheduled end time */
  scheduledEnd?: Date;
  /** Current sync status with calendar */
  syncStatus?: 'pending' | 'synced' | 'error' | 'orphaned';
  /** Buffer time in minutes before the task */
  bufferBefore?: number;
  /** Buffer time in minutes after the task */
  bufferAfter?: number;
}
