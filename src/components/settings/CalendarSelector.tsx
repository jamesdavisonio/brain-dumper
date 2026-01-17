import { CalendarItem, type ConnectedCalendar } from './CalendarItem'
import { CalendarSkeleton } from './CalendarSkeleton'
import { Label } from '@/components/ui/label'

export interface CalendarSelectorProps {
  calendars: ConnectedCalendar[]
  enabledIds: string[]
  onToggle: (calendarId: string, enabled: boolean) => void
  onTypeChange: (calendarId: string, type: 'work' | 'personal') => void
  isLoading: boolean
}

export function CalendarSelector({
  calendars,
  enabledIds,
  onToggle,
  onTypeChange,
  isLoading,
}: CalendarSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Your Calendars</Label>
        <CalendarSkeleton count={3} />
      </div>
    )
  }

  if (calendars.length === 0) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Your Calendars</Label>
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No calendars found. Please check your Google Calendar settings.
          </p>
        </div>
      </div>
    )
  }

  // Sort calendars: primary first, then by name
  const sortedCalendars = [...calendars].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1
    if (!a.isPrimary && b.isPrimary) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Your Calendars</Label>
        <span className="text-xs text-muted-foreground">
          {enabledIds.length} of {calendars.length} enabled
        </span>
      </div>

      <div className="space-y-2" role="list" aria-label="Calendar list">
        {sortedCalendars.map((calendar) => (
          <CalendarItem
            key={calendar.id}
            calendar={calendar}
            enabled={enabledIds.includes(calendar.id)}
            onToggle={(enabled) => onToggle(calendar.id, enabled)}
            onTypeChange={(type) => onTypeChange(calendar.id, type)}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Enable calendars to check for conflicts when scheduling tasks.
        Set each calendar as Work or Personal to match your task context.
      </p>
    </div>
  )
}
