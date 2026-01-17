/**
 * Sync module exports
 * Provides task <-> calendar synchronization
 * @module sync
 */

// Utility functions
export {
  SyncMetadata,
  getCalendarClient,
  updateSyncMetadata,
  shouldSyncTask,
  datesAreDifferent,
  toDate
} from './syncUtils';

// Calendar sync operations
export {
  TaskData,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  deleteCalendarEventDirect
} from './calendarSync';

// Firestore triggers
export {
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted
} from './taskTriggers';
