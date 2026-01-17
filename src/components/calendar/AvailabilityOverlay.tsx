import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow, TimeSlot } from '@/types/calendar'
import { Badge } from '@/components/ui/badge'

export interface AvailabilityOverlayProps {
  availability: AvailabilityWindow
  showPercentage?: boolean  // Show "60% free" badge
}

/**
 * Visual overlay showing free/busy status
 *
 * Renders colored blocks indicating:
 * - Green: Available
 * - Gray: Busy
 * - Striped: Outside working hours
 */
export function AvailabilityOverlay({
  availability,
  showPercentage = false,
}: AvailabilityOverlayProps) {
  const freePercentage = useMemo(() => {
    const total = availability.totalFreeMinutes + availability.totalBusyMinutes
    if (total === 0) return 0
    return Math.round((availability.totalFreeMinutes / total) * 100)
  }, [availability])

  return (
    <div className="relative">
      {showPercentage && (
        <AvailabilityBadge percentage={freePercentage} />
      )}
      <div className="flex flex-col gap-px">
        {availability.slots.map((slot, index) => (
          <AvailabilityBlock key={index} slot={slot} />
        ))}
      </div>
    </div>
  )
}

/**
 * Individual availability block
 */
interface AvailabilityBlockProps {
  slot: TimeSlot
  compact?: boolean
}

function AvailabilityBlock({ slot, compact = false }: AvailabilityBlockProps) {
  return (
    <div
      className={cn(
        'transition-colors',
        compact ? 'h-1' : 'h-2',
        slot.available
          ? 'bg-green-400 dark:bg-green-600'
          : 'bg-gray-300 dark:bg-gray-600'
      )}
      role="presentation"
      aria-label={slot.available ? 'Available' : 'Busy'}
    />
  )
}

/**
 * Badge showing availability percentage
 */
interface AvailabilityBadgeProps {
  percentage: number
}

function AvailabilityBadge({ percentage }: AvailabilityBadgeProps) {
  const variant = getVariantByPercentage(percentage)

  return (
    <Badge
      variant="outline"
      className={cn(
        'absolute -top-2 right-0 text-[10px] px-1.5 py-0',
        variant === 'good' && 'border-green-500 text-green-700 dark:text-green-400',
        variant === 'medium' && 'border-yellow-500 text-yellow-700 dark:text-yellow-400',
        variant === 'poor' && 'border-red-500 text-red-700 dark:text-red-400'
      )}
    >
      {percentage}% free
    </Badge>
  )
}

function getVariantByPercentage(percentage: number): 'good' | 'medium' | 'poor' {
  if (percentage >= 60) return 'good'
  if (percentage >= 30) return 'medium'
  return 'poor'
}

/**
 * Horizontal availability bar (for summaries)
 */
export interface AvailabilityBarProps {
  availability: AvailabilityWindow
  height?: 'sm' | 'md' | 'lg'
}

export function AvailabilityBar({
  availability,
  height = 'md',
}: AvailabilityBarProps) {
  const freePercentage = useMemo(() => {
    const total = availability.totalFreeMinutes + availability.totalBusyMinutes
    if (total === 0) return 0
    return Math.round((availability.totalFreeMinutes / total) * 100)
  }, [availability])

  return (
    <div
      className={cn(
        'w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden',
        height === 'sm' && 'h-1',
        height === 'md' && 'h-2',
        height === 'lg' && 'h-3'
      )}
      role="progressbar"
      aria-valuenow={freePercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${freePercentage}% available`}
    >
      <div
        className={cn(
          'h-full transition-all duration-300',
          freePercentage >= 60 && 'bg-green-500',
          freePercentage >= 30 && freePercentage < 60 && 'bg-yellow-500',
          freePercentage < 30 && 'bg-red-500'
        )}
        style={{ width: `${freePercentage}%` }}
      />
    </div>
  )
}

/**
 * Day summary card with availability visualization
 */
export interface DayAvailabilitySummaryProps {
  availability: AvailabilityWindow
  dateLabel: string
  onClick?: () => void
}

export function DayAvailabilitySummary({
  availability,
  dateLabel,
  onClick,
}: DayAvailabilitySummaryProps) {
  const freeHours = Math.round(availability.totalFreeMinutes / 60 * 10) / 10
  const busyHours = Math.round(availability.totalBusyMinutes / 60 * 10) / 10
  const freePercentage = useMemo(() => {
    const total = availability.totalFreeMinutes + availability.totalBusyMinutes
    if (total === 0) return 0
    return Math.round((availability.totalFreeMinutes / total) * 100)
  }, [availability])

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full p-3 rounded-lg border transition-colors text-left',
        'bg-card hover:bg-muted/50',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        onClick && 'cursor-pointer',
        !onClick && 'cursor-default'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{dateLabel}</span>
        <span className={cn(
          'text-xs font-medium',
          freePercentage >= 60 && 'text-green-600 dark:text-green-400',
          freePercentage >= 30 && freePercentage < 60 && 'text-yellow-600 dark:text-yellow-400',
          freePercentage < 30 && 'text-red-600 dark:text-red-400'
        )}>
          {freePercentage}% free
        </span>
      </div>
      <AvailabilityBar availability={availability} height="sm" />
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{freeHours}h free</span>
        <span>{busyHours}h busy</span>
      </div>
    </button>
  )
}
