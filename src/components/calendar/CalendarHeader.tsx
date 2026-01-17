import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export interface CalendarHeaderProps {
  currentDate: Date
  viewMode: 'day' | 'week'
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onViewModeChange: (mode: 'day' | 'week') => void
  isLoading?: boolean
}

/**
 * Navigation and controls for the calendar
 *
 * Layout:
 * +-----------------------------------------------------------+
 * |  < | January 2026 | >  | Today |  [Day] [Week]            |
 * +-----------------------------------------------------------+
 */
export function CalendarHeader({
  currentDate,
  viewMode,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
  isLoading = false,
}: CalendarHeaderProps) {
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2"
      role="navigation"
      aria-label="Calendar navigation"
    >
      {/* Date navigation */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          disabled={isLoading}
          aria-label={viewMode === 'week' ? 'Previous week' : 'Previous day'}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Current date display */}
        <div className="min-w-[160px] text-center">
          <h2 className="text-lg font-semibold flex items-center justify-center gap-2">
            {format(currentDate, 'MMMM yyyy')}
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </h2>
        </div>

        {/* Next button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={isLoading}
          aria-label={viewMode === 'week' ? 'Next week' : 'Next day'}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Today button */}
        <Button
          variant="outline"
          onClick={onToday}
          disabled={isLoading}
          className="ml-2"
        >
          Today
        </Button>
      </div>

      {/* View mode toggle */}
      <div
        className="flex items-center gap-1 rounded-lg border p-1"
        role="tablist"
        aria-label="Calendar view mode"
      >
        <ViewModeButton
          mode="day"
          currentMode={viewMode}
          onClick={() => onViewModeChange('day')}
          disabled={isLoading}
        />
        <ViewModeButton
          mode="week"
          currentMode={viewMode}
          onClick={() => onViewModeChange('week')}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}

/**
 * Individual view mode toggle button
 */
interface ViewModeButtonProps {
  mode: 'day' | 'week'
  currentMode: 'day' | 'week'
  onClick: () => void
  disabled?: boolean
}

function ViewModeButton({ mode, currentMode, onClick, disabled }: ViewModeButtonProps) {
  const isActive = mode === currentMode
  const label = mode.charAt(0).toUpperCase() + mode.slice(1)

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`${mode}-view-panel`}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {label}
    </button>
  )
}

/**
 * Compact version for mobile
 */
export function CalendarHeaderCompact({
  currentDate,
  onPrevious,
  onNext,
  isLoading = false,
}: Pick<CalendarHeaderProps, 'currentDate' | 'onPrevious' | 'onNext' | 'isLoading'>) {
  return (
    <div
      className="flex items-center justify-between py-2"
      role="navigation"
      aria-label="Calendar navigation"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        disabled={isLoading}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">
          {format(currentDate, 'EEE, MMM d')}
        </h2>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={isLoading}
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
