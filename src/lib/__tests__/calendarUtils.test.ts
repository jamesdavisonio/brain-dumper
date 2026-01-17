/**
 * Unit tests for calendarUtils.ts
 * @module lib/__tests__/calendarUtils.test
 */

import { describe, it, expect } from 'vitest'
import {
  hasOverlap,
  findOverlappingEvents,
  calculateAvailability,
  mergeAvailabilityWindows,
  formatEventForCalendar,
  formatBufferEvent,
  getCalendarColor,
  getEventColor,
  findFreeBlocks,
  splitSlotByDuration,
  slotFitsWithin,
  combineAdjacentSlots,
} from '../calendarUtils'
import type { TimeSlot, CalendarEvent, Task, AvailabilityWindow } from '../../types'

describe('hasOverlap', () => {
  it('should detect overlapping slots', () => {
    const slot1: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 11, 0),
      available: true,
    }
    const slot2: TimeSlot = {
      start: new Date(2024, 0, 15, 10, 0),
      end: new Date(2024, 0, 15, 12, 0),
      available: true,
    }

    expect(hasOverlap(slot1, slot2)).toBe(true)
  })

  it('should detect non-overlapping slots', () => {
    const slot1: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0),
      available: true,
    }
    const slot2: TimeSlot = {
      start: new Date(2024, 0, 15, 11, 0),
      end: new Date(2024, 0, 15, 12, 0),
      available: true,
    }

    expect(hasOverlap(slot1, slot2)).toBe(false)
  })

  it('should detect adjacent slots as non-overlapping', () => {
    const slot1: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0),
      available: true,
    }
    const slot2: TimeSlot = {
      start: new Date(2024, 0, 15, 10, 0),
      end: new Date(2024, 0, 15, 11, 0),
      available: true,
    }

    expect(hasOverlap(slot1, slot2)).toBe(false)
  })

  it('should detect fully contained slot', () => {
    const outer: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 17, 0),
      available: true,
    }
    const inner: TimeSlot = {
      start: new Date(2024, 0, 15, 11, 0),
      end: new Date(2024, 0, 15, 13, 0),
      available: true,
    }

    expect(hasOverlap(outer, inner)).toBe(true)
    expect(hasOverlap(inner, outer)).toBe(true)
  })
})

describe('findOverlappingEvents', () => {
  const events: CalendarEvent[] = [
    {
      id: '1',
      calendarId: 'cal-1',
      title: 'Meeting 1',
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0),
      allDay: false,
      status: 'confirmed',
    },
    {
      id: '2',
      calendarId: 'cal-1',
      title: 'Meeting 2',
      start: new Date(2024, 0, 15, 11, 0),
      end: new Date(2024, 0, 15, 12, 0),
      allDay: false,
      status: 'confirmed',
    },
    {
      id: '3',
      calendarId: 'cal-1',
      title: 'Cancelled',
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0),
      allDay: false,
      status: 'cancelled',
    },
  ]

  it('should find overlapping events', () => {
    const slot: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 30),
      end: new Date(2024, 0, 15, 10, 30),
      available: true,
    }

    const overlapping = findOverlappingEvents(slot, events)
    expect(overlapping.length).toBe(1)
    expect(overlapping[0].id).toBe('1')
  })

  it('should exclude cancelled events', () => {
    const slot: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0),
      available: true,
    }

    const overlapping = findOverlappingEvents(slot, events)
    // Should only find event 1, not the cancelled event 3
    expect(overlapping.length).toBe(1)
    expect(overlapping[0].status).not.toBe('cancelled')
  })

  it('should return empty array for no overlaps', () => {
    const slot: TimeSlot = {
      start: new Date(2024, 0, 15, 14, 0),
      end: new Date(2024, 0, 15, 15, 0),
      available: true,
    }

    const overlapping = findOverlappingEvents(slot, events)
    expect(overlapping.length).toBe(0)
  })
})

describe('calculateAvailability', () => {
  const workingHours = { start: '09:00', end: '17:00' }

  it('should mark slots as available when no events', () => {
    const date = new Date(2024, 0, 15)
    const result = calculateAvailability([], date, workingHours)

    expect(result.date).toEqual(date)
    expect(result.totalFreeMinutes).toBeGreaterThan(0)
    expect(result.totalBusyMinutes).toBe(0)
  })

  it('should mark slots as unavailable when events exist', () => {
    const date = new Date(2024, 0, 15)
    const events: CalendarEvent[] = [
      {
        id: '1',
        calendarId: 'cal-1',
        title: 'Meeting',
        start: new Date(2024, 0, 15, 10, 0),
        end: new Date(2024, 0, 15, 11, 0),
        allDay: false,
        status: 'confirmed',
      },
    ]

    const result = calculateAvailability(events, date, workingHours)
    expect(result.totalBusyMinutes).toBe(60) // 1 hour meeting
  })

  it('should mark slots outside working hours as unavailable', () => {
    const date = new Date(2024, 0, 15)
    const result = calculateAvailability([], date, workingHours)

    // Check a slot before working hours
    const beforeWorkSlot = result.slots.find(
      (s) => s.start.getHours() === 8
    )
    expect(beforeWorkSlot?.available).toBe(false)

    // Check a slot after working hours
    const afterWorkSlot = result.slots.find(
      (s) => s.start.getHours() === 18
    )
    expect(afterWorkSlot?.available).toBe(false)
  })
})

describe('mergeAvailabilityWindows', () => {
  it('should return empty window for empty input', () => {
    const result = mergeAvailabilityWindows([])
    expect(result.slots.length).toBe(0)
    expect(result.totalFreeMinutes).toBe(0)
  })

  it('should return same window for single input', () => {
    const window: AvailabilityWindow = {
      date: new Date(2024, 0, 15),
      slots: [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 10, 0),
          available: true,
        },
      ],
      totalFreeMinutes: 60,
      totalBusyMinutes: 0,
    }

    const result = mergeAvailabilityWindows([window])
    expect(result).toEqual(window)
  })

  it('should merge availability correctly', () => {
    const window1: AvailabilityWindow = {
      date: new Date(2024, 0, 15),
      slots: [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 10, 0),
          available: true,
        },
      ],
      totalFreeMinutes: 60,
      totalBusyMinutes: 0,
    }

    const window2: AvailabilityWindow = {
      date: new Date(2024, 0, 15),
      slots: [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 10, 0),
          available: false,
          calendarId: 'cal-2',
        },
      ],
      totalFreeMinutes: 0,
      totalBusyMinutes: 60,
    }

    const result = mergeAvailabilityWindows([window1, window2])
    // Slot should be unavailable since one calendar has it busy
    expect(result.slots[0].available).toBe(false)
  })
})

describe('formatEventForCalendar', () => {
  const task: Task = {
    id: 'task-1',
    content: 'Complete project report',
    project: 'Work',
    priority: 'high',
    completed: false,
    archived: false,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 1,
    timeEstimate: 60,
    category: 'Work',
  }

  const slot: TimeSlot = {
    start: new Date(2024, 0, 15, 14, 0),
    end: new Date(2024, 0, 15, 15, 0),
    available: true,
  }

  it('should format task as calendar event', () => {
    const result = formatEventForCalendar(task, slot)

    expect(result.title).toBe(task.content)
    expect(result.start).toEqual(slot.start)
    expect(result.end).toEqual(slot.end)
    expect(result.brainDumperTaskId).toBe(task.id)
    expect(result.allDay).toBe(false)
    expect(result.status).toBe('confirmed')
  })

  it('should include task details in description', () => {
    const result = formatEventForCalendar(task, slot)

    expect(result.description).toContain('Project: Work')
    expect(result.description).toContain('Priority: high')
    expect(result.description).toContain('Estimated time:')
  })
})

describe('formatBufferEvent', () => {
  const task: Task = {
    id: 'task-1',
    content: 'Important meeting',
    priority: 'high',
    completed: false,
    archived: false,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 1,
  }

  const mainStart = new Date(2024, 0, 15, 14, 0)
  const mainEnd = new Date(2024, 0, 15, 15, 0)

  it('should format before buffer correctly', () => {
    const result = formatBufferEvent(task, 'before', 15, mainStart, mainEnd)

    expect(result.title).toContain('Prep:')
    expect(result.end).toEqual(mainStart)
    expect(result.brainDumperBufferType).toBe('before')
  })

  it('should format after buffer correctly', () => {
    const result = formatBufferEvent(task, 'after', 10, mainStart, mainEnd)

    expect(result.title).toContain('Wrap-up:')
    expect(result.start).toEqual(mainEnd)
    expect(result.brainDumperBufferType).toBe('after')
  })
})

describe('getCalendarColor', () => {
  it('should return blue for work calendar', () => {
    expect(getCalendarColor('work')).toBe('#3b82f6')
  })

  it('should return green for personal calendar', () => {
    expect(getCalendarColor('personal')).toBe('#10b981')
  })
})

describe('getEventColor', () => {
  it('should return colors for each task type', () => {
    expect(getEventColor('deep_work')).toBe('#8b5cf6')
    expect(getEventColor('coding')).toBe('#3b82f6')
    expect(getEventColor('call')).toBe('#f59e0b')
    expect(getEventColor('meeting')).toBe('#ef4444')
    expect(getEventColor('personal')).toBe('#10b981')
    expect(getEventColor('admin')).toBe('#6b7280')
    expect(getEventColor('health')).toBe('#ec4899')
    expect(getEventColor('other')).toBe('#64748b')
  })
})

describe('findFreeBlocks', () => {
  it('should find continuous free blocks', () => {
    const window: AvailabilityWindow = {
      date: new Date(2024, 0, 15),
      slots: [
        { start: new Date(2024, 0, 15, 9, 0), end: new Date(2024, 0, 15, 9, 15), available: true },
        { start: new Date(2024, 0, 15, 9, 15), end: new Date(2024, 0, 15, 9, 30), available: true },
        { start: new Date(2024, 0, 15, 9, 30), end: new Date(2024, 0, 15, 9, 45), available: true },
        { start: new Date(2024, 0, 15, 9, 45), end: new Date(2024, 0, 15, 10, 0), available: true },
        { start: new Date(2024, 0, 15, 10, 0), end: new Date(2024, 0, 15, 10, 15), available: false },
        { start: new Date(2024, 0, 15, 10, 15), end: new Date(2024, 0, 15, 10, 30), available: true },
      ],
      totalFreeMinutes: 75,
      totalBusyMinutes: 15,
    }

    const blocks = findFreeBlocks(window, 30)
    expect(blocks.length).toBe(1) // Only the 1-hour block qualifies
    expect(blocks[0].start.getHours()).toBe(9)
    expect(blocks[0].end.getHours()).toBe(10)
  })

  it('should return empty array when no blocks meet minimum duration', () => {
    const window: AvailabilityWindow = {
      date: new Date(2024, 0, 15),
      slots: [
        { start: new Date(2024, 0, 15, 9, 0), end: new Date(2024, 0, 15, 9, 15), available: true },
        { start: new Date(2024, 0, 15, 9, 15), end: new Date(2024, 0, 15, 9, 30), available: false },
      ],
      totalFreeMinutes: 15,
      totalBusyMinutes: 15,
    }

    const blocks = findFreeBlocks(window, 30)
    expect(blocks.length).toBe(0)
  })
})

describe('splitSlotByDuration', () => {
  it('should split slot into smaller slots', () => {
    const slot: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 11, 0),
      available: true,
    }

    const result = splitSlotByDuration(slot, 30)
    expect(result.length).toBe(4) // 2 hours / 30 minutes = 4 slots
    expect(result[0].start.getHours()).toBe(9)
    expect(result[0].end.getMinutes()).toBe(30)
  })

  it('should handle uneven splits', () => {
    const slot: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 9, 45),
      available: true,
    }

    const result = splitSlotByDuration(slot, 30)
    expect(result.length).toBe(1) // Only one 30-minute slot fits
  })
})

describe('slotFitsWithin', () => {
  it('should return true when inner fits within outer', () => {
    const inner: TimeSlot = {
      start: new Date(2024, 0, 15, 10, 0),
      end: new Date(2024, 0, 15, 11, 0),
      available: true,
    }
    const outer: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 12, 0),
      available: true,
    }

    expect(slotFitsWithin(inner, outer)).toBe(true)
  })

  it('should return false when inner exceeds outer', () => {
    const inner: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 13, 0),
      available: true,
    }
    const outer: TimeSlot = {
      start: new Date(2024, 0, 15, 10, 0),
      end: new Date(2024, 0, 15, 12, 0),
      available: true,
    }

    expect(slotFitsWithin(inner, outer)).toBe(false)
  })

  it('should return true for exact match', () => {
    const slot: TimeSlot = {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0),
      available: true,
    }

    expect(slotFitsWithin(slot, slot)).toBe(true)
  })
})

describe('combineAdjacentSlots', () => {
  it('should combine adjacent available slots', () => {
    const slots: TimeSlot[] = [
      { start: new Date(2024, 0, 15, 9, 0), end: new Date(2024, 0, 15, 10, 0), available: true },
      { start: new Date(2024, 0, 15, 10, 0), end: new Date(2024, 0, 15, 11, 0), available: true },
      { start: new Date(2024, 0, 15, 11, 0), end: new Date(2024, 0, 15, 12, 0), available: true },
    ]

    const result = combineAdjacentSlots(slots)
    expect(result.length).toBe(1)
    expect(result[0].start.getHours()).toBe(9)
    expect(result[0].end.getHours()).toBe(12)
  })

  it('should not combine slots with different availability', () => {
    const slots: TimeSlot[] = [
      { start: new Date(2024, 0, 15, 9, 0), end: new Date(2024, 0, 15, 10, 0), available: true },
      { start: new Date(2024, 0, 15, 10, 0), end: new Date(2024, 0, 15, 11, 0), available: false },
      { start: new Date(2024, 0, 15, 11, 0), end: new Date(2024, 0, 15, 12, 0), available: true },
    ]

    const result = combineAdjacentSlots(slots)
    expect(result.length).toBe(3)
  })

  it('should return empty array for empty input', () => {
    const result = combineAdjacentSlots([])
    expect(result.length).toBe(0)
  })

  it('should handle unsorted input', () => {
    const slots: TimeSlot[] = [
      { start: new Date(2024, 0, 15, 11, 0), end: new Date(2024, 0, 15, 12, 0), available: true },
      { start: new Date(2024, 0, 15, 9, 0), end: new Date(2024, 0, 15, 10, 0), available: true },
      { start: new Date(2024, 0, 15, 10, 0), end: new Date(2024, 0, 15, 11, 0), available: true },
    ]

    const result = combineAdjacentSlots(slots)
    expect(result.length).toBe(1)
    expect(result[0].start.getHours()).toBe(9)
  })
})
