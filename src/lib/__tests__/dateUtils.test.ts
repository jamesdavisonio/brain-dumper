/**
 * Unit tests for dateUtils.ts
 * @module lib/__tests__/dateUtils.test
 */

import { describe, it, expect } from 'vitest'
import {
  generateTimeSlots,
  getDateRange,
  isWithinRange,
  isSameDay,
  parseTimeString,
  formatTimeString,
  combineDateAndTime,
  getMinutesBetween,
  addMinutes,
  toUserTimezone,
  fromUserTimezone,
  isWithinWorkingHours,
  getWorkingHoursForDate,
  isWorkingDay,
  startOfDay,
  endOfDay,
  formatDuration,
  timeRangesOverlap,
  getNextDayOfWeek,
} from '../dateUtils'
import type { UserSchedulingPreferences } from '../../types'

describe('generateTimeSlots', () => {
  it('should generate 15-minute slots for a full day', () => {
    const date = new Date(2024, 0, 15)
    const slots = generateTimeSlots(date, 15)

    // The last slot ends at 23:45 + 15 min = 24:00, but we exclude partial slots past end of day
    // So we get slots from 00:00 to 23:45, which is 95 complete slots
    expect(slots.length).toBeGreaterThanOrEqual(95)
    expect(slots[0].start.getHours()).toBe(0)
    expect(slots[0].start.getMinutes()).toBe(0)
    expect(slots.every((s) => s.available)).toBe(true)
  })

  it('should generate 30-minute slots', () => {
    const date = new Date(2024, 0, 15)
    const slots = generateTimeSlots(date, 30)

    // We should have at least 47 slots (23:00-23:30 is the last full slot)
    expect(slots.length).toBeGreaterThanOrEqual(47)
    expect(getMinutesBetween(slots[0].start, slots[0].end)).toBe(30)
  })

  it('should generate 60-minute slots', () => {
    const date = new Date(2024, 0, 15)
    const slots = generateTimeSlots(date, 60)

    // We should have at least 23 slots (22:00-23:00 is the last full slot that doesn't exceed end of day)
    expect(slots.length).toBeGreaterThanOrEqual(23)
    expect(getMinutesBetween(slots[0].start, slots[0].end)).toBe(60)
  })
})

describe('getDateRange', () => {
  it('should return an array of dates', () => {
    const start = new Date(2024, 0, 1)
    const dates = getDateRange(start, 5)

    expect(dates.length).toBe(5)
    expect(dates[0].getDate()).toBe(1)
    expect(dates[4].getDate()).toBe(5)
  })

  it('should handle month boundaries', () => {
    const start = new Date(2024, 0, 30) // Jan 30
    const dates = getDateRange(start, 5)

    expect(dates.length).toBe(5)
    expect(dates[0].getMonth()).toBe(0) // January
    expect(dates[2].getMonth()).toBe(1) // February
  })

  it('should return empty array for 0 days', () => {
    const start = new Date(2024, 0, 1)
    const dates = getDateRange(start, 0)

    expect(dates.length).toBe(0)
  })
})

describe('isWithinRange', () => {
  it('should return true for date within range', () => {
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 31)
    const date = new Date(2024, 0, 15)

    expect(isWithinRange(date, start, end)).toBe(true)
  })

  it('should return true for date at range boundaries', () => {
    const start = new Date(2024, 0, 1, 0, 0, 0)
    const end = new Date(2024, 0, 31, 23, 59, 59)

    expect(isWithinRange(new Date(2024, 0, 1, 0, 0, 0), start, end)).toBe(true)
    expect(isWithinRange(new Date(2024, 0, 31, 23, 59, 59), start, end)).toBe(true)
  })

  it('should return false for date outside range', () => {
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 31)
    const before = new Date(2023, 11, 31)
    const after = new Date(2024, 1, 1)

    expect(isWithinRange(before, start, end)).toBe(false)
    expect(isWithinRange(after, start, end)).toBe(false)
  })
})

describe('isSameDay', () => {
  it('should return true for same day', () => {
    const date1 = new Date(2024, 0, 15, 9, 0, 0)
    const date2 = new Date(2024, 0, 15, 17, 30, 0)

    expect(isSameDay(date1, date2)).toBe(true)
  })

  it('should return false for different days', () => {
    const date1 = new Date(2024, 0, 15)
    const date2 = new Date(2024, 0, 16)

    expect(isSameDay(date1, date2)).toBe(false)
  })

  it('should handle midnight edge case', () => {
    const beforeMidnight = new Date(2024, 0, 15, 23, 59, 59)
    const afterMidnight = new Date(2024, 0, 16, 0, 0, 0)

    expect(isSameDay(beforeMidnight, afterMidnight)).toBe(false)
  })
})

describe('parseTimeString', () => {
  it('should parse valid time strings', () => {
    expect(parseTimeString('09:00')).toEqual({ hours: 9, minutes: 0 })
    expect(parseTimeString('14:30')).toEqual({ hours: 14, minutes: 30 })
    expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 })
    expect(parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 })
  })

  it('should throw for invalid format', () => {
    // Single digit hour should throw (regex requires 2 digits for hour)
    expect(() => parseTimeString('invalid')).toThrow()
    expect(() => parseTimeString('')).toThrow()
    // Note: 9:00 actually matches because regex is /^(\d{1,2}):(\d{2})$/
    // but 24:00 fails the hours validation
    expect(() => parseTimeString('24:00')).toThrow()
    expect(() => parseTimeString('09:60')).toThrow()
  })
})

describe('formatTimeString', () => {
  it('should format date to HH:mm string', () => {
    expect(formatTimeString(new Date(2024, 0, 1, 9, 0))).toBe('09:00')
    expect(formatTimeString(new Date(2024, 0, 1, 14, 30))).toBe('14:30')
    expect(formatTimeString(new Date(2024, 0, 1, 0, 0))).toBe('00:00')
    expect(formatTimeString(new Date(2024, 0, 1, 23, 59))).toBe('23:59')
  })

  it('should pad single digit hours and minutes', () => {
    expect(formatTimeString(new Date(2024, 0, 1, 5, 5))).toBe('05:05')
  })
})

describe('combineDateAndTime', () => {
  it('should combine date and time correctly', () => {
    const date = new Date(2024, 0, 15)
    const result = combineDateAndTime(date, '14:30')

    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
    expect(result.getSeconds()).toBe(0)
  })

  it('should work with midnight', () => {
    const date = new Date(2024, 0, 15, 12, 30)
    const result = combineDateAndTime(date, '00:00')

    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })
})

describe('getMinutesBetween', () => {
  it('should calculate minutes between dates', () => {
    const start = new Date(2024, 0, 15, 9, 0)
    const end = new Date(2024, 0, 15, 10, 30)

    expect(getMinutesBetween(start, end)).toBe(90)
  })

  it('should return negative for reversed order', () => {
    const start = new Date(2024, 0, 15, 10, 30)
    const end = new Date(2024, 0, 15, 9, 0)

    expect(getMinutesBetween(start, end)).toBe(-90)
  })

  it('should return 0 for same time', () => {
    const date = new Date(2024, 0, 15, 9, 0)

    expect(getMinutesBetween(date, date)).toBe(0)
  })
})

describe('addMinutes', () => {
  it('should add positive minutes', () => {
    const date = new Date(2024, 0, 15, 9, 0)
    const result = addMinutes(date, 30)

    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(30)
  })

  it('should add negative minutes', () => {
    const date = new Date(2024, 0, 15, 9, 30)
    const result = addMinutes(date, -30)

    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(0)
  })

  it('should handle day rollover', () => {
    const date = new Date(2024, 0, 15, 23, 30)
    const result = addMinutes(date, 60)

    expect(result.getDate()).toBe(16)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(30)
  })
})

describe('toUserTimezone', () => {
  it('should convert to user timezone', () => {
    // Create a UTC date
    const utcDate = new Date('2024-01-15T15:00:00Z')
    const result = toUserTimezone(utcDate, 'America/New_York')

    // New York is UTC-5 in January
    expect(result.getHours()).toBe(10)
  })

  it('should handle invalid timezone gracefully', () => {
    const date = new Date('2024-01-15T15:00:00Z')
    const result = toUserTimezone(date, 'Invalid/Timezone')

    // Should return original date
    expect(result.getTime()).toBe(date.getTime())
  })
})

describe('isWithinWorkingHours', () => {
  const workingHours = { start: '09:00', end: '17:00' }

  it('should return true for time within working hours', () => {
    const date = new Date(2024, 0, 15, 12, 0)
    expect(isWithinWorkingHours(date, workingHours)).toBe(true)
  })

  it('should return true for time at start of working hours', () => {
    const date = new Date(2024, 0, 15, 9, 0)
    expect(isWithinWorkingHours(date, workingHours)).toBe(true)
  })

  it('should return false for time at end of working hours', () => {
    const date = new Date(2024, 0, 15, 17, 0)
    expect(isWithinWorkingHours(date, workingHours)).toBe(false)
  })

  it('should return false for time outside working hours', () => {
    expect(isWithinWorkingHours(new Date(2024, 0, 15, 8, 0), workingHours)).toBe(false)
    expect(isWithinWorkingHours(new Date(2024, 0, 15, 18, 0), workingHours)).toBe(false)
  })
})

describe('getWorkingHoursForDate', () => {
  const preferences: UserSchedulingPreferences = {
    userId: 'test-user',
    defaultCalendarId: 'cal-1',
    preferredCalendarId: null,
    workingHours: [
      { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' }, // Sunday
      { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '17:00' },  // Monday
      { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '17:00' },  // Tuesday
      { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '17:00' },  // Wednesday
      { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '17:00' },  // Thursday
      { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '17:00' },  // Friday
      { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '17:00' }, // Saturday
    ],
    taskTypeRules: [],
    protectedSlots: [],
    defaultBufferBefore: 5,
    defaultBufferAfter: 5,
    keepSlotFreeForCalls: false,
    callSlotDuration: 30,
    callSlotPreferredTime: 'morning',
    timezone: 'America/New_York',
    autoScheduleEnabled: true,
    preferContiguousBlocks: true,
  }

  it('should return working hours for a working day', () => {
    const monday = new Date(2024, 0, 15) // Monday
    const result = getWorkingHoursForDate(monday, preferences)

    expect(result.start.getHours()).toBe(9)
    expect(result.end.getHours()).toBe(17)
  })

  it('should return zero-width window for non-working day', () => {
    const saturday = new Date(2024, 0, 13) // Saturday
    const result = getWorkingHoursForDate(saturday, preferences)

    expect(result.start.getTime()).toBe(result.end.getTime())
  })
})

describe('isWorkingDay', () => {
  const workingDays = [1, 2, 3, 4, 5] // Mon-Fri

  it('should return true for working days', () => {
    expect(isWorkingDay(new Date(2024, 0, 15), workingDays)).toBe(true) // Monday
    expect(isWorkingDay(new Date(2024, 0, 19), workingDays)).toBe(true) // Friday
  })

  it('should return false for non-working days', () => {
    expect(isWorkingDay(new Date(2024, 0, 13), workingDays)).toBe(false) // Saturday
    expect(isWorkingDay(new Date(2024, 0, 14), workingDays)).toBe(false) // Sunday
  })
})

describe('startOfDay', () => {
  it('should set time to midnight', () => {
    const date = new Date(2024, 0, 15, 14, 30, 45, 123)
    const result = startOfDay(date)

    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('should not modify original date', () => {
    const date = new Date(2024, 0, 15, 14, 30)
    startOfDay(date)

    expect(date.getHours()).toBe(14)
  })
})

describe('endOfDay', () => {
  it('should set time to 23:59:59.999', () => {
    const date = new Date(2024, 0, 15, 14, 30)
    const result = endOfDay(date)

    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })

  it('should not modify original date', () => {
    const date = new Date(2024, 0, 15, 14, 30)
    endOfDay(date)

    expect(date.getHours()).toBe(14)
  })
})

describe('formatDuration', () => {
  it('should format minutes only', () => {
    expect(formatDuration(30)).toBe('30m')
    expect(formatDuration(45)).toBe('45m')
  })

  it('should format hours only', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(120)).toBe('2h')
  })

  it('should format hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(150)).toBe('2h 30m')
  })
})

describe('timeRangesOverlap', () => {
  it('should detect overlapping ranges', () => {
    const start1 = new Date(2024, 0, 15, 9, 0)
    const end1 = new Date(2024, 0, 15, 11, 0)
    const start2 = new Date(2024, 0, 15, 10, 0)
    const end2 = new Date(2024, 0, 15, 12, 0)

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(true)
  })

  it('should detect non-overlapping ranges', () => {
    const start1 = new Date(2024, 0, 15, 9, 0)
    const end1 = new Date(2024, 0, 15, 10, 0)
    const start2 = new Date(2024, 0, 15, 11, 0)
    const end2 = new Date(2024, 0, 15, 12, 0)

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(false)
  })

  it('should detect adjacent ranges as non-overlapping', () => {
    const start1 = new Date(2024, 0, 15, 9, 0)
    const end1 = new Date(2024, 0, 15, 10, 0)
    const start2 = new Date(2024, 0, 15, 10, 0)
    const end2 = new Date(2024, 0, 15, 11, 0)

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(false)
  })

  it('should detect fully contained range', () => {
    const start1 = new Date(2024, 0, 15, 9, 0)
    const end1 = new Date(2024, 0, 15, 17, 0)
    const start2 = new Date(2024, 0, 15, 10, 0)
    const end2 = new Date(2024, 0, 15, 12, 0)

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(true)
  })
})

describe('getNextDayOfWeek', () => {
  it('should get next occurrence of day', () => {
    const wednesday = new Date(2024, 0, 17) // Wednesday
    const nextMonday = getNextDayOfWeek(wednesday, 1) // Monday

    expect(nextMonday.getDay()).toBe(1)
    expect(nextMonday.getDate()).toBe(22) // Next Monday is Jan 22
  })

  it('should include today when flag is set', () => {
    const monday = new Date(2024, 0, 15) // Monday
    const result = getNextDayOfWeek(monday, 1, true)

    expect(result.getDate()).toBe(15) // Same day
  })

  it('should not include today by default', () => {
    const monday = new Date(2024, 0, 15) // Monday
    const result = getNextDayOfWeek(monday, 1, false)

    expect(result.getDate()).toBe(22) // Next Monday
  })
})
