/**
 * Availability data transformation utilities
 * Functions to transform, filter, and analyze availability data
 * @module services/availabilityTransformers
 */

import type { AvailabilityWindow, TimeSlot } from '@/types'
import { isSameDay, getMinutesBetween, timeRangesOverlap } from '@/lib/dateUtils'

/**
 * Formats a date to YYYY-MM-DD string for use as a map key
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Groups availability windows by date
 * @param windows - Array of availability windows
 * @returns Map with date keys (YYYY-MM-DD) mapping to availability windows
 */
export function groupAvailabilityByDate(
  windows: AvailabilityWindow[]
): Map<string, AvailabilityWindow> {
  const map = new Map<string, AvailabilityWindow>()

  for (const window of windows) {
    const dateKey = formatDateKey(window.date)
    map.set(dateKey, window)
  }

  return map
}

/**
 * Daily statistics for an availability window
 */
export interface DailyStats {
  /** Total free minutes available in the day */
  totalFreeMinutes: number
  /** Total busy minutes in the day */
  totalBusyMinutes: number
  /** Percentage of working hours that are free (0-100) */
  freePercentage: number
  /** Duration of the largest contiguous free block in minutes */
  largestFreeBlock: number
  /** Number of separate free time blocks */
  freeBlockCount: number
}

/**
 * Finds the best available slots for a given duration
 * @param availability - Array of availability windows
 * @param durationMinutes - Required duration in minutes
 * @param count - Maximum number of slots to return (default: 5)
 * @returns Array of time slots sorted by preference (earliest first)
 */
export function findBestSlots(
  availability: AvailabilityWindow[],
  durationMinutes: number,
  count: number = 5
): TimeSlot[] {
  const slots: TimeSlot[] = []

  for (const window of availability) {
    for (const slot of window.slots) {
      if (!slot.available) continue

      const slotDuration = getMinutesBetween(slot.start, slot.end)
      if (slotDuration >= durationMinutes) {
        // Create a slot of the requested duration starting at this time
        slots.push({
          start: new Date(slot.start),
          end: new Date(slot.start.getTime() + durationMinutes * 60 * 1000),
          available: true,
        })
      }
    }
  }

  // Sort by start time (earliest first)
  slots.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Return only the requested count
  return slots.slice(0, count)
}

/**
 * Checks if a specific time range is available
 * @param availability - Array of availability windows
 * @param start - Start of the time range to check
 * @param end - End of the time range to check
 * @returns True if the entire time range is available
 */
export function isTimeAvailable(
  availability: AvailabilityWindow[],
  start: Date,
  end: Date
): boolean {
  // Find the availability window for the date
  const window = availability.find((w) => isSameDay(w.date, start))
  if (!window) return false

  // Check if the requested range falls within an available slot
  for (const slot of window.slots) {
    if (!slot.available) continue

    // Check if the requested range is fully contained within this available slot
    if (slot.start <= start && slot.end >= end) {
      return true
    }
  }

  return false
}

/**
 * Gets the next available slot after a given date
 * @param availability - Array of availability windows
 * @param afterDate - Date to search from
 * @param durationMinutes - Required duration in minutes
 * @returns The next available slot, or null if none found
 */
export function getNextAvailableSlot(
  availability: AvailabilityWindow[],
  afterDate: Date,
  durationMinutes: number
): TimeSlot | null {
  // Sort windows by date
  const sortedWindows = [...availability].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  )

  for (const window of sortedWindows) {
    // Skip windows that are entirely before afterDate
    if (window.date < afterDate && !isSameDay(window.date, afterDate)) {
      continue
    }

    for (const slot of window.slots) {
      if (!slot.available) continue

      // Determine the effective start time
      const effectiveStart = slot.start > afterDate ? slot.start : afterDate
      const slotDuration = getMinutesBetween(effectiveStart, slot.end)

      if (slotDuration >= durationMinutes) {
        return {
          start: new Date(effectiveStart),
          end: new Date(effectiveStart.getTime() + durationMinutes * 60 * 1000),
          available: true,
        }
      }
    }
  }

  return null
}

/**
 * Merges multiple availability sources into a single set of windows
 * Only time that is available in ALL sources is marked as available
 * @param windowArrays - Multiple arrays of availability windows to merge
 * @returns Merged availability windows
 */
export function mergeAvailability(
  ...windowArrays: AvailabilityWindow[][]
): AvailabilityWindow[] {
  if (windowArrays.length === 0) return []
  if (windowArrays.length === 1) return windowArrays[0]

  // Group all windows by date
  const windowsByDate = new Map<string, AvailabilityWindow[]>()

  for (const windows of windowArrays) {
    for (const window of windows) {
      const dateKey = formatDateKey(window.date)
      const existing = windowsByDate.get(dateKey) || []
      existing.push(window)
      windowsByDate.set(dateKey, existing)
    }
  }

  // Merge windows for each date
  const mergedWindows: AvailabilityWindow[] = []

  for (const [_dateKey, windows] of windowsByDate) {
    if (windows.length < windowArrays.length) {
      // Not all sources have data for this date, skip it
      continue
    }

    // Get intersection of available slots
    const mergedSlots = mergeSlots(windows.map((w) => w.slots))
    const totalFreeMinutes = calculateTotalFreeMinutes(mergedSlots)
    const totalBusyMinutes = calculateTotalBusyMinutes(mergedSlots)

    mergedWindows.push({
      date: windows[0].date,
      slots: mergedSlots,
      totalFreeMinutes,
      totalBusyMinutes,
    })
  }

  // Sort by date
  mergedWindows.sort((a, b) => a.date.getTime() - b.date.getTime())

  return mergedWindows
}

/**
 * Merges multiple sets of time slots, keeping only times available in all sets
 */
function mergeSlots(slotArrays: TimeSlot[][]): TimeSlot[] {
  if (slotArrays.length === 0) return []
  if (slotArrays.length === 1) return slotArrays[0]

  // Start with the first set of slots
  let result = slotArrays[0].filter((s) => s.available)

  // Intersect with each subsequent set
  for (let i = 1; i < slotArrays.length; i++) {
    const otherSlots = slotArrays[i].filter((s) => s.available)
    result = intersectSlots(result, otherSlots)
  }

  return result
}

/**
 * Computes the intersection of two sets of available time slots
 */
function intersectSlots(slots1: TimeSlot[], slots2: TimeSlot[]): TimeSlot[] {
  const result: TimeSlot[] = []

  for (const s1 of slots1) {
    for (const s2 of slots2) {
      if (timeRangesOverlap(s1.start, s1.end, s2.start, s2.end)) {
        // Find the intersection
        const start = s1.start > s2.start ? s1.start : s2.start
        const end = s1.end < s2.end ? s1.end : s2.end

        result.push({
          start: new Date(start),
          end: new Date(end),
          available: true,
        })
      }
    }
  }

  return result
}

/**
 * Calculates total free minutes from slots
 */
function calculateTotalFreeMinutes(slots: TimeSlot[]): number {
  return slots
    .filter((s) => s.available)
    .reduce((total, slot) => total + getMinutesBetween(slot.start, slot.end), 0)
}

/**
 * Calculates total busy minutes from slots
 */
function calculateTotalBusyMinutes(slots: TimeSlot[]): number {
  return slots
    .filter((s) => !s.available)
    .reduce((total, slot) => total + getMinutesBetween(slot.start, slot.end), 0)
}

/**
 * Calculates daily statistics for an availability window
 * @param window - The availability window to analyze
 * @returns Statistics about the day's availability
 */
export function getDailyStats(window: AvailabilityWindow): DailyStats {
  const freeSlots = window.slots.filter((s) => s.available)

  // Calculate largest free block
  let largestFreeBlock = 0
  for (const slot of freeSlots) {
    const duration = getMinutesBetween(slot.start, slot.end)
    if (duration > largestFreeBlock) {
      largestFreeBlock = duration
    }
  }

  // Calculate free percentage
  const totalMinutes = window.totalFreeMinutes + window.totalBusyMinutes
  const freePercentage = totalMinutes > 0
    ? Math.round((window.totalFreeMinutes / totalMinutes) * 100)
    : 0

  return {
    totalFreeMinutes: window.totalFreeMinutes,
    totalBusyMinutes: window.totalBusyMinutes,
    freePercentage,
    largestFreeBlock,
    freeBlockCount: freeSlots.length,
  }
}

/**
 * Filters availability windows to only include dates within a range
 * @param windows - Array of availability windows
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @returns Filtered availability windows
 */
export function filterByDateRange(
  windows: AvailabilityWindow[],
  startDate: Date,
  endDate: Date
): AvailabilityWindow[] {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  return windows.filter(
    (w) => w.date >= start && w.date <= end
  )
}

/**
 * Gets all free slots from an availability window
 * @param window - The availability window
 * @param minDuration - Minimum duration in minutes (optional)
 * @returns Array of available time slots
 */
export function getFreeSlots(window: AvailabilityWindow, minDuration?: number): TimeSlot[] {
  let slots = window.slots.filter((s) => s.available)

  if (minDuration !== undefined) {
    slots = slots.filter((s) => getMinutesBetween(s.start, s.end) >= minDuration)
  }

  return slots
}

/**
 * Sorts availability windows by total free time (descending)
 * @param windows - Array of availability windows
 * @returns Sorted array (most free time first)
 */
export function sortByFreeTime(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  return [...windows].sort((a, b) => b.totalFreeMinutes - a.totalFreeMinutes)
}

/**
 * Finds windows with at least the specified amount of free time
 * @param windows - Array of availability windows
 * @param minFreeMinutes - Minimum free minutes required
 * @returns Filtered availability windows
 */
export function findWindowsWithMinimumFreeTime(
  windows: AvailabilityWindow[],
  minFreeMinutes: number
): AvailabilityWindow[] {
  return windows.filter((w) => w.totalFreeMinutes >= minFreeMinutes)
}
