import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

interface ScheduleButtonProps {
  task: Task
  onSchedule?: (task: Task) => void
  onReschedule?: (task: Task) => void
  onUnschedule?: (task: Task) => void
  compact?: boolean
  className?: string
}

type ScheduleState = 'not_scheduled' | 'scheduled' | 'syncing' | 'error'

/**
 * Button shown on TaskCard to initiate or manage scheduling
 *
 * States:
 * - Not scheduled: Shows "Schedule" button
 * - Scheduled: Shows time + "Reschedule" option
 * - Syncing: Shows sync indicator
 * - Error: Shows error state with retry
 */
export function ScheduleButton({
  task,
  onSchedule,
  onReschedule,
  onUnschedule,
  compact = false,
  className,
}: ScheduleButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getState = (): ScheduleState => {
    if (task.syncStatus === 'pending') return 'syncing'
    if (task.syncStatus === 'error') return 'error'
    if (task.scheduledStart && task.calendarEventId) return 'scheduled'
    return 'not_scheduled'
  }

  const state = getState()

  const formatScheduledTime = (date: Date): string => {
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    if (isToday) return `Today ${timeStr}`
    if (isTomorrow) return `Tomorrow ${timeStr}`

    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dayStr} ${timeStr}`
  }

  const handleClick = () => {
    if (state === 'not_scheduled' || state === 'error') {
      onSchedule?.(task)
    }
  }

  // Not scheduled state
  if (state === 'not_scheduled') {
    return (
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={handleClick}
        className={cn(
          'gap-1.5',
          compact && 'h-7 px-2 text-xs',
          className
        )}
      >
        <Calendar className={cn('h-4 w-4', compact && 'h-3 w-3')} />
        {!compact && <span>Schedule</span>}
      </Button>
    )
  }

  // Syncing state
  if (state === 'syncing') {
    return (
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        disabled
        className={cn(
          'gap-1.5',
          compact && 'h-7 px-2 text-xs',
          className
        )}
      >
        <Loader2 className={cn('h-4 w-4 animate-spin', compact && 'h-3 w-3')} />
        {!compact && <span>Syncing...</span>}
      </Button>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={handleClick}
        className={cn(
          'gap-1.5 border-destructive text-destructive hover:bg-destructive/10',
          compact && 'h-7 px-2 text-xs',
          className
        )}
      >
        <AlertCircle className={cn('h-4 w-4', compact && 'h-3 w-3')} />
        {!compact && <span>Retry</span>}
      </Button>
    )
  }

  // Scheduled state - show time with dropdown for actions
  const scheduledTime = task.scheduledStart ? formatScheduledTime(task.scheduledStart) : ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={cn(
            'gap-1.5',
            compact && 'h-7 px-2 text-xs',
            task.syncStatus === 'synced' && 'border-green-500/50 text-green-600 dark:text-green-400',
            className
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Clock className={cn('h-4 w-4', compact && 'h-3 w-3')} />
          <span className={cn(compact && 'max-w-[80px] truncate')}>
            {isHovered ? 'Reschedule' : scheduledTime}
          </span>
          <ChevronDown className={cn('h-3 w-3 opacity-50', compact && 'h-2.5 w-2.5')} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onReschedule?.(task)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reschedule
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onUnschedule?.(task)}
          className="text-destructive"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Remove from Calendar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
