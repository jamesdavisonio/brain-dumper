/**
 * Webhooks module exports
 * @module webhooks
 */

// Watch Manager exports
export {
  WatchSubscription,
  createWatch,
  stopWatch,
  renewExpiringWatches,
  getWatchByChannel,
  getWatchesForUser,
  stopAllWatchesForUser,
  renewCalendarWatches,
} from './watchManager';

// Event Processor exports
export {
  CalendarEventChange,
  processCalendarSync,
  processSingleEvent,
  getLastSyncTime,
  clearSyncToken,
} from './eventProcessor';

// Calendar Webhook exports
export {
  calendarWebhook,
  triggerCalendarSync,
  setupCalendarWatch,
  stopCalendarWatch,
} from './calendarWebhook';
