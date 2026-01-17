import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar,
  Clock,
  Check,
  X,
  ChevronDown,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { cn, formatTimeEstimate } from '@/lib/utils'
import type { Task, TimeSlot, SchedulingSuggestion } from '@/types'

type ApprovalState = 'pending' | 'approved' | 'rejected' | 'modified'

interface ScheduledTaskItem {
  task: Task
  proposedSlot: TimeSlot | null
  suggestions: SchedulingSuggestion[]
  approvalState: ApprovalState
  error?: string
}

interface ScheduleProposal {
  items: ScheduledTaskItem[]
  generatedAt: Date
  summary: {
    totalTasks: number
    scheduled: number
    conflicts: number
    displacements: number
    unschedulable: number
  }
}

interface ScheduleApprovalPanelProps {
  proposal: ScheduleProposal
  approvals: Map<string, ApprovalState>
  onApprovalChange: (taskId: string, state: ApprovalState) => void
  onSlotChange?: (taskId: string, slot: TimeSlot) => void
  onApproveAll: () => void
  onRejectAll: () => void
  isProcessing?: boolean
}

/**
 * Panel for approving scheduled tasks in batch
 * Used in the approval screen for reviewing proposed schedules
 *
 * Layout:
 * - Header with Approve All / Reject All actions
 * - Scrollable list of proposed task schedules
 * - Each item shows task + proposed time + actions
 */
export function ScheduleApprovalPanel({
  proposal,
  approvals,
  onApprovalChange,
  onSlotChange,
  onApproveAll,
  onRejectAll,
  isProcessing = false,
}: ScheduleApprovalPanelProps) {
  const { items, summary } = proposal

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

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

  const getApprovalState = (taskId: string): ApprovalState => {
    return approvals.get(taskId) || 'pending'
  }

  const getStateColor = (state: ApprovalState): string => {
    switch (state) {
      case 'approved':
        return 'border-green-500/50 bg-green-500/5'
      case 'rejected':
        return 'border-destructive/50 bg-destructive/5 opacity-60'
      case 'modified':
        return 'border-amber-500/50 bg-amber-500/5'
      default:
        return ''
    }
  }

  const approvedCount = Array.from(approvals.values()).filter(
    (s) => s === 'approved' || s === 'modified'
  ).length
  const rejectedCount = Array.from(approvals.values()).filter(
    (s) => s === 'rejected'
  ).length

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Proposed Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRejectAll}
              disabled={isProcessing}
            >
              <X className="mr-1.5 h-4 w-4" />
              Reject All
            </Button>
            <Button
              size="sm"
              onClick={onApproveAll}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Approve All
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span>
            {summary.scheduled} of {summary.totalTasks} scheduled
          </span>
          {summary.conflicts > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {summary.conflicts} conflict{summary.conflicts > 1 ? 's' : ''}
            </span>
          )}
          {summary.unschedulable > 0 && (
            <span className="text-destructive">
              {summary.unschedulable} could not be scheduled
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="divide-y">
            {items.map((item) => {
              const state = getApprovalState(item.task.id)
              const hasSlot = item.proposedSlot !== null
              const hasAlternatives = item.suggestions.length > 1

              return (
                <div
                  key={item.task.id}
                  className={cn(
                    'p-4 transition-colors',
                    getStateColor(state)
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <Checkbox
                      checked={state === 'approved' || state === 'modified'}
                      onCheckedChange={(checked) => {
                        onApprovalChange(
                          item.task.id,
                          checked ? 'approved' : 'rejected'
                        )
                      }}
                      className="mt-0.5"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Task name */}
                      <p
                        className={cn(
                          'font-medium text-sm',
                          state === 'rejected' && 'line-through text-muted-foreground'
                        )}
                      >
                        {item.task.content}
                      </p>

                      {/* Proposed time or error */}
                      {hasSlot && item.proposedSlot ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {formatDate(item.proposedSlot.start)}{' '}
                            {formatTime(item.proposedSlot.start)} -{' '}
                            {formatTime(item.proposedSlot.end)}
                          </Badge>

                          {/* Alternative times dropdown */}
                          {hasAlternatives && onSlotChange && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                >
                                  Change time
                                  <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {item.suggestions.map((suggestion, idx) => (
                                  <DropdownMenuItem
                                    key={idx}
                                    onClick={() => {
                                      onSlotChange(item.task.id, suggestion.slot)
                                      onApprovalChange(item.task.id, 'modified')
                                    }}
                                  >
                                    <div className="flex items-center justify-between w-full gap-4">
                                      <span>
                                        {formatDate(suggestion.slot.start)}{' '}
                                        {formatTime(suggestion.slot.start)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        Score: {suggestion.score}
                                      </span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {/* Modified indicator */}
                          {state === 'modified' && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            >
                              Modified
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            {item.error || 'No suitable time found'}
                          </span>
                        </div>
                      )}

                      {/* Task metadata */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.task.timeEstimate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeEstimate(item.task.timeEstimate)}
                          </span>
                        )}
                        {item.task.project && (
                          <Badge variant="outline" className="h-4 px-1.5 text-xs">
                            {item.task.project}
                          </Badge>
                        )}
                        {item.task.priority && (
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              item.task.priority === 'high'
                                ? 'bg-red-500'
                                : item.task.priority === 'medium'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            )}
                            title={`${item.task.priority} priority`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {state !== 'approved' && hasSlot && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                          onClick={() => onApprovalChange(item.task.id, 'approved')}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {state !== 'rejected' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onApprovalChange(item.task.id, 'rejected')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Footer with approval count */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {approvedCount} approved, {rejectedCount} rejected
          </span>
          <span className="text-muted-foreground">
            {items.length - approvedCount - rejectedCount} pending
          </span>
        </div>
      </div>
    </Card>
  )
}
