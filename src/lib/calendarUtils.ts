/**
 * Calendar utility functions for event management and availability
 * @module lib/calendarUtils
 */

import type {
  CalendarEvent,
  TimeSlot,
  AvailabilityWindow,
  Task,
  TaskType,
} from '../types'
import {
  combineDateAndTime,
  getMinutesBetween,
  addMinutes,
  startOfDay,
  endOfDay,
  generateTimeSlots,
} from './dateUtils'

/**
 * Checks if two time slots overlap
 * @param slot1 - First time slot
 * @param slot2 - Second time slot
 * @returns True if the slots overlap
 */
export function hasOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.start < slot2.end && slot1.end > slot2.start
}

/**
 * Finds all events that overlap with a given time slot
 * @param slot - The time slot to check
 * @param events - Array of calendar events to search
 * @returns Array of overlapping events
 */
export function findOverlappingEvents(
  slot: TimeSlot,
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.filter((event) => {
    // Cancelled events don't count as overlapping
    if (event.status === 'cancelled') return false

    return event.start < slot.end && event.end > slot.start
  })
}

/**
 * Calculates availability for a specific date based on calendar events
 * @param events - Calendar events for the date
 * @param date - The date to calculate availability for
 * @param workingHours - Working hours configuration
 * @returns AvailabilityWindow with free and busy slots
 */
export function calculateAvailability(
  events: CalendarEvent[],
  date: Date,
  workingHours: { start: string; end: string }
): AvailabilityWindow {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  // Filter events for this date and sort by start time
  const dayEvents = events
    .filter((event) => {
      if (event.status === 'cancelled') return false
      return event.start < dayEnd && event.end > dayStart
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  // Generate base time slots (15-minute intervals)
  const baseSlots = generateTimeSlots(date, 15)

  // Get working hours as Date objects
  const workStart = combineDateAndTime(date, workingHours.start)
  const workEnd = combineDateAndTime(date, workingHours.end)

  // Mark slots based on events and working hours
  const slots: TimeSlot[] = baseSlots.map((slot) => {
    // Check if slot is within working hours
    const withinWorkingHours = slot.start >= workStart && slot.end <= workEnd

    if (!withinWorkingHours) {
      return { ...slot, available: false }
    }

    // Check for overlapping events
    const overlapping = dayEvents.find(
      (event) => event.start < slot.end && event.end > slot.start
    )

    if (overlapping) {
      return {
        ...slot,
        available: false,
        calendarId: overlapping.calendarId,
        eventId: overlapping.id,
      }
    }

    return { ...slot, available: true }
  })

  // Calculate totals
  let totalFreeMinutes = 0
  let totalBusyMinutes = 0

  for (const slot of slots) {
    const duration = getMinutesBetween(slot.start, slot.end)
    if (slot.start >= workStart && slot.end <= workEnd) {
      if (slot.available) {
        totalFreeMinutes += duration
      } else {
        totalBusyMinutes += duration
      }
    }
  }

  return {
    date,
    slots,
    totalFreeMinutes,
    totalBusyMinutes,
  }
}

/**
 * Merges multiple availability windows into one
 * Useful when combining availability from multiple calendars
 * @param windows - Array of availability windows to merge
 * @returns Single merged availability window
 */
export function mergeAvailabilityWindows(
  windows: AvailabilityWindow[]
): AvailabilityWindow {
  if (windows.length === 0) {
    const now = new Date()
    return {
      date: now,
      slots: [],
      totalFreeMinutes: 0,
      totalBusyMinutes: 0,
    }
  }

  if (windows.length === 1) {
    return windows[0]
  }

  // Use the date from the first window
  const date = windows[0].date

  // Collect all slots and merge them
  const allSlots = windows.flatMap((w) => w.slots)

  // Group slots by start time and merge availability
  const slotMap = new Map<number, TimeSlot>()

  for (const slot of allSlots) {
    const key = slot.start.getTime()
    const existing = slotMap.get(key)

    if (!existing) {
      slotMap.set(key, { ...slot })
    } else {
      // A slot is only available if it's available in all calendars
      // (i.e., no events from any calendar overlap)
      if (!slot.available && existing.available) {
        slotMap.set(key, {
          ...slot,
          available: false,
        })
      }
    }
  }

  const mergedSlots = Array.from(slotMap.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )

  // Recalculate totals
  let totalFreeMinutes = 0
  let totalBusyMinutes = 0

  for (const slot of mergedSlots) {
    const duration = getMinutesBetween(slot.start, slot.end)
    if (slot.available) {
      totalFreeMinutes += duration
    } else {
      totalBusyMinutes += duration
    }
  }

  return {
    date,
    slots: mergedSlots,
    totalFreeMinutes,
    totalBusyMinutes,
  }
}

/**
 * Formats a task as a calendar event
 * @param task - The task to format
 * @param slot - The time slot for the event
 * @returns Partial calendar event object ready for creation
 */
export function formatEventForCalendar(
  task: Task,
  slot: TimeSlot
): Partial<CalendarEvent> {
  return {
    title: task.content,
    description: buildEventDescription(task),
    start: slot.start,
    end: slot.end,
    allDay: false,
    status: 'confirmed',
    brainDumperTaskId: task.id,
  }
}

/**
 * Builds a description string for a calendar event from a task
 * @param task - The task to build description for
 * @returns Description string
 */
function buildEventDescription(task: Task): string {
  const lines: string[] = []

  if (task.project) {
    lines.push(`Project: ${task.project}`)
  }

  lines.push(`Priority: ${task.priority}`)

  if (task.timeEstimate) {
    const hours = Math.floor(task.timeEstimate / 60)
    const mins = task.timeEstimate % 60
    const estimate = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    lines.push(`Estimated time: ${estimate}`)
  }

  if (task.category) {
    lines.push(`Category: ${task.category}`)
  }

  lines.push('')
  lines.push('Created by Brain Dumper')

  return lines.join('\n')
}

/**
 * Formats a buffer event (before or after the main task)
 * @param task - The task the buffer is for
 * @param type - Whether this is a 'before' or 'after' buffer
 * @param duration - Buffer duration in minutes
 * @param mainEventStart - Start time of the main event
 * @param mainEventEnd - End time of the main event
 * @returns Partial calendar event for the buffer
 */
export function formatBufferEvent(
  task: Task,
  type: 'before' | 'after',
  duration: number,
  mainEventStart: Date,
  mainEventEnd: Date
): Partial<CalendarEvent> {
  const start = type === 'before' ? addMinutes(mainEventStart, -duration) : mainEventEnd
  const end = type === 'before' ? mainEventStart : addMinutes(mainEventEnd, duration)

  const title =
    type === 'before'
      ? `Prep: ${task.content}`
      : `Wrap-up: ${task.content}`

  return {
    title,
    description: `Buffer time for "${task.content}" - Created by Brain Dumper`,
    start,
    end,
    allDay: false,
    status: 'confirmed',
    brainDumperTaskId: task.id,
    brainDumperBufferType: type,
  }
}

/**
 * Default colors for calendar types
 */
const CALENDAR_TYPE_COLORS: Record<'work' | 'personal', string> = {
  work: '#3b82f6', // blue
  personal: '#10b981', // green
}

/**
 * Gets the default color for a calendar type
 * @param type - Calendar type ('work' or 'personal')
 * @returns Hex color string
 */
export function getCalendarColor(type: 'work' | 'personal'): string {
  return CALENDAR_TYPE_COLORS[type]
}

/**
 * Colors for different task types
 */
const TASK_TYPE_COLORS: Record<TaskType, string> = {
  deep_work: '#8b5cf6', // violet
  coding: '#3b82f6', // blue
  call: '#f59e0b', // amber
  meeting: '#ef4444', // red
  personal: '#10b981', // green
  admin: '#6b7280', // gray
  health: '#ec4899', // pink
  other: '#64748b', // slate
}

/**
 * Gets the default color for a task type
 * @param taskType - The type of task
 * @returns Hex color string
 */
export function getEventColor(taskType: TaskType): string {
  return TASK_TYPE_COLORS[taskType] || TASK_TYPE_COLORS.other
}

/**
 * Finds continuous free blocks within an availability window
 * @param window - The availability window to search
 * @param minDuration - Minimum block duration in minutes
 * @returns Array of continuous free time slots
 */
export function findFreeBlocks(
  window: AvailabilityWindow,
  minDuration: number
): TimeSlot[] {
  const freeBlocks: TimeSlot[] = []
  let currentBlockStart: Date | null = null
  let currentBlockEnd: Date | null = null

  for (const slot of window.slots) {
    if (slot.available) {
      if (currentBlockStart === null) {
        currentBlockStart = slot.start
      }
      currentBlockEnd = slot.end
    } else {
      // End of free block
      if (currentBlockStart && currentBlockEnd) {
        const duration = getMinutesBetween(currentBlockStart, currentBlockEnd)
        if (duration >= minDuration) {
          freeBlocks.push({
            start: currentBlockStart,
            end: currentBlockEnd,
            available: true,
          })
        }
      }
      currentBlockStart = null
      currentBlockEnd = null
    }
  }

  // Don't forget the last block
  if (currentBlockStart && currentBlockEnd) {
    const duration = getMinutesBetween(currentBlockStart, currentBlockEnd)
    if (duration >= minDuration) {
      freeBlocks.push({
        start: currentBlockStart,
        end: currentBlockEnd,
        available: true,
      })
    }
  }

  return freeBlocks
}

/**
 * Splits a time slot into multiple slots of a given duration
 * @param slot - The slot to split
 * @param duration - Duration of each resulting slot in minutes
 * @returns Array of smaller time slots
 */
export function splitSlotByDuration(slot: TimeSlot, duration: number): TimeSlot[] {
  const result: TimeSlot[] = []
  let current = new Date(slot.start)

  while (getMinutesBetween(current, slot.end) >= duration) {
    const slotEnd = addMinutes(current, duration)
    result.push({
      start: new Date(current),
      end: slotEnd,
      available: slot.available,
      calendarId: slot.calendarId,
      eventId: slot.eventId,
    })
    current = slotEnd
  }

  return result
}

/**
 * Checks if a slot fits within another slot
 * @param inner - The slot that should fit inside
 * @param outer - The container slot
 * @returns True if inner fits completely within outer
 */
export function slotFitsWithin(inner: TimeSlot, outer: TimeSlot): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

/**
 * Combines adjacent available slots into larger blocks
 * @param slots - Array of time slots to combine
 * @returns Array of combined slots
 */
export function combineAdjacentSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return []

  // Sort by start time
  const sorted = [...slots].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )

  const result: TimeSlot[] = []
  let current = { ...sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const slot = sorted[i]

    // Check if slots are adjacent and have same availability
    if (
      current.end.getTime() === slot.start.getTime() &&
      current.available === slot.available
    ) {
      // Extend current slot
      current.end = slot.end
    } else {
      // Push current and start new
      result.push(current)
      current = { ...slot }
    }
  }

  // Don't forget the last slot
  result.push(current)

  return result
}
