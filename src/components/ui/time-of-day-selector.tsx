import { Sunrise, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

interface TimeOfDaySelectorProps {
  value: TimeOfDay | null
  onChange: (value: TimeOfDay | null) => void
  disabled?: boolean
  className?: string
}

const timeOptions = [
  { value: 'morning' as const, label: 'Morning', icon: Sunrise },
  { value: 'afternoon' as const, label: 'Afternoon', icon: Sun },
  { value: 'evening' as const, label: 'Evening', icon: Moon },
]

export function TimeOfDaySelector({
  value,
  onChange,
  disabled = false,
  className,
}: TimeOfDaySelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-muted-foreground">
        ⏰ Time of day
      </label>
      <div className="grid grid-cols-3 gap-2">
        {timeOptions.map((option) => {
          const Icon = option.icon
          const isSelected = value === option.value

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(isSelected ? null : option.value)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                isSelected
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
