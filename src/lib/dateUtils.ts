/**
 * Date and time utility functions for calendar scheduling
 * @module lib/dateUtils
 */

import type { TimeSlot, UserSchedulingPreferences } from '../types'

/**
 * Generates time slots for a given date with specified interval
 * @param date - The date to generate slots for
 * @param intervalMinutes - Duration of each slot in minutes
 * @returns Array of TimeSlot objects for the entire day
 */
export function generateTimeSlots(date: Date, intervalMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  let currentTime = new Date(startOfDay)

  while (currentTime < endOfDay) {
    const slotEnd = addMinutes(currentTime, intervalMinutes)
    if (slotEnd > endOfDay) break

    slots.push({
      start: new Date(currentTime),
      end: new Date(slotEnd),
      available: true,
    })

    currentTime = slotEnd
  }

  return slots
}

/**
 * Gets an array of dates starting from the given date
 * @param start - Starting date
 * @param days - Number of days to include
 * @returns Array of Date objects
 */
export function getDateRange(start: Date, days: number): Date[] {
  const dates: Date[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Checks if a date falls within a given range (inclusive)
 * @param date - The date to check
 * @param start - Range start
 * @param end - Range end
 * @returns True if date is within range
 */
export function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const dateTime = date.getTime()
  return dateTime >= start.getTime() && dateTime <= end.getTime()
}

/**
 * Checks if two dates are on the same calendar day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Parses a time string in "HH:mm" format
 * @param time - Time string in "HH:mm" format
 * @returns Object with hours and minutes
 * @throws Error if time format is invalid
 */
export function parseTimeString(time: string): { hours: number; minutes: number } {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    throw new Error(`Invalid time format: ${time}. Expected "HH:mm"`)
  }

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)

  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid hours: ${hours}. Must be 0-23`)
  }
  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minutes: ${minutes}. Must be 0-59`)
  }

  return { hours, minutes }
}

/**
 * Formats a date's time component to "HH:mm" format
 * @param date - The date to format
 * @returns Time string in "HH:mm" format
 */
export function formatTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Combines a date and a time string into a new Date object
 * @param date - The date to use
 * @param time - Time string in "HH:mm" format
 * @returns New Date with combined date and time
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const { hours, minutes } = parseTimeString(time)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Calculates the number of minutes between two dates
 * @param start - Start date
 * @param end - End date
 * @returns Number of minutes (can be negative if end is before start)
 */
export function getMinutesBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  return Math.round(diffMs / (1000 * 60))
}

/**
 * Adds minutes to a date
 * @param date - The date to modify
 * @param minutes - Number of minutes to add (can be negative)
 * @returns New Date with added minutes
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

/**
 * Converts a UTC date to the user's timezone
 * @param date - Date in UTC
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date adjusted for the timezone
 */
export function toUserTimezone(date: Date, timezone: string): Date {
  try {
    // Get the offset for the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(date)
    const dateParts: Record<string, string> = {}
    for (const part of parts) {
      dateParts[part.type] = part.value
    }

    // Create a new date using the formatted parts
    const year = parseInt(dateParts.year, 10)
    const month = parseInt(dateParts.month, 10) - 1
    const day = parseInt(dateParts.day, 10)
    const hour = parseInt(dateParts.hour, 10)
    const minute = parseInt(dateParts.minute, 10)
    const second = parseInt(dateParts.second, 10)

    return new Date(year, month, day, hour, minute, second)
  } catch {
    // If timezone is invalid, return original date
    console.warn(`Invalid timezone: ${timezone}, returning original date`)
    return new Date(date)
  }
}

/**
 * Converts a date from user's timezone to UTC
 * @param date - Date in user's timezone (represented as a local Date object)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date in UTC
 */
export function fromUserTimezone(date: Date, timezone: string): Date {
  try {
    // Format the date as an ISO string in the given timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    // Get the date string in the target timezone
    const dateStr = formatter.format(date)
    const timeStr = timeFormatter.format(date)

    // Create a date string that JavaScript can parse as the target timezone
    const isoString = `${dateStr}T${timeStr}`

    // Parse as if it's in the target timezone
    const localDate = new Date(isoString)

    // Calculate the offset difference
    const targetOffset = getTimezoneOffset(date, timezone)
    const localOffset = date.getTimezoneOffset()
    const offsetDiff = (localOffset - targetOffset) * 60 * 1000

    return new Date(localDate.getTime() + offsetDiff)
  } catch {
    console.warn(`Invalid timezone: ${timezone}, returning original date`)
    return new Date(date)
  }
}

/**
 * Gets the timezone offset in minutes for a given date and timezone
 * @param date - The date to check
 * @param timezone - IANA timezone string
 * @returns Offset in minutes (positive for west of UTC)
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  })

  const formatted = formatter.format(date)
  const match = formatted.match(/GMT([+-])(\d{1,2}):?(\d{2})?/)

  if (!match) {
    return 0
  }

  const sign = match[1] === '+' ? -1 : 1
  const hours = parseInt(match[2], 10)
  const minutes = parseInt(match[3] || '0', 10)

  return sign * (hours * 60 + minutes)
}

/**
 * Checks if a time is within working hours
 * @param date - The date/time to check
 * @param workingHours - Working hours configuration
 * @returns True if the time is within working hours
 */
export function isWithinWorkingHours(
  date: Date,
  workingHours: { start: string; end: string }
): boolean {
  const timeStr = formatTimeString(date)
  return timeStr >= workingHours.start && timeStr < workingHours.end
}

/**
 * Gets the working hours as Date objects for a specific date
 * @param date - The date to get working hours for
 * @param preferences - User's scheduling preferences
 * @returns Object with start and end Date objects
 */
export function getWorkingHoursForDate(
  date: Date,
  preferences: UserSchedulingPreferences
): { start: Date; end: Date } {
  const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // Find working hours for this day
  const dayConfig = preferences.workingHours.find(h => h.dayOfWeek === dayOfWeek)

  // Check if this is a working day
  if (!dayConfig || !dayConfig.enabled) {
    // Return a zero-width window for non-working days
    const midnight = new Date(date)
    midnight.setHours(0, 0, 0, 0)
    return { start: midnight, end: midnight }
  }

  const start = combineDateAndTime(date, dayConfig.startTime)
  const end = combineDateAndTime(date, dayConfig.endTime)

  return { start, end }
}

/**
 * Checks if a date is a working day based on preferences
 * @param date - The date to check
 * @param workingDays - Array of working day numbers (0 = Sunday)
 * @returns True if the date is a working day
 */
export function isWorkingDay(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(date.getDay())
}

/**
 * Gets the start of day for a given date
 * @param date - The date to get start of day for
 * @returns Date set to midnight (00:00:00.000)
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Gets the end of day for a given date
 * @param date - The date to get end of day for
 * @returns Date set to 23:59:59.999
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Formats a duration in minutes to a human-readable string
 * @param minutes - Duration in minutes
 * @returns Human-readable duration string (e.g., "1h 30m")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Checks if two time ranges overlap
 * @param start1 - Start of first range
 * @param end1 - End of first range
 * @param start2 - Start of second range
 * @param end2 - End of second range
 * @returns True if the ranges overlap
 */
export function timeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2
}

/**
 * Gets the next occurrence of a specific day of week
 * @param date - Starting date
 * @param dayOfWeek - Target day of week (0 = Sunday)
 * @param includeToday - Whether to include today if it matches
 * @returns Date of the next occurrence
 */
export function getNextDayOfWeek(
  date: Date,
  dayOfWeek: number,
  includeToday = false
): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)

  const currentDay = result.getDay()
  let daysToAdd = dayOfWeek - currentDay

  if (daysToAdd < 0 || (daysToAdd === 0 && !includeToday)) {
    daysToAdd += 7
  }

  result.setDate(result.getDate() + daysToAdd)
  return result
}
