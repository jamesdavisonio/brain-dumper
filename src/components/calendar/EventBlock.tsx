import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@/types/calendar'
import { format } from 'date-fns'

export interface EventBlockProps {
  event: CalendarEvent
  onClick?: () => void
  compact?: boolean  // For small time slots (15-30 min)
  color?: string     // Calendar color override
}

/**
 * Display a calendar event
 *
 * Layout (normal):
 * +------------------------------+
 * | [dot] Team Standup           |  <- Color dot + title
 * | 09:00 - 09:30                |  <- Time range
 * +------------------------------+
 *
 * Compact mode (for 15-30 min slots):
 * +------------------------------+
 * | [dot] Team Standup 9:00-9:30 |
 * +------------------------------+
 */
export function EventBlock({
  event,
  onClick,
  compact = false,
  color,
}: EventBlockProps) {
  const eventColor = color || getEventStatusColor(event.status)
  const startTime = format(event.start, 'h:mm a')
  const endTime = format(event.end, 'h:mm a')

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (event.htmlLink) {
      window.open(event.htmlLink, '_blank', 'noopener,noreferrer')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${event.title}, ${startTime} to ${endTime}${event.status === 'tentative' ? ', tentative' : ''}`}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
          'cursor-pointer transition-colors',
          'bg-gray-100 dark:bg-gray-800',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          event.status === 'tentative' && 'opacity-70',
          event.status === 'cancelled' && 'opacity-50 line-through'
        )}
      >
        <EventDot color={eventColor} size="small" />
        <span className="font-medium truncate flex-1">{event.title}</span>
        <span className="text-muted-foreground whitespace-nowrap">
          {format(event.start, 'h:mm')}-{format(event.end, 'h:mm')}
        </span>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${event.title}, ${startTime} to ${endTime}${event.status === 'tentative' ? ', tentative' : ''}`}
      className={cn(
        'flex flex-col gap-0.5 px-2 py-1.5 rounded-md',
        'cursor-pointer transition-colors',
        'bg-gray-100 dark:bg-gray-800',
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        event.status === 'tentative' && 'opacity-70 border-dashed border',
        event.status === 'cancelled' && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-1.5">
        <EventDot color={eventColor} />
        <span className={cn(
          'font-medium text-sm truncate',
          event.status === 'cancelled' && 'line-through'
        )}>
          {event.title}
        </span>
      </div>
      <div className="text-xs text-muted-foreground ml-4">
        {event.allDay ? 'All day' : `${startTime} - ${endTime}`}
      </div>
    </div>
  )
}

/**
 * Color dot indicator for event
 */
interface EventDotProps {
  color: string
  size?: 'small' | 'normal'
}

function EventDot({ color, size = 'normal' }: EventDotProps) {
  return (
    <span
      className={cn(
        'rounded-full flex-shrink-0',
        size === 'small' ? 'w-1.5 h-1.5' : 'w-2 h-2'
      )}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

/**
 * Get color based on event status
 */
function getEventStatusColor(status: CalendarEvent['status']): string {
  switch (status) {
    case 'confirmed':
      return '#3b82f6' // blue-500
    case 'tentative':
      return '#f59e0b' // amber-500
    case 'cancelled':
      return '#6b7280' // gray-500
    default:
      return '#3b82f6'
  }
}

/**
 * All-day event variant - spans the entire width
 */
export function AllDayEventBlock({
  event,
  onClick,
  color,
}: Omit<EventBlockProps, 'compact'>) {
  const eventColor = color || getEventStatusColor(event.status)

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (event.htmlLink) {
      window.open(event.htmlLink, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label={`${event.title}, all day event`}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
        'cursor-pointer transition-colors',
        'hover:opacity-80',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
      )}
      style={{
        backgroundColor: `${eventColor}20`,
        borderLeft: `3px solid ${eventColor}`
      }}
    >
      <span className="font-medium truncate">{event.title}</span>
    </div>
  )
}
