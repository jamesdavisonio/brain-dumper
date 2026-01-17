import { Star } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ConnectedCalendar {
  id: string
  name: string
  color: string
  isPrimary: boolean
  type: 'work' | 'personal'
}

export interface CalendarItemProps {
  calendar: ConnectedCalendar
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onTypeChange: (type: 'work' | 'personal') => void
}

export function CalendarItem({
  calendar,
  enabled,
  onToggle,
  onTypeChange,
}: CalendarItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        enabled
          ? 'bg-card border-border'
          : 'bg-muted/30 border-transparent opacity-75'
      )}
    >
      {/* Calendar Color Indicator */}
      <div
        className="h-4 w-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: calendar.color }}
        aria-hidden="true"
      />

      {/* Calendar Name and Primary Badge */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            'text-sm truncate',
            calendar.isPrimary && 'font-semibold'
          )}
          title={calendar.name}
        >
          {calendar.name}
        </span>

        {calendar.isPrimary && (
          <Badge variant="secondary" className="flex-shrink-0 gap-1 text-xs">
            <Star className="h-3 w-3" aria-hidden="true" />
            Primary
          </Badge>
        )}
      </div>

      {/* Type Selector */}
      <Select
        value={calendar.type}
        onValueChange={(value) => onTypeChange(value as 'work' | 'personal')}
        disabled={!enabled}
      >
        <SelectTrigger
          className="w-[100px] h-8 text-xs"
          aria-label={`Calendar type for ${calendar.name}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="work">Work</SelectItem>
          <SelectItem value="personal">Personal</SelectItem>
        </SelectContent>
      </Select>

      {/* Enable/Disable Switch */}
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${calendar.name} calendar`}
      />
    </div>
  )
}
