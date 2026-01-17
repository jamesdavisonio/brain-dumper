/**
 * Unit tests for availabilityTransformers.ts
 * @module services/__tests__/availabilityTransformers.test
 */

import { describe, it, expect } from 'vitest'
import type { AvailabilityWindow, TimeSlot } from '@/types'
import {
  formatDateKey,
  groupAvailabilityByDate,
  findBestSlots,
  isTimeAvailable,
  getNextAvailableSlot,
  mergeAvailability,
  getDailyStats,
  filterByDateRange,
  getFreeSlots,
  sortByFreeTime,
  findWindowsWithMinimumFreeTime,
} from '../availabilityTransformers'

// Helper function to create test availability windows
function createAvailabilityWindow(
  date: Date,
  slots: Array<{ start: Date; end: Date; available: boolean }>,
  totalFreeMinutes?: number,
  totalBusyMinutes?: number
): AvailabilityWindow {
  const calculatedFree = slots
    .filter((s) => s.available)
    .reduce((sum, s) => sum + Math.round((s.end.getTime() - s.start.getTime()) / 60000), 0)
  const calculatedBusy = slots
    .filter((s) => !s.available)
    .reduce((sum, s) => sum + Math.round((s.end.getTime() - s.start.getTime()) / 60000), 0)

  return {
    date,
    slots: slots.map((s) => ({ ...s, available: s.available })),
    totalFreeMinutes: totalFreeMinutes ?? calculatedFree,
    totalBusyMinutes: totalBusyMinutes ?? calculatedBusy,
  }
}

describe('formatDateKey', () => {
  it('should format date to YYYY-MM-DD', () => {
    expect(formatDateKey(new Date(2024, 0, 15))).toBe('2024-01-15')
    expect(formatDateKey(new Date(2024, 11, 31))).toBe('2024-12-31')
    expect(formatDateKey(new Date(2024, 5, 5))).toBe('2024-06-05')
  })

  it('should handle single digit months and days', () => {
    expect(formatDateKey(new Date(2024, 0, 1))).toBe('2024-01-01')
    expect(formatDateKey(new Date(2024, 8, 9))).toBe('2024-09-09')
  })
})

describe('groupAvailabilityByDate', () => {
  it('should group windows by date', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), []),
      createAvailabilityWindow(new Date(2024, 0, 16), []),
      createAvailabilityWindow(new Date(2024, 0, 17), []),
    ]

    const grouped = groupAvailabilityByDate(windows)

    expect(grouped.size).toBe(3)
    expect(grouped.has('2024-01-15')).toBe(true)
    expect(grouped.has('2024-01-16')).toBe(true)
    expect(grouped.has('2024-01-17')).toBe(true)
  })

  it('should return empty map for empty array', () => {
    const grouped = groupAvailabilityByDate([])
    expect(grouped.size).toBe(0)
  })

  it('should overwrite duplicate dates', () => {
    const window1 = createAvailabilityWindow(new Date(2024, 0, 15), [], 100, 0)
    const window2 = createAvailabilityWindow(new Date(2024, 0, 15), [], 200, 0)

    const grouped = groupAvailabilityByDate([window1, window2])

    expect(grouped.size).toBe(1)
    expect(grouped.get('2024-01-15')?.totalFreeMinutes).toBe(200)
  })
})

describe('findBestSlots', () => {
  it('should find slots that fit the requested duration', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 12, 0),
          available: true,
        },
        {
          start: new Date(2024, 0, 15, 14, 0),
          end: new Date(2024, 0, 15, 15, 0),
          available: true,
        },
      ]),
    ]

    const slots = findBestSlots(windows, 60, 5)

    expect(slots.length).toBe(2)
    expect(slots[0].start.getHours()).toBe(9)
    expect(slots[1].start.getHours()).toBe(14)
  })

  it('should respect the count limit', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 10, 0),
          available: true,
        },
        {
          start: new Date(2024, 0, 15, 10, 0),
          end: new Date(2024, 0, 15, 11, 0),
          available: true,
        },
        {
          start: new Date(2024, 0, 15, 11, 0),
          end: new Date(2024, 0, 15, 12, 0),
          available: true,
        },
      ]),
    ]

    const slots = findBestSlots(windows, 30, 2)

    expect(slots.length).toBe(2)
  })

  it('should return empty array when no slots fit', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 9, 30),
          available: true,
        },
      ]),
    ]

    const slots = findBestSlots(windows, 60, 5)

    expect(slots.length).toBe(0)
  })

  it('should skip unavailable slots', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 12, 0),
          available: false,
        },
        {
          start: new Date(2024, 0, 15, 14, 0),
          end: new Date(2024, 0, 15, 16, 0),
          available: true,
        },
      ]),
    ]

    const slots = findBestSlots(windows, 60, 5)

    expect(slots.length).toBe(1)
    expect(slots[0].start.getHours()).toBe(14)
  })
})

describe('isTimeAvailable', () => {
  const windows: AvailabilityWindow[] = [
    createAvailabilityWindow(new Date(2024, 0, 15), [
      {
        start: new Date(2024, 0, 15, 9, 0),
        end: new Date(2024, 0, 15, 12, 0),
        available: true,
      },
      {
        start: new Date(2024, 0, 15, 12, 0),
        end: new Date(2024, 0, 15, 13, 0),
        available: false,
      },
      {
        start: new Date(2024, 0, 15, 14, 0),
        end: new Date(2024, 0, 15, 17, 0),
        available: true,
      },
    ]),
  ]

  it('should return true for fully available time range', () => {
    const start = new Date(2024, 0, 15, 9, 0)
    const end = new Date(2024, 0, 15, 10, 0)

    expect(isTimeAvailable(windows, start, end)).toBe(true)
  })

  it('should return false for unavailable time range', () => {
    const start = new Date(2024, 0, 15, 12, 0)
    const end = new Date(2024, 0, 15, 13, 0)

    expect(isTimeAvailable(windows, start, end)).toBe(false)
  })

  it('should return false for partially overlapping range', () => {
    const start = new Date(2024, 0, 15, 11, 0)
    const end = new Date(2024, 0, 15, 13, 0)

    expect(isTimeAvailable(windows, start, end)).toBe(false)
  })

  it('should return false for date not in windows', () => {
    const start = new Date(2024, 0, 16, 9, 0)
    const end = new Date(2024, 0, 16, 10, 0)

    expect(isTimeAvailable(windows, start, end)).toBe(false)
  })
})

describe('getNextAvailableSlot', () => {
  const windows: AvailabilityWindow[] = [
    createAvailabilityWindow(new Date(2024, 0, 15), [
      {
        start: new Date(2024, 0, 15, 9, 0),
        end: new Date(2024, 0, 15, 10, 0),
        available: false,
      },
      {
        start: new Date(2024, 0, 15, 10, 0),
        end: new Date(2024, 0, 15, 12, 0),
        available: true,
      },
    ]),
    createAvailabilityWindow(new Date(2024, 0, 16), [
      {
        start: new Date(2024, 0, 16, 9, 0),
        end: new Date(2024, 0, 16, 17, 0),
        available: true,
      },
    ]),
  ]

  it('should find the next available slot after a given time', () => {
    const afterDate = new Date(2024, 0, 15, 9, 30)
    const slot = getNextAvailableSlot(windows, afterDate, 60)

    expect(slot).not.toBeNull()
    expect(slot?.start.getHours()).toBe(10)
    expect(slot?.start.getDate()).toBe(15)
  })

  it('should look into the next day if needed', () => {
    const afterDate = new Date(2024, 0, 15, 11, 30)
    const slot = getNextAvailableSlot(windows, afterDate, 60)

    expect(slot).not.toBeNull()
    expect(slot?.start.getDate()).toBe(16)
    expect(slot?.start.getHours()).toBe(9)
  })

  it('should return null when no slot fits', () => {
    const afterDate = new Date(2024, 0, 15, 9, 0)
    const slot = getNextAvailableSlot(windows, afterDate, 600) // 10 hours - more than any available slot

    expect(slot).toBeNull()
  })

  it('should return null for empty availability', () => {
    const slot = getNextAvailableSlot([], new Date(), 60)
    expect(slot).toBeNull()
  })
})

describe('mergeAvailability', () => {
  it('should return empty for empty input', () => {
    expect(mergeAvailability()).toEqual([])
  })

  it('should return the same windows for single array', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 17, 0),
          available: true,
        },
      ]),
    ]

    const merged = mergeAvailability(windows)

    expect(merged.length).toBe(1)
  })

  it('should find intersection of available times', () => {
    const windows1: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 14, 0),
          available: true,
        },
      ]),
    ]

    const windows2: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [
        {
          start: new Date(2024, 0, 15, 12, 0),
          end: new Date(2024, 0, 15, 17, 0),
          available: true,
        },
      ]),
    ]

    const merged = mergeAvailability(windows1, windows2)

    expect(merged.length).toBe(1)
    expect(merged[0].slots.length).toBe(1)
    expect(merged[0].slots[0].start.getHours()).toBe(12)
    expect(merged[0].slots[0].end.getHours()).toBe(14)
  })

  it('should skip dates not present in all sources', () => {
    const windows1: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), []),
      createAvailabilityWindow(new Date(2024, 0, 16), []),
    ]

    const windows2: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), []),
    ]

    const merged = mergeAvailability(windows1, windows2)

    expect(merged.length).toBe(1)
    expect(merged[0].date.getDate()).toBe(15)
  })
})

describe('getDailyStats', () => {
  it('should calculate correct stats for a day', () => {
    const window = createAvailabilityWindow(
      new Date(2024, 0, 15),
      [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 12, 0), // 180 min free
          available: true,
        },
        {
          start: new Date(2024, 0, 15, 12, 0),
          end: new Date(2024, 0, 15, 13, 0), // 60 min busy
          available: false,
        },
        {
          start: new Date(2024, 0, 15, 13, 0),
          end: new Date(2024, 0, 15, 15, 0), // 120 min free
          available: true,
        },
      ],
      300, // totalFree
      60 // totalBusy
    )

    const stats = getDailyStats(window)

    expect(stats.totalFreeMinutes).toBe(300)
    expect(stats.totalBusyMinutes).toBe(60)
    expect(stats.freePercentage).toBe(83) // 300 / 360 * 100
    expect(stats.largestFreeBlock).toBe(180)
    expect(stats.freeBlockCount).toBe(2)
  })

  it('should handle day with no free time', () => {
    const window = createAvailabilityWindow(
      new Date(2024, 0, 15),
      [
        {
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 17, 0),
          available: false,
        },
      ],
      0,
      480
    )

    const stats = getDailyStats(window)

    expect(stats.totalFreeMinutes).toBe(0)
    expect(stats.totalBusyMinutes).toBe(480)
    expect(stats.freePercentage).toBe(0)
    expect(stats.largestFreeBlock).toBe(0)
    expect(stats.freeBlockCount).toBe(0)
  })

  it('should handle empty day', () => {
    const window = createAvailabilityWindow(new Date(2024, 0, 15), [], 0, 0)

    const stats = getDailyStats(window)

    expect(stats.freePercentage).toBe(0)
    expect(stats.freeBlockCount).toBe(0)
  })
})

describe('filterByDateRange', () => {
  const windows: AvailabilityWindow[] = [
    createAvailabilityWindow(new Date(2024, 0, 10), []),
    createAvailabilityWindow(new Date(2024, 0, 15), []),
    createAvailabilityWindow(new Date(2024, 0, 20), []),
    createAvailabilityWindow(new Date(2024, 0, 25), []),
  ]

  it('should filter windows within range', () => {
    const filtered = filterByDateRange(
      windows,
      new Date(2024, 0, 12),
      new Date(2024, 0, 22)
    )

    expect(filtered.length).toBe(2)
    expect(filtered[0].date.getDate()).toBe(15)
    expect(filtered[1].date.getDate()).toBe(20)
  })

  it('should include boundary dates', () => {
    const filtered = filterByDateRange(
      windows,
      new Date(2024, 0, 15),
      new Date(2024, 0, 20)
    )

    expect(filtered.length).toBe(2)
  })

  it('should return empty for out of range', () => {
    const filtered = filterByDateRange(
      windows,
      new Date(2024, 1, 1),
      new Date(2024, 1, 28)
    )

    expect(filtered.length).toBe(0)
  })
})

describe('getFreeSlots', () => {
  const window = createAvailabilityWindow(new Date(2024, 0, 15), [
    {
      start: new Date(2024, 0, 15, 9, 0),
      end: new Date(2024, 0, 15, 10, 0), // 60 min
      available: true,
    },
    {
      start: new Date(2024, 0, 15, 10, 0),
      end: new Date(2024, 0, 15, 11, 0),
      available: false,
    },
    {
      start: new Date(2024, 0, 15, 11, 0),
      end: new Date(2024, 0, 15, 11, 30), // 30 min
      available: true,
    },
    {
      start: new Date(2024, 0, 15, 14, 0),
      end: new Date(2024, 0, 15, 16, 0), // 120 min
      available: true,
    },
  ])

  it('should return all free slots', () => {
    const slots = getFreeSlots(window)

    expect(slots.length).toBe(3)
    expect(slots.every((s) => s.available)).toBe(true)
  })

  it('should filter by minimum duration', () => {
    const slots = getFreeSlots(window, 60)

    expect(slots.length).toBe(2) // Only 60 and 120 minute slots
  })

  it('should return empty for no matching slots', () => {
    const slots = getFreeSlots(window, 180)

    expect(slots.length).toBe(0)
  })
})

describe('sortByFreeTime', () => {
  it('should sort by total free time descending', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [], 100, 0),
      createAvailabilityWindow(new Date(2024, 0, 16), [], 300, 0),
      createAvailabilityWindow(new Date(2024, 0, 17), [], 200, 0),
    ]

    const sorted = sortByFreeTime(windows)

    expect(sorted[0].totalFreeMinutes).toBe(300)
    expect(sorted[1].totalFreeMinutes).toBe(200)
    expect(sorted[2].totalFreeMinutes).toBe(100)
  })

  it('should not modify original array', () => {
    const windows: AvailabilityWindow[] = [
      createAvailabilityWindow(new Date(2024, 0, 15), [], 100, 0),
      createAvailabilityWindow(new Date(2024, 0, 16), [], 300, 0),
    ]

    sortByFreeTime(windows)

    expect(windows[0].totalFreeMinutes).toBe(100)
  })
})

describe('findWindowsWithMinimumFreeTime', () => {
  const windows: AvailabilityWindow[] = [
    createAvailabilityWindow(new Date(2024, 0, 15), [], 60, 0),
    createAvailabilityWindow(new Date(2024, 0, 16), [], 120, 0),
    createAvailabilityWindow(new Date(2024, 0, 17), [], 180, 0),
    createAvailabilityWindow(new Date(2024, 0, 18), [], 30, 0),
  ]

  it('should filter windows with minimum free time', () => {
    const filtered = findWindowsWithMinimumFreeTime(windows, 100)

    expect(filtered.length).toBe(2)
    expect(filtered.every((w) => w.totalFreeMinutes >= 100)).toBe(true)
  })

  it('should return all if all meet minimum', () => {
    const filtered = findWindowsWithMinimumFreeTime(windows, 30)

    expect(filtered.length).toBe(4)
  })

  it('should return empty if none meet minimum', () => {
    const filtered = findWindowsWithMinimumFreeTime(windows, 300)

    expect(filtered.length).toBe(0)
  })
})
