/**
 * Calendar utility functions
 * Provides helpers for time slot generation, busy period merging, and availability calculation
 * @module calendar/utils
 */

/**
 * Represents a time slot for availability calculation
 */
export interface TimeSlot {
  /** Start time of the slot */
  start: Date;
  /** End time of the slot */
  end: Date;
  /** Whether the slot is available */
  available: boolean;
}

/**
 * Represents a busy period from calendar events
 */
export interface BusyPeriod {
  /** Start time of the busy period */
  start: Date;
  /** End time of the busy period */
  end: Date;
}

/**
 * Represents availability for a specific day
 */
export interface AvailabilityWindow {
  /** Date string in ISO format (YYYY-MM-DD) */
  date: string;
  /** Day of week (0 = Sunday, 6 = Saturday) */
  dayOfWeek: number;
  /** Total available minutes for the day */
  totalAvailableMinutes: number;
  /** Available time slots */
  availableSlots: Array<{ start: string; end: string }>;
  /** Busy time slots */
  busySlots: Array<{ start: string; end: string }>;
}

/**
 * Parse a time string in "HH:mm" format to hours and minutes
 *
 * @param timeStr - Time string in "HH:mm" format
 * @returns Object with hours and minutes
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Create a date with specific time in a given timezone
 *
 * @param date - Base date
 * @param timeStr - Time string in "HH:mm" format
 * @param timezone - IANA timezone string
 * @returns Date with the specified time
 */
export function createDateWithTime(
  date: Date,
  timeStr: string,
  timezone: string
): Date {
  const { hours, minutes } = parseTimeString(timeStr);

  // Create a date string in the target timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(hours).padStart(2, '0');
  const minute = String(minutes).padStart(2, '0');

  // Format: YYYY-MM-DDTHH:mm:ss
  const dateTimeStr = `${year}-${month}-${day}T${hour}:${minute}:00`;

  // Parse in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Use a reference point to calculate the offset
  const targetDate = new Date(dateTimeStr);

  // Get the offset for the target timezone at this time
  const utcDate = new Date(
    Date.UTC(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      targetDate.getHours(),
      targetDate.getMinutes(),
      targetDate.getSeconds()
    )
  );

  // Parse the formatted date to get timezone offset
  const parts = formatter.formatToParts(utcDate);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || '0';

  const localYear = parseInt(getPart('year'), 10);
  const localMonth = parseInt(getPart('month'), 10) - 1;
  const localDay = parseInt(getPart('day'), 10);
  const localHour = parseInt(getPart('hour'), 10);
  const localMinute = parseInt(getPart('minute'), 10);

  // Calculate the difference to find the offset
  const localDate = new Date(localYear, localMonth, localDay, localHour, localMinute);
  const offsetMs = utcDate.getTime() - localDate.getTime();

  // Apply the offset to get the correct UTC time
  return new Date(targetDate.getTime() + offsetMs);
}

/**
 * Generate time slots for a given day within working hours
 *
 * @param date - The date to generate slots for
 * @param workingHours - Working hours configuration
 * @param intervalMinutes - Slot duration in minutes (default 30)
 * @param timezone - IANA timezone string (default 'UTC')
 * @returns Array of time slots
 */
export function generateTimeSlots(
  date: Date,
  workingHours: { start: string; end: string },
  intervalMinutes: number = 30,
  timezone: string = 'UTC'
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Get start and end times in the user's timezone
  const dayStart = createDateWithTime(date, workingHours.start, timezone);
  const dayEnd = createDateWithTime(date, workingHours.end, timezone);

  // Handle case where end time is before start time (shouldn't happen normally)
  if (dayEnd <= dayStart) {
    return slots;
  }

  let currentSlotStart = new Date(dayStart);

  while (currentSlotStart < dayEnd) {
    const currentSlotEnd = new Date(currentSlotStart.getTime() + intervalMinutes * 60 * 1000);

    // Don't create slots that extend past working hours
    if (currentSlotEnd > dayEnd) {
      break;
    }

    slots.push({
      start: new Date(currentSlotStart),
      end: new Date(currentSlotEnd),
      available: true, // Default to available, will be marked busy later
    });

    currentSlotStart = currentSlotEnd;
  }

  return slots;
}

/**
 * Merge overlapping busy periods into consolidated periods
 *
 * @param periods - Array of busy periods (may overlap)
 * @returns Array of merged, non-overlapping busy periods
 */
export function mergeBusyPeriods(periods: BusyPeriod[]): BusyPeriod[] {
  if (periods.length === 0) {
    return [];
  }

  // Sort periods by start time
  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: BusyPeriod[] = [];
  let current = { ...sorted[0], start: new Date(sorted[0].start), end: new Date(sorted[0].end) };

  for (let i = 1; i < sorted.length; i++) {
    const period = sorted[i];

    // Check if periods overlap or are adjacent
    if (period.start.getTime() <= current.end.getTime()) {
      // Extend current period if this one ends later
      if (period.end.getTime() > current.end.getTime()) {
        current.end = new Date(period.end);
      }
    } else {
      // No overlap, save current and start new
      merged.push(current);
      current = { start: new Date(period.start), end: new Date(period.end) };
    }
  }

  // Don't forget the last period
  merged.push(current);

  return merged;
}

/**
 * Calculate availability windows from busy periods within working hours
 *
 * @param date - The date to calculate availability for
 * @param busyPeriods - Array of busy periods
 * @param workingHours - Working hours configuration
 * @param intervalMinutes - Slot duration in minutes
 * @param timezone - IANA timezone string
 * @returns Availability window for the day
 */
export function calculateAvailability(
  date: Date,
  busyPeriods: BusyPeriod[],
  workingHours: { start: string; end: string },
  intervalMinutes: number = 30,
  timezone: string = 'UTC'
): AvailabilityWindow {
  // Generate time slots for the day
  const slots = generateTimeSlots(date, workingHours, intervalMinutes, timezone);

  // Merge overlapping busy periods
  const mergedBusy = mergeBusyPeriods(busyPeriods);

  // Mark slots as unavailable if they overlap with busy periods
  for (const slot of slots) {
    for (const busy of mergedBusy) {
      // Check if slot overlaps with busy period
      if (slot.start < busy.end && slot.end > busy.start) {
        slot.available = false;
        break;
      }
    }
  }

  // Calculate available and busy slots
  const availableSlots: Array<{ start: string; end: string }> = [];
  const busySlots: Array<{ start: string; end: string }> = [];

  // Group consecutive available slots
  let currentAvailableStart: Date | null = null;
  let currentAvailableEnd: Date | null = null;

  for (const slot of slots) {
    if (slot.available) {
      if (currentAvailableStart === null) {
        currentAvailableStart = slot.start;
      }
      currentAvailableEnd = slot.end;
    } else {
      // End current available streak
      if (currentAvailableStart !== null && currentAvailableEnd !== null) {
        availableSlots.push({
          start: currentAvailableStart.toISOString(),
          end: currentAvailableEnd.toISOString(),
        });
      }
      currentAvailableStart = null;
      currentAvailableEnd = null;
    }
  }

  // Don't forget the last available streak
  if (currentAvailableStart !== null && currentAvailableEnd !== null) {
    availableSlots.push({
      start: currentAvailableStart.toISOString(),
      end: currentAvailableEnd.toISOString(),
    });
  }

  // Calculate busy slots within working hours
  const dayStart = createDateWithTime(date, workingHours.start, timezone);
  const dayEnd = createDateWithTime(date, workingHours.end, timezone);

  for (const busy of mergedBusy) {
    // Only include busy periods that overlap with working hours
    const overlapStart = new Date(Math.max(busy.start.getTime(), dayStart.getTime()));
    const overlapEnd = new Date(Math.min(busy.end.getTime(), dayEnd.getTime()));

    if (overlapStart < overlapEnd) {
      busySlots.push({
        start: overlapStart.toISOString(),
        end: overlapEnd.toISOString(),
      });
    }
  }

  // Calculate total available minutes
  const totalAvailableMinutes = availableSlots.reduce((total, slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    return total + (end.getTime() - start.getTime()) / (1000 * 60);
  }, 0);

  // Format date string
  const dateStr = date.toISOString().split('T')[0];

  return {
    date: dateStr,
    dayOfWeek: date.getDay(),
    totalAvailableMinutes,
    availableSlots,
    busySlots,
  };
}

/**
 * Convert a date to a specific timezone
 * Returns a Date object representing the same instant but
 * with getHours/getMinutes returning values for the specified timezone
 *
 * @param date - The date to convert
 * @param timezone - IANA timezone string
 * @returns Date formatted for the timezone (as a string for display)
 */
export function toTimezone(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', { timeZone: timezone });
}

/**
 * Parse a date string from a specific timezone to UTC
 *
 * @param dateStr - Date string in ISO format or locale format
 * @param timezone - IANA timezone string the date is in
 * @returns Date object in UTC
 */
export function fromTimezone(dateStr: string, timezone: string): Date {
  // If it's already an ISO string with Z, it's UTC
  if (dateStr.endsWith('Z')) {
    return new Date(dateStr);
  }

  // Parse the date in the given timezone
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  return date;
}

/**
 * Get the start of day in a specific timezone
 *
 * @param date - The date
 * @param timezone - IANA timezone string
 * @returns Start of day in the specified timezone
 */
export function getStartOfDay(date: Date, timezone: string): Date {
  return createDateWithTime(date, '00:00', timezone);
}

/**
 * Get the end of day in a specific timezone
 *
 * @param date - The date
 * @param timezone - IANA timezone string
 * @returns End of day (23:59) in the specified timezone
 */
export function getEndOfDay(date: Date, timezone: string): Date {
  return createDateWithTime(date, '23:59', timezone);
}

/**
 * Generate an array of dates between two dates (inclusive)
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of dates
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a date is a working day based on working days configuration
 *
 * @param date - The date to check
 * @param workingDays - Array of working day numbers (0 = Sunday, 6 = Saturday)
 * @returns True if the date is a working day
 */
export function isWorkingDay(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(date.getDay());
}

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse an ISO date string to a Date object
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object at midnight UTC
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
