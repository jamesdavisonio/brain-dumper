import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduledBadgeProps {
  scheduledStart: Date
  scheduledEnd: Date
  syncStatus?: 'pending' | 'synced' | 'error' | 'orphaned'
  onClick?: () => void
  compact?: boolean
  className?: string
}

/**
 * Badge showing scheduled time on task cards
 *
 * Display formats:
 * - "Mon 9:00 AM" for specific day
 * - "Today 2:30 PM" for today
 * - "Tomorrow 10:00 AM" for tomorrow
 *
 * Shows sync status icon and is clickable to open reschedule modal
 */
export function ScheduledBadge({
  scheduledStart,
  scheduledEnd,
  syncStatus = 'synced',
  onClick,
  compact = false,
  className,
}: ScheduledBadgeProps) {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDisplayDate = (date: Date): string => {
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()

    if (isToday) return 'Today'
    if (isTomorrow) return 'Tomorrow'

    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const formatDuration = (): string => {
    const durationMs = scheduledEnd.getTime() - scheduledStart.getTime()
    const durationMins = Math.round(durationMs / 60000)

    if (durationMins < 60) {
      return `${durationMins}m`
    }
    const hours = Math.floor(durationMins / 60)
    const mins = durationMins % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'pending':
        return <Loader2 className="h-3 w-3 animate-spin" />
      case 'error':
      case 'orphaned':
        return <AlertCircle className="h-3 w-3 text-destructive" />
      case 'synced':
        return <Check className="h-3 w-3 text-green-500" />
      default:
        return null
    }
  }

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'pending':
        return 'border-amber-500/50 bg-amber-500/10'
      case 'error':
      case 'orphaned':
        return 'border-destructive/50 bg-destructive/10'
      case 'synced':
        return 'border-green-500/50 bg-green-500/10'
      default:
        return ''
    }
  }

  const displayDate = formatDisplayDate(scheduledStart)
  const displayTime = formatTime(scheduledStart)
  const displayDuration = formatDuration()

  if (compact) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'cursor-pointer gap-1 px-1.5 py-0 h-5 text-xs',
          getSyncStatusColor(),
          onClick && 'hover:bg-accent',
          className
        )}
        onClick={onClick}
      >
        <Clock className="h-3 w-3" />
        <span>{displayTime}</span>
        {getSyncIcon()}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer gap-1.5 px-2 py-0.5',
        getSyncStatusColor(),
        onClick && 'hover:bg-accent',
        className
      )}
      onClick={onClick}
    >
      <Calendar className="h-3.5 w-3.5" />
      <span className="font-medium">{displayDate}</span>
      <span>{displayTime}</span>
      <span className="text-muted-foreground">({displayDuration})</span>
      {getSyncIcon()}
    </Badge>
  )
}
