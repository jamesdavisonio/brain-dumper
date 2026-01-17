import { useState, useMemo } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow } from '@/types'
import { Clock } from 'lucide-react'

interface TimeSlotPickerProps {
  selectedDate: Date | undefined
  selectedTime: string | null
  availability: AvailabilityWindow[]
  onSelect: (date: Date, time: string) => void
  minDuration?: number // in minutes
  className?: string
}

/**
 * Mini calendar for manual time selection
 *
 * Features:
 * - Compact calendar view
 * - Shows available vs busy slots
 * - Allows picking custom time
 * - Highlights dates with good availability
 */
export function TimeSlotPicker({
  selectedDate,
  selectedTime,
  availability,
  onSelect,
  minDuration = 30,
  className,
}: TimeSlotPickerProps) {
  const [internalDate, setInternalDate] = useState<Date | undefined>(selectedDate)

  // Generate time slots for the selected date
  const timeSlots = useMemo(() => {
    if (!internalDate) return []

    const slots: { time: string; available: boolean; label: string }[] = []
    const dateKey = internalDate.toDateString()
    const dayAvailability = availability.find(
      (a) => new Date(a.date).toDateString() === dateKey
    )

    // Generate 30-minute slots from 6 AM to 10 PM
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const label = new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })

        // Check if this slot is available
        let available = true
        if (dayAvailability) {
          const slotTime = new Date(internalDate)
          slotTime.setHours(hour, minute, 0, 0)
          const slotEndTime = new Date(slotTime.getTime() + minDuration * 60000)

          // Check against each availability slot
          available = dayAvailability.slots.some((s) => {
            const slotStart = new Date(s.start)
            const slotEnd = new Date(s.end)
            return s.available && slotTime >= slotStart && slotEndTime <= slotEnd
          })
        }

        slots.push({ time: timeStr, available, label })
      }
    }

    return slots
  }, [internalDate, availability, minDuration])

  // Calculate availability for calendar highlighting
  const getDateAvailability = (date: Date): 'high' | 'medium' | 'low' | 'none' => {
    const dateKey = date.toDateString()
    const dayAvailability = availability.find(
      (a) => new Date(a.date).toDateString() === dateKey
    )

    if (!dayAvailability) return 'none'

    const freeHours = dayAvailability.totalFreeMinutes / 60
    if (freeHours >= 6) return 'high'
    if (freeHours >= 3) return 'medium'
    if (freeHours >= 1) return 'low'
    return 'none'
  }

  const handleDateSelect = (date: Date | undefined) => {
    setInternalDate(date)
    // Reset time selection when date changes
  }

  const handleTimeSelect = (time: string) => {
    if (internalDate) {
      onSelect(internalDate, time)
    }
  }

  // Custom day renderer for calendar
  const modifiers = useMemo(() => {
    const highAvail: Date[] = []
    const mediumAvail: Date[] = []
    const lowAvail: Date[] = []

    availability.forEach((a) => {
      const date = new Date(a.date)
      const level = getDateAvailability(date)
      if (level === 'high') highAvail.push(date)
      else if (level === 'medium') mediumAvail.push(date)
      else if (level === 'low') lowAvail.push(date)
    })

    return {
      highAvailability: highAvail,
      mediumAvailability: mediumAvail,
      lowAvailability: lowAvail,
    }
  }, [availability])

  const modifiersStyles = {
    highAvailability: {
      backgroundColor: 'rgb(34 197 94 / 0.2)',
      borderRadius: '0.375rem',
    },
    mediumAvailability: {
      backgroundColor: 'rgb(245 158 11 / 0.2)',
      borderRadius: '0.375rem',
    },
    lowAvailability: {
      backgroundColor: 'rgb(239 68 68 / 0.2)',
      borderRadius: '0.375rem',
    },
  }

  return (
    <div className={cn('flex flex-col sm:flex-row gap-4', className)}>
      {/* Calendar */}
      <div className="flex-shrink-0">
        <Calendar
          mode="single"
          selected={internalDate}
          onSelect={handleDateSelect}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="rounded-md border"
        />

        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/20" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/20" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/20" />
            <span>Low</span>
          </div>
        </div>
      </div>

      {/* Time slots */}
      {internalDate && (
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {internalDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <ScrollArea className="h-[280px] pr-4">
            <div className="grid grid-cols-2 gap-1.5">
              {timeSlots.map(({ time, available, label }) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? 'default' : 'outline'}
                  size="sm"
                  disabled={!available}
                  onClick={() => handleTimeSelect(time)}
                  className={cn(
                    'h-8 text-xs justify-start',
                    !available && 'opacity-40 cursor-not-allowed',
                    selectedTime === time && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  {label}
                  {!available && (
                    <span className="ml-auto text-[10px] text-muted-foreground">Busy</span>
                  )}
                </Button>
              ))}
            </div>
          </ScrollArea>

          {timeSlots.filter((s) => s.available).length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              No available slots for this date.
              <br />
              Try selecting a different day.
            </div>
          )}
        </div>
      )}

      {!internalDate && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Select a date to see available times
        </div>
      )}
    </div>
  )
}
