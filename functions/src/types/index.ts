/**
 * Shared types for Brain Dumper Cloud Functions
 * These types are designed to be compatible with both Firebase Admin SDK
 * and the frontend application. Dates are represented as ISO strings
 * for Firestore serialization compatibility.
 * @module functions/types
 */

// ============================================================
// Calendar Types
// ============================================================

/**
 * Represents a connected calendar from an external provider
 */
export interface ConnectedCalendar {
  /** Unique identifier for the calendar */
  id: string;
  /** Display name of the calendar */
  name: string;
  /** Whether this is a work or personal calendar */
  type: 'work' | 'personal';
  /** Color used for displaying calendar events */
  color: string;
  /** Whether this is the user's primary calendar */
  primary: boolean;
  /** User's access level for this calendar */
  accessRole: 'reader' | 'writer' | 'owner';
  /** Whether sync is enabled for this calendar */
  enabled: boolean;
  /** Token used for incremental sync with the calendar provider */
  syncToken?: string;
  /** ISO timestamp of the last successful sync */
  lastSyncAt?: string;
}

/**
 * Represents a calendar event from an external calendar
 * Uses ISO date strings for Firestore compatibility
 */
export interface CalendarEvent {
  /** Unique identifier for the event */
  id: string;
  /** ID of the calendar this event belongs to */
  calendarId: string;
  /** Title/summary of the event */
  title: string;
  /** Optional description or notes for the event */
  description?: string;
  /** Start time as ISO string */
  start: string;
  /** End time as ISO string */
  end: string;
  /** Whether this is an all-day event */
  allDay: boolean;
  /** Confirmation status of the event */
  status: 'confirmed' | 'tentative' | 'cancelled';
  /** ID of the Brain Dumper task this event is linked to, if any */
  brainDumperTaskId?: string;
  /** If this event is a buffer, indicates whether it's before or after the main event */
  brainDumperBufferType?: 'before' | 'after';
  /** ID of the recurring event series this belongs to, if applicable */
  recurringEventId?: string;
  /** Link to view the event in the external calendar */
  htmlLink?: string;
}

/**
 * Represents the current sync status with external calendars
 */
export interface CalendarSyncStatus {
  /** ISO timestamp of the last sync attempt */
  lastSyncAt: string;
  /** Current sync status */
  status: 'synced' | 'syncing' | 'error' | 'pending';
  /** Error message if sync failed */
  error?: string;
  /** Number of events created in the last sync */
  eventsCreated: number;
  /** Number of events updated in the last sync */
  eventsUpdated: number;
  /** Number of events deleted in the last sync */
  eventsDeleted: number;
}

/**
 * OAuth tokens for calendar provider authentication
 * Note: These should be stored securely server-side only
 */
export interface OAuthTokens {
  /** Access token for API requests */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Expiration time as ISO string */
  expiresAt: string;
  /** OAuth scope granted */
  scope: string;
}

// ============================================================
// Scheduling Types
// ============================================================

/**
 * Type of task for scheduling purposes
 */
export type TaskType =
  | 'deep_work'
  | 'coding'
  | 'call'
  | 'meeting'
  | 'personal'
  | 'admin'
  | 'health'
  | 'other';

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
  /** When the rule was created (ISO string) */
  createdAt: string;
  /** When the rule was last updated (ISO string) */
  updatedAt: string;
}

/**
 * Protected time slot that should not be used for scheduling tasks
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
  /** When the protected slot was created (ISO string) */
  createdAt: string;
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
  /** Scheduled start time (ISO string) */
  scheduledStart: string;
  /** Scheduled end time (ISO string) */
  scheduledEnd: string;
  /** ID of the buffer event before the task, if created */
  bufferBeforeEventId?: string;
  /** ID of the buffer event after the task, if created */
  bufferAfterEventId?: string;
  /** Current sync status with the calendar */
  syncStatus: 'pending' | 'synced' | 'error' | 'orphaned';
  /** Last time this was synced with the calendar (ISO string) */
  lastSyncAt?: string;
  /** Error message if sync failed */
  syncError?: string;
}

/**
 * User's scheduling preferences
 */
export interface UserSchedulingPreferences {
  /** Default calendar ID for scheduling tasks */
  defaultCalendarId: string;
  /** User's working hours */
  workingHours: {
    /** Start time in "HH:mm" format (24-hour) */
    start: string;
    /** End time in "HH:mm" format (24-hour) */
    end: string;
  };
  /** Days the user typically works (0 = Sunday, 6 = Saturday) */
  workingDays: number[];
  /** User's timezone (IANA format, e.g., "America/New_York") */
  timezone: string;
  /** Whether automatic scheduling is enabled */
  autoScheduleEnabled: boolean;
  /** Whether to prefer scheduling tasks in contiguous blocks */
  preferContiguousBlocks: boolean;
}

// ============================================================
// Task Types (Extended for Calendar Integration)
// ============================================================

export type Priority = 'high' | 'medium' | 'low';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Recurrence {
  type: RecurrenceType;
  interval: number;
  daysOfWeek?: number[];
  endDate?: string;
}

/**
 * Task interface with calendar integration fields
 * Uses ISO date strings for Firestore compatibility
 */
export interface Task {
  id: string;
  content: string;
  project?: string;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  timeEstimate?: number;
  completed: boolean;
  archived: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  recurrence?: Recurrence;
  category?: string;
  // Calendar integration fields
  taskType?: TaskType;
  calendarEventId?: string;
  calendarId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  syncStatus?: 'pending' | 'synced' | 'error' | 'orphaned';
  bufferBefore?: number;
  bufferAfter?: number;
}

// ============================================================
// Notification Types
// ============================================================

/**
 * Notification preferences for a user
 */
export interface NotificationPreferences {
  enabled: boolean;
  time: string; // HH:MM format
  days: number[]; // 0=Sunday, 1=Monday, etc.
  timezone: string;
}

// ============================================================
// Utility Types
// ============================================================

/**
 * Result of a calendar sync operation
 */
export interface SyncResult {
  success: boolean;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
  syncToken?: string;
}

/**
 * Request body for scheduling a task
 */
export interface ScheduleTaskRequest {
  taskId: string;
  calendarId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  bufferBefore?: number;
  bufferAfter?: number;
}

/**
 * Response from scheduling a task
 */
export interface ScheduleTaskResponse {
  success: boolean;
  eventId?: string;
  bufferBeforeEventId?: string;
  bufferAfterEventId?: string;
  error?: string;
}

/**
 * Google Calendar API event structure (simplified)
 */
export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  recurringEventId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Converts a Date to ISO string, handling undefined values
 */
export function toISOString(date: Date | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

/**
 * Converts an ISO string to Date, handling undefined values
 */
export function fromISOString(isoString: string | undefined): Date | undefined {
  return isoString ? new Date(isoString) : undefined;
}

/**
 * Validates a time string in "HH:mm" format
 */
export function isValidTimeString(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * Validates a day of week number (0-6)
 */
export function isValidDayOfWeek(day: number): boolean {
  return Number.isInteger(day) && day >= 0 && day <= 6;
}

// ============================================================
// Scheduling Proposal Types
// ============================================================

/**
 * Represents a time slot for scheduling
 */
export interface SchedulingTimeSlot {
  /** Start time as ISO string */
  start: string;
  /** End time as ISO string */
  end: string;
}

/**
 * Represents a conflict with an existing calendar event
 */
export interface Conflict {
  /** ID of the conflicting event */
  eventId: string;
  /** Title of the conflicting event */
  eventTitle: string;
  /** Calendar ID where the conflict exists */
  calendarId: string;
  /** Start time of the conflicting event */
  start: string;
  /** End time of the conflicting event */
  end: string;
  /** Whether this is a Brain Dumper task */
  isBrainDumperTask: boolean;
  /** Priority if it's a Brain Dumper task */
  brainDumperPriority?: Priority;
  /** Task ID if it's a Brain Dumper task */
  brainDumperTaskId?: string;
}

/**
 * Represents a displacement of an existing task
 */
export interface Displacement {
  /** ID of the existing task being displaced */
  existingTaskId: string;
  /** Name of the existing task */
  existingTaskName: string;
  /** Priority of the existing task */
  existingPriority: Priority;
  /** Priority of the new task causing displacement */
  newTaskPriority: Priority;
  /** Reason for displacement */
  reason: string;
  /** Suggested new slot for the displaced task */
  suggestedNewSlot?: SchedulingTimeSlot;
}

/**
 * Proposed slot for a task
 */
export interface ProposedSlot {
  /** The task to be scheduled */
  task: Task;
  /** The proposed time slot */
  slot: SchedulingTimeSlot;
  /** Calendar ID for the event */
  calendarId: string;
  /** Any conflicts at this slot */
  conflicts: Conflict[];
  /** Tasks that would be displaced */
  displacements: Displacement[];
}

/**
 * Task that could not be scheduled
 */
export interface UnschedulableTask {
  /** The task that couldn't be scheduled */
  task: Task;
  /** Reason it couldn't be scheduled */
  reason: string;
}

/**
 * Summary of a schedule proposal
 */
export interface ProposalSummary {
  /** Total number of tasks in the proposal */
  totalTasks: number;
  /** Number of tasks that can be scheduled */
  scheduled: number;
  /** Number of conflicts encountered */
  conflicts: number;
  /** Number of displacements required */
  displacements: number;
}

/**
 * A complete schedule proposal for user approval
 */
export interface ScheduleProposal {
  /** Unique identifier for the proposal */
  id: string;
  /** User ID who owns this proposal */
  userId: string;
  /** When the proposal was created */
  createdAt: string;
  /** When the proposal expires */
  expiresAt: string;
  /** Tasks with proposed slots */
  proposedSlots: ProposedSlot[];
  /** Tasks that couldn't be scheduled */
  unschedulable: UnschedulableTask[];
  /** Summary statistics */
  summary: ProposalSummary;
  /** Options used to create this proposal */
  options: {
    respectPriority: boolean;
    includeBuffers: boolean;
    preferredCalendarId?: string;
  };
}

/**
 * Result of checking for conflicts
 */
export interface ConflictCheckResult {
  /** Whether any conflicts were found */
  hasConflicts: boolean;
  /** List of conflicts */
  conflicts: Conflict[];
  /** Whether all conflicts can be displaced by higher priority */
  canDisplace: boolean;
  /** Displacements that would be needed */
  displacements: Displacement[];
}

/**
 * Result of confirming a schedule
 */
export interface ConfirmResult {
  /** Whether the confirmation was successful overall */
  success: boolean;
  /** Tasks that were successfully scheduled */
  scheduled: Array<{
    taskId: string;
    calendarEventId: string;
    scheduledStart: string;
    scheduledEnd: string;
  }>;
  /** Tasks that were displaced */
  displaced: Array<{
    taskId: string;
    newSlot?: SchedulingTimeSlot;
    unscheduled: boolean;
  }>;
  /** Errors encountered */
  errors: Array<{
    taskId: string;
    error: string;
  }>;
}

/**
 * Result of scheduling a single task
 */
export interface ScheduleTaskResult {
  /** Whether the scheduling was successful */
  success: boolean;
  /** Calendar event ID if created */
  calendarEventId?: string;
  /** Buffer event ID before the task */
  bufferBeforeEventId?: string;
  /** Buffer event ID after the task */
  bufferAfterEventId?: string;
  /** Conflicts if any (only if requiresApproval is true) */
  conflicts?: Conflict[];
  /** Whether user approval is required */
  requiresApproval?: boolean;
  /** Error message if failed */
  error?: string;
}
