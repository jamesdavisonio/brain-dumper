import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cn,
  formatDate,
  formatDateTime,
  formatTimeEstimate,
  getPriorityColor,
  generateId,
  debounce,
  formatTimeOfDay,
} from './utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const condition = false
    expect(cn('foo', condition && 'bar', 'baz')).toBe('foo baz')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })
})

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-03-15')
    expect(formatDate(date)).toMatch(/Mar 15/)
  })
})

describe('formatDateTime', () => {
  it('formats date and time correctly', () => {
    const date = new Date('2024-03-15T14:30:00')
    const formatted = formatDateTime(date)
    expect(formatted).toContain('Mar')
    expect(formatted).toContain('15')
  })
})

describe('formatTimeEstimate', () => {
  it('formats minutes less than 60', () => {
    expect(formatTimeEstimate(30)).toBe('30m')
    expect(formatTimeEstimate(45)).toBe('45m')
  })

  it('formats hours only', () => {
    expect(formatTimeEstimate(60)).toBe('1h')
    expect(formatTimeEstimate(120)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatTimeEstimate(90)).toBe('1h 30m')
    expect(formatTimeEstimate(150)).toBe('2h 30m')
  })
})

describe('getPriorityColor', () => {
  it('returns correct color for high priority', () => {
    const color = getPriorityColor('high')
    expect(color).toContain('red')
  })

  it('returns correct color for medium priority', () => {
    const color = getPriorityColor('medium')
    expect(color).toContain('yellow')
  })

  it('returns correct color for low priority', () => {
    const color = getPriorityColor('low')
    expect(color).toContain('green')
  })
})

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })

  it('generates ID with expected format', () => {
    const id = generateId()
    expect(id).toMatch(/^\d+-[a-z0-9]+$/)
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('debounces function calls', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls function with correct arguments', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn('arg1', 'arg2')

    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    vi.advanceTimersByTime(50)
    debouncedFn()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('formatTimeOfDay', () => {
  it('returns M for morning', () => {
    expect(formatTimeOfDay('morning')).toBe('M')
    expect(formatTimeOfDay('Morning')).toBe('M')
    expect(formatTimeOfDay('MORNING')).toBe('M')
  })

  it('returns A for afternoon', () => {
    expect(formatTimeOfDay('afternoon')).toBe('A')
    expect(formatTimeOfDay('Afternoon')).toBe('A')
  })

  it('returns E for evening', () => {
    expect(formatTimeOfDay('evening')).toBe('E')
    expect(formatTimeOfDay('Evening')).toBe('E')
  })

  it('returns null for undefined or null', () => {
    expect(formatTimeOfDay(undefined)).toBeNull()
    expect(formatTimeOfDay(null)).toBeNull()
  })

  it('returns null for unrecognized values', () => {
    expect(formatTimeOfDay('night')).toBeNull()
    expect(formatTimeOfDay('noon')).toBeNull()
  })
})
