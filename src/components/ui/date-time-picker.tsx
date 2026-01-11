import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn, formatTimeOfDay } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TimeOfDaySelector, type TimeOfDay } from "@/components/ui/time-of-day-selector"
import { Badge } from "@/components/ui/badge"

export interface DateTimeValue {
  date: Date | undefined
  timeOfDay: TimeOfDay | null
}

interface DateTimePickerProps {
  value: DateTimeValue
  onChange: (value: DateTimeValue) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date...",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    onChange({ ...value, date })
  }

  const handleTimeOfDayChange = (timeOfDay: TimeOfDay | null) => {
    onChange({ ...value, timeOfDay })
  }

  const handleClear = () => {
    onChange({ date: undefined, timeOfDay: null })
    setOpen(false)
  }

  const handleToday = () => {
    onChange({ date: new Date(), timeOfDay: value.timeOfDay })
  }

  const handleDone = () => {
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value?.date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.date ? (
            <span className="flex items-center gap-1">
              {format(value.date, "MMM d, yyyy")}
              {formatTimeOfDay(value.timeOfDay) && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 ml-1">
                  {formatTimeOfDay(value.timeOfDay)}
                </Badge>
              )}
            </span>
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value?.date}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="p-3 border-t">
          <TimeOfDaySelector
            value={value?.timeOfDay || null}
            onChange={handleTimeOfDayChange}
            disabled={!value?.date}
          />
        </div>
        <div className="flex gap-2 p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
          >
            Clear
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToday}
          >
            Today
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDone}
            disabled={!value?.date}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
