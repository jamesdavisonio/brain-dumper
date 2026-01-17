/**
 * Availability functions tests
 * Tests for time slot generation, busy period merging, and availability calculation
 * @module __tests__/availability.test
 */

import { describe, it, expect } from 'vitest';
import {
  generateTimeSlots,
  mergeBusyPeriods,
  calculateAvailability,
  parseTimeString,
  getDateRange,
  isWorkingDay,
  formatDateString,
  parseDateString,
  BusyPeriod,
} from '../calendar/utils';

describe('parseTimeString', () => {
  it('should parse valid time strings', () => {
    expect(parseTimeString('09:00')).toEqual({ hours: 9, minutes: 0 });
    expect(parseTimeString('13:30')).toEqual({ hours: 13, minutes: 30 });
    expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('should handle edge cases', () => {
    expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeString('12:00')).toEqual({ hours: 12, minutes: 0 });
  });
});

describe('generateTimeSlots', () => {
  const testDate = new Date('2024-01-15');
  const workingHours = { start: '09:00', end: '17:00' };

  it('should generate correct number of 30-minute slots for 8-hour workday', () => {
    const slots = generateTimeSlots(testDate, workingHours, 30, 'UTC');
    // 8 hours = 16 thirty-minute slots
    expect(slots.length).toBe(16);
  });

  it('should generate correct number of 60-minute slots', () => {
    const slots = generateTimeSlots(testDate, workingHours, 60, 'UTC');
    // 8 hours = 8 sixty-minute slots
    expect(slots.length).toBe(8);
  });

  it('should generate correct number of 15-minute slots', () => {
    const slots = generateTimeSlots(testDate, workingHours, 15, 'UTC');
    // 8 hours = 32 fifteen-minute slots
    expect(slots.length).toBe(32);
  });

  it('should mark all slots as available by default', () => {
    const slots = generateTimeSlots(testDate, workingHours, 30, 'UTC');
    expect(slots.every((slot) => slot.available)).toBe(true);
  });

  it('should handle short working hours', () => {
    const shortHours = { start: '10:00', end: '12:00' };
    const slots = generateTimeSlots(testDate, shortHours, 30, 'UTC');
    // 2 hours = 4 thirty-minute slots
    expect(slots.length).toBe(4);
  });

  it('should return empty array if end time is before start time', () => {
    const invalidHours = { start: '17:00', end: '09:00' };
    const slots = generateTimeSlots(testDate, invalidHours, 30, 'UTC');
    expect(slots.length).toBe(0);
  });

  it('should handle same start and end time', () => {
    const sameHours = { start: '09:00', end: '09:00' };
    const slots = generateTimeSlots(testDate, sameHours, 30, 'UTC');
    expect(slots.length).toBe(0);
  });

  it('should not create partial slots at end of working hours', () => {
    const oddHours = { start: '09:00', end: '17:15' };
    const slots = generateTimeSlots(testDate, oddHours, 30, 'UTC');
    // 8h15m / 30min = 16 full slots (the last 15 minutes don't make a full slot)
    expect(slots.length).toBe(16);
  });
});

describe('mergeBusyPeriods', () => {
  it('should return empty array for empty input', () => {
    const merged = mergeBusyPeriods([]);
    expect(merged).toEqual([]);
  });

  it('should return single period unchanged', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(1);
    expect(merged[0].start.getTime()).toBe(periods[0].start.getTime());
    expect(merged[0].end.getTime()).toBe(periods[0].end.getTime());
  });

  it('should merge overlapping periods', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T10:30:00Z'), end: new Date('2024-01-15T12:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(1);
    expect(merged[0].start.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2024-01-15T12:00:00.000Z');
  });

  it('should merge adjacent periods', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T11:00:00Z'), end: new Date('2024-01-15T12:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(1);
    expect(merged[0].start.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2024-01-15T12:00:00.000Z');
  });

  it('should not merge non-overlapping periods', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T13:00:00Z'), end: new Date('2024-01-15T14:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(2);
  });

  it('should handle periods in unsorted order', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T13:00:00Z'), end: new Date('2024-01-15T14:00:00Z') },
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T10:30:00Z'), end: new Date('2024-01-15T12:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(2);
    expect(merged[0].start.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2024-01-15T12:00:00.000Z');
    expect(merged[1].start.toISOString()).toBe('2024-01-15T13:00:00.000Z');
    expect(merged[1].end.toISOString()).toBe('2024-01-15T14:00:00.000Z');
  });

  it('should merge multiple overlapping periods', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T10:30:00Z'), end: new Date('2024-01-15T11:30:00Z') },
      { start: new Date('2024-01-15T11:15:00Z'), end: new Date('2024-01-15T12:00:00Z') },
      { start: new Date('2024-01-15T11:45:00Z'), end: new Date('2024-01-15T13:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(1);
    expect(merged[0].start.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2024-01-15T13:00:00.000Z');
  });

  it('should handle period completely contained within another', () => {
    const periods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T14:00:00Z') },
      { start: new Date('2024-01-15T11:00:00Z'), end: new Date('2024-01-15T12:00:00Z') },
    ];
    const merged = mergeBusyPeriods(periods);
    expect(merged.length).toBe(1);
    expect(merged[0].start.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2024-01-15T14:00:00.000Z');
  });
});

describe('calculateAvailability', () => {
  const testDate = new Date('2024-01-15');
  const workingHours = { start: '09:00', end: '17:00' };

  it('should return full availability when no busy periods', () => {
    const availability = calculateAvailability(testDate, [], workingHours, 30, 'UTC');

    expect(availability.date).toBe('2024-01-15');
    expect(availability.dayOfWeek).toBe(testDate.getDay());
    expect(availability.totalAvailableMinutes).toBe(8 * 60); // 8 hours
    expect(availability.availableSlots.length).toBe(1); // One continuous available slot
    expect(availability.busySlots.length).toBe(0);
  });

  it('should mark slots as busy when events exist', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have 7 hours available (8 - 1 hour meeting)
    expect(availability.totalAvailableMinutes).toBe(7 * 60);
    expect(availability.busySlots.length).toBe(1);
  });

  it('should handle multiple busy periods', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T09:00:00Z'), end: new Date('2024-01-15T10:00:00Z') },
      { start: new Date('2024-01-15T14:00:00Z'), end: new Date('2024-01-15T15:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have 6 hours available (8 - 2 hours of meetings)
    expect(availability.totalAvailableMinutes).toBe(6 * 60);
    expect(availability.busySlots.length).toBe(2);
  });

  it('should handle busy periods that span entire working hours', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T08:00:00Z'), end: new Date('2024-01-15T18:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    expect(availability.totalAvailableMinutes).toBe(0);
    expect(availability.availableSlots.length).toBe(0);
    expect(availability.busySlots.length).toBe(1);
  });

  it('should handle busy periods outside working hours', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T07:00:00Z'), end: new Date('2024-01-15T08:00:00Z') },
      { start: new Date('2024-01-15T18:00:00Z'), end: new Date('2024-01-15T19:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have full 8 hours available since meetings are outside working hours
    expect(availability.totalAvailableMinutes).toBe(8 * 60);
    expect(availability.busySlots.length).toBe(0); // No busy slots within working hours
  });

  it('should handle busy periods that partially overlap working hours', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T08:00:00Z'), end: new Date('2024-01-15T10:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have 7 hours available (only 1 hour of overlap)
    expect(availability.totalAvailableMinutes).toBe(7 * 60);
    expect(availability.busySlots.length).toBe(1);
  });

  it('should create separate available slots around busy periods', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T12:00:00Z'), end: new Date('2024-01-15T13:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have 2 available slots: morning and afternoon
    expect(availability.availableSlots.length).toBe(2);
    expect(availability.totalAvailableMinutes).toBe(7 * 60);
  });
});

describe('getDateRange', () => {
  it('should return single date for same start and end', () => {
    const start = new Date('2024-01-15');
    const end = new Date('2024-01-15');
    const range = getDateRange(start, end);
    expect(range.length).toBe(1);
  });

  it('should return correct range of dates', () => {
    const start = new Date('2024-01-15');
    const end = new Date('2024-01-17');
    const range = getDateRange(start, end);
    expect(range.length).toBe(3);
    expect(range[0].getDate()).toBe(15);
    expect(range[1].getDate()).toBe(16);
    expect(range[2].getDate()).toBe(17);
  });

  it('should return empty array for invalid range', () => {
    const start = new Date('2024-01-17');
    const end = new Date('2024-01-15');
    const range = getDateRange(start, end);
    expect(range.length).toBe(0);
  });

  it('should handle week range', () => {
    const start = new Date('2024-01-15');
    const end = new Date('2024-01-21');
    const range = getDateRange(start, end);
    expect(range.length).toBe(7);
  });

  it('should handle month boundaries', () => {
    const start = new Date('2024-01-30');
    const end = new Date('2024-02-02');
    const range = getDateRange(start, end);
    expect(range.length).toBe(4);
    expect(range[0].getMonth()).toBe(0); // January
    expect(range[2].getMonth()).toBe(1); // February
  });
});

describe('isWorkingDay', () => {
  it('should return true for weekdays', () => {
    const workingDays = [1, 2, 3, 4, 5]; // Mon-Fri
    const monday = new Date('2024-01-15'); // Monday
    const friday = new Date('2024-01-19'); // Friday

    expect(isWorkingDay(monday, workingDays)).toBe(true);
    expect(isWorkingDay(friday, workingDays)).toBe(true);
  });

  it('should return false for weekends with default working days', () => {
    const workingDays = [1, 2, 3, 4, 5]; // Mon-Fri
    const saturday = new Date('2024-01-20'); // Saturday
    const sunday = new Date('2024-01-21'); // Sunday

    expect(isWorkingDay(saturday, workingDays)).toBe(false);
    expect(isWorkingDay(sunday, workingDays)).toBe(false);
  });

  it('should handle custom working days', () => {
    const workingDays = [0, 6]; // Sunday and Saturday only
    const saturday = new Date('2024-01-20');
    const sunday = new Date('2024-01-21');
    const monday = new Date('2024-01-15');

    expect(isWorkingDay(saturday, workingDays)).toBe(true);
    expect(isWorkingDay(sunday, workingDays)).toBe(true);
    expect(isWorkingDay(monday, workingDays)).toBe(false);
  });

  it('should handle empty working days array', () => {
    const workingDays: number[] = [];
    const anyDay = new Date('2024-01-15');
    expect(isWorkingDay(anyDay, workingDays)).toBe(false);
  });
});

describe('formatDateString', () => {
  it('should format date to YYYY-MM-DD', () => {
    const date = new Date('2024-01-15T12:30:00Z');
    expect(formatDateString(date)).toBe('2024-01-15');
  });

  it('should handle single digit months and days', () => {
    const date = new Date('2024-01-05T00:00:00Z');
    expect(formatDateString(date)).toBe('2024-01-05');
  });

  it('should handle end of year', () => {
    const date = new Date('2024-12-31T23:59:59Z');
    expect(formatDateString(date)).toBe('2024-12-31');
  });
});

describe('parseDateString', () => {
  it('should parse YYYY-MM-DD to Date at midnight UTC', () => {
    const date = parseDateString('2024-01-15');
    expect(date.getUTCFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(0); // January
    expect(date.getUTCDate()).toBe(15);
    expect(date.getUTCHours()).toBe(0);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCSeconds()).toBe(0);
  });

  it('should roundtrip with formatDateString', () => {
    const originalDate = '2024-06-20';
    const parsed = parseDateString(originalDate);
    const formatted = formatDateString(parsed);
    expect(formatted).toBe(originalDate);
  });
});

describe('Events spanning multiple days', () => {
  const testDate = new Date('2024-01-15');
  const workingHours = { start: '09:00', end: '17:00' };

  it('should handle event that starts before and ends after working hours', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-14T20:00:00Z'), end: new Date('2024-01-16T08:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Event spans overnight, should block all working hours on the 15th
    expect(availability.totalAvailableMinutes).toBe(0);
  });

  it('should handle event that starts day before and ends mid-day', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-14T20:00:00Z'), end: new Date('2024-01-15T12:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have 5 hours available (12:00 to 17:00)
    expect(availability.totalAvailableMinutes).toBe(5 * 60);
  });

  it('should handle event that starts mid-day and ends next day', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T14:00:00Z'), end: new Date('2024-01-16T10:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Should have 5 hours available (09:00 to 14:00)
    expect(availability.totalAvailableMinutes).toBe(5 * 60);
  });
});

describe('Edge cases', () => {
  const testDate = new Date('2024-01-15');

  it('should handle very short working hours', () => {
    const shortHours = { start: '12:00', end: '12:30' };
    const availability = calculateAvailability(testDate, [], shortHours, 30, 'UTC');

    expect(availability.totalAvailableMinutes).toBe(30);
    expect(availability.availableSlots.length).toBe(1);
  });

  it('should handle back-to-back meetings', () => {
    const workingHours = { start: '09:00', end: '17:00' };
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T09:00:00Z'), end: new Date('2024-01-15T10:00:00Z') },
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T11:00:00Z'), end: new Date('2024-01-15T12:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    // Merged busy periods should create one block from 9-12
    expect(availability.totalAvailableMinutes).toBe(5 * 60); // 12-17 available
    expect(availability.busySlots.length).toBe(1); // All meetings merged
  });

  it('should handle meeting exactly at working hours boundaries', () => {
    const workingHours = { start: '09:00', end: '17:00' };
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T09:00:00Z'), end: new Date('2024-01-15T09:30:00Z') },
      { start: new Date('2024-01-15T16:30:00Z'), end: new Date('2024-01-15T17:00:00Z') },
    ];

    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    expect(availability.totalAvailableMinutes).toBe(7 * 60); // 7 hours available
    expect(availability.busySlots.length).toBe(2);
  });

  it('should handle 5-minute slot intervals', () => {
    const workingHours = { start: '09:00', end: '10:00' };
    const availability = calculateAvailability(testDate, [], workingHours, 5, 'UTC');

    expect(availability.totalAvailableMinutes).toBe(60);
    // With 5-minute intervals, still one continuous slot
    expect(availability.availableSlots.length).toBe(1);
  });
});

describe('Timezone handling', () => {
  const testDate = new Date('2024-01-15');
  const workingHours = { start: '09:00', end: '17:00' };

  it('should handle UTC timezone', () => {
    const availability = calculateAvailability(testDate, [], workingHours, 30, 'UTC');
    expect(availability.totalAvailableMinutes).toBe(8 * 60);
  });

  // Note: More timezone tests would require mocking or using a timezone library
  // These basic tests verify the function accepts timezone parameter
  it('should accept various timezone strings', () => {
    const timezones = [
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Asia/Tokyo',
    ];

    for (const tz of timezones) {
      // Should not throw
      const availability = calculateAvailability(testDate, [], workingHours, 30, tz);
      expect(availability.date).toBe('2024-01-15');
    }
  });
});

describe('Availability window structure', () => {
  const testDate = new Date('2024-01-15'); // Monday
  const workingHours = { start: '09:00', end: '17:00' };

  it('should have correct date string format', () => {
    const availability = calculateAvailability(testDate, [], workingHours, 30, 'UTC');
    expect(availability.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should have correct day of week', () => {
    const availability = calculateAvailability(testDate, [], workingHours, 30, 'UTC');
    expect(availability.dayOfWeek).toBe(1); // Monday = 1
  });

  it('should have ISO formatted slot times', () => {
    const availability = calculateAvailability(testDate, [], workingHours, 30, 'UTC');

    for (const slot of availability.availableSlots) {
      expect(slot.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(slot.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  });

  it('should have non-negative total available minutes', () => {
    const busyPeriods: BusyPeriod[] = [
      { start: new Date('2024-01-15T00:00:00Z'), end: new Date('2024-01-15T23:59:59Z') },
    ];
    const availability = calculateAvailability(
      testDate,
      busyPeriods,
      workingHours,
      30,
      'UTC'
    );

    expect(availability.totalAvailableMinutes).toBeGreaterThanOrEqual(0);
  });
});
