import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SchedulingSuggestion, ScoringFactor, Conflict } from '@/types'
import { useState } from 'react'

interface SuggestionCardProps {
  suggestion: SchedulingSuggestion
  selected: boolean
  onSelect: () => void
  showReasoning?: boolean
  className?: string
}

/**
 * Display a single scheduling suggestion with score and reasoning
 *
 * Layout:
 * - Radio indicator + date/time display
 * - Score with progress bar
 * - Expandable scoring factors
 * - Conflict warnings if any
 */
export function SuggestionCard({
  suggestion,
  selected,
  onSelect,
  showReasoning = true,
  className,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(selected)

  const { slot, score, reasoning, factors, conflicts } = suggestion

  const formatDate = (date: Date): string => {
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()

    if (isToday) return 'Today'
    if (isTomorrow) return 'Tomorrow'

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDuration = (): string => {
    const durationMs = slot.end.getTime() - slot.start.getTime()
    const durationMins = Math.round(durationMs / 60000)

    if (durationMins < 60) {
      return `${durationMins} min`
    }
    const hours = Math.floor(durationMins / 60)
    const mins = durationMins % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Great'
    if (score >= 70) return 'Good'
    if (score >= 60) return 'Fair'
    return 'Poor'
  }

  const getConflictIcon = (severity: Conflict['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getConflictBgColor = (severity: Conflict['severity']): string => {
    switch (severity) {
      case 'error':
        return 'bg-destructive/10 border-destructive/20'
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20'
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  const hasConflicts = conflicts.length > 0
  const errorConflicts = conflicts.filter(c => c.severity === 'error').length
  const warningConflicts = conflicts.filter(c => c.severity === 'warning').length

  return (
    <Card
      className={cn(
        'relative cursor-pointer transition-all duration-200',
        selected
          ? 'ring-2 ring-primary border-primary bg-primary/5'
          : 'hover:border-primary/50 hover:bg-accent/50',
        className
      )}
      onClick={onSelect}
    >
      <div className="p-4 space-y-3">
        {/* Header: Radio + Date/Time */}
        <div className="flex items-start gap-3">
          {/* Radio indicator */}
          <div
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/50'
            )}
          >
            {selected && <Check className="h-3 w-3" />}
          </div>

          {/* Time slot info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{formatDate(slot.start)}</span>
              <span className="text-muted-foreground">-</span>
              <span className="font-medium">
                {formatTime(slot.start)} - {formatTime(slot.end)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {formatDuration()}
              {score >= 90 && (
                <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0 h-4">
                  Best match
                </Badge>
              )}
            </div>
          </div>

          {/* Score badge */}
          <div className="text-right shrink-0">
            <div className={cn('font-semibold', getScoreColor(score))}>
              {score}/100
            </div>
            <div className="text-xs text-muted-foreground">
              {getScoreLabel(score)}
            </div>
          </div>
        </div>

        {/* Score progress bar */}
        <Progress value={score} max={100} className="h-1.5" />

        {/* Conflict summary */}
        {hasConflicts && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">
              {errorConflicts > 0 && `${errorConflicts} issue${errorConflicts > 1 ? 's' : ''}`}
              {errorConflicts > 0 && warningConflicts > 0 && ', '}
              {warningConflicts > 0 && `${warningConflicts} warning${warningConflicts > 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* Expandable reasoning section */}
        {showReasoning && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
            </button>

            {isExpanded && (
              <div className="space-y-3 pt-2 border-t">
                {/* Reasoning text */}
                {reasoning && (
                  <p className="text-sm text-muted-foreground">{reasoning}</p>
                )}

                {/* Scoring factors */}
                {factors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Scoring Factors
                    </h4>
                    <div className="space-y-1.5">
                      {factors.map((factor, index) => (
                        <ScoringFactorRow key={index} factor={factor} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {hasConflicts && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Conflicts
                    </h4>
                    <div className="space-y-2">
                      {conflicts.map((conflict, index) => (
                        <div
                          key={index}
                          className={cn(
                            'flex items-start gap-2 p-2 rounded-md border text-sm',
                            getConflictBgColor(conflict.severity)
                          )}
                        >
                          {getConflictIcon(conflict.severity)}
                          <div className="flex-1 min-w-0">
                            <p>{conflict.description}</p>
                            {conflict.resolution && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {conflict.resolution}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function ScoringFactorRow({ factor }: { factor: ScoringFactor }) {
  const getFactorColor = (val: number): string => {
    if (val >= 80) return 'text-green-600 dark:text-green-400'
    if (val >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const { value } = factor

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444' }} />
      <span className="flex-1 truncate">{factor.name}</span>
      <span className={cn('font-medium', getFactorColor(factor.value))}>
        {factor.description}
      </span>
    </div>
  )
}
