import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  ArrowRight,
  XCircle,
  MoveRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conflict } from '@/types'

interface Displacement {
  taskId: string
  taskName: string
  originalStart: Date
  originalEnd: Date
  newStart?: Date
  newEnd?: Date
  action: 'move' | 'unschedule'
  reason: string
}

interface ConflictWarningProps {
  conflicts: Conflict[]
  displacements: Displacement[]
  onApproveDisplacements: () => void
  onReject: () => void
}

/**
 * Show conflicts and displacement options
 *
 * Layout:
 * - Warning header explaining the conflict
 * - List of tasks that will be affected
 * - Shows what will happen to each task (moved or unscheduled)
 * - Approve/Reject buttons
 */
export function ConflictWarning({
  conflicts,
  displacements,
  onApproveDisplacements,
  onReject,
}: ConflictWarningProps) {
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

  const movedTasks = displacements.filter((d) => d.action === 'move')
  const unscheduledTasks = displacements.filter((d) => d.action === 'unschedule')

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Scheduling Conflicts
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p>
                Scheduling this task will affect other tasks on your calendar.
                Please review the changes below.
              </p>

              {/* Conflicts list */}
              {conflicts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Issues:</h4>
                  <div className="space-y-1.5">
                    {conflicts.map((conflict, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-md border text-sm',
                          conflict.severity === 'error'
                            ? 'bg-destructive/10 border-destructive/20'
                            : conflict.severity === 'warning'
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-blue-500/10 border-blue-500/20'
                        )}
                      >
                        {conflict.severity === 'error' ? (
                          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <span>{conflict.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Displacements */}
              {displacements.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">
                    This will affect {displacements.length} other task
                    {displacements.length > 1 ? 's' : ''}:
                  </h4>

                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {/* Tasks that will be moved */}
                      {movedTasks.map((displacement) => (
                        <div
                          key={displacement.taskId}
                          className="p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-start gap-2">
                            <MoveRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-medium text-sm text-foreground truncate">
                                {displacement.taskName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  {formatDate(displacement.originalStart)}{' '}
                                  {formatTime(displacement.originalStart)}
                                </span>
                                <ArrowRight className="h-3 w-3" />
                                {displacement.newStart ? (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {formatDate(displacement.newStart)}{' '}
                                    {formatTime(displacement.newStart)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Finding new time...
                                  </span>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {displacement.reason}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Tasks that will be unscheduled */}
                      {unscheduledTasks.map((displacement) => (
                        <div
                          key={displacement.taskId}
                          className="p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-medium text-sm text-foreground truncate">
                                {displacement.taskName}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground line-through">
                                  {formatDate(displacement.originalStart)}{' '}
                                  {formatTime(displacement.originalStart)}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-destructive">
                                  Will be unscheduled
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {displacement.reason}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Keep Existing</AlertDialogCancel>
          <AlertDialogAction
            onClick={onApproveDisplacements}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Move Lower Priority
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
