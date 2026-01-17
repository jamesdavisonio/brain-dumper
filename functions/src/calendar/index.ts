/**
 * Calendar module exports
 * @module calendar
 */

// Calendar list and settings
export { getCalendarList, updateCalendarSettings } from './list';

// Calendar client
export { getCalendarClient, getCalendarClientOrThrow } from './client';

// Fetch events
export { getCalendarEvents, fetchEventsInternal } from './fetchEvents';

// Free/busy query
export {
  getFreeBusy,
  queryFreeBusyInternal,
  mergeBusyPeriodsFromCalendars,
} from './freeBusy';

// Availability calculation
export { getAvailability, calculateAvailabilityInternal } from './availability';

// Events sync
export { syncCalendarEvents, getCachedEvents } from './syncEvents';

// Utility functions
export {
  generateTimeSlots,
  mergeBusyPeriods,
  calculateAvailability as calculateAvailabilityForDay,
  toTimezone,
  fromTimezone,
  getStartOfDay,
  getEndOfDay,
  getDateRange,
  isWorkingDay,
  formatDateString,
  parseDateString,
  TimeSlot,
  BusyPeriod,
  AvailabilityWindow,
} from './utils';
