import { cn } from '@/lib/utils'
import type { TimeSlot as TimeSlotType } from '@/types/calendar'
import { format } from 'date-fns'

export interface TimeSlotProps {
  slot: TimeSlotType
  isSelected?: boolean
  onClick?: () => void
  disabled?: boolean
  showTime?: boolean
}

/**
 * Individual time slot within a day
 * States:
 * - Available (green/white background, clickable)
 * - Busy (gray background, not clickable)
 * - Selected (blue border/highlight)
 * - Disabled (grayed out, not clickable)
 */
export function TimeSlot({
  slot,
  isSelected = false,
  onClick,
  disabled = false,
  showTime = false,
}: TimeSlotProps) {
  const isClickable = slot.available && !disabled && onClick

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={disabled || !slot.available}
      aria-pressed={isSelected}
      aria-label={`Time slot ${format(slot.start, 'h:mm a')} to ${format(slot.end, 'h:mm a')}, ${slot.available ? 'available' : 'busy'}${isSelected ? ', selected' : ''}`}
      className={cn(
        'w-full min-h-[2.5rem] px-2 py-1 text-left text-sm transition-all duration-150',
        'border-b border-border/50 last:border-b-0',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        // Available state
        slot.available && !disabled && [
          'bg-green-50 dark:bg-green-900/20',
          'hover:bg-green-100 dark:hover:bg-green-900/30',
          'cursor-pointer',
        ],
        // Busy state
        !slot.available && [
          'bg-gray-200 dark:bg-gray-700',
          'cursor-not-allowed',
        ],
        // Selected state
        isSelected && [
          'ring-2 ring-blue-500 ring-inset',
          'bg-blue-50 dark:bg-blue-900/30',
        ],
        // Disabled state
        disabled && [
          'opacity-50 cursor-not-allowed',
          'bg-gray-100 dark:bg-gray-800',
        ]
      )}
    >
      {showTime && (
        <span className={cn(
          'text-xs font-medium',
          slot.available ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
        )}>
          {format(slot.start, 'h:mm a')}
        </span>
      )}
    </button>
  )
}

/**
 * Outside working hours variant of TimeSlot
 * Dimmed appearance to indicate non-working time
 */
export function TimeSlotOutsideHours({
  slot,
  showTime = false,
}: Omit<TimeSlotProps, 'isSelected' | 'onClick' | 'disabled'>) {
  return (
    <div
      aria-label={`Time slot ${format(slot.start, 'h:mm a')} to ${format(slot.end, 'h:mm a')}, outside working hours`}
      className={cn(
        'w-full min-h-[2.5rem] px-2 py-1 text-left text-sm',
        'border-b border-border/30 last:border-b-0',
        'bg-gray-100 dark:bg-gray-800 opacity-50',
        // Striped pattern for outside hours
        'bg-stripes'
      )}
    >
      {showTime && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {format(slot.start, 'h:mm a')}
        </span>
      )}
    </div>
  )
}
