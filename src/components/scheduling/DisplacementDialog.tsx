import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  MoveRight,
  XCircle,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Displacement {
  taskId: string
  taskName: string
  taskPriority: 'high' | 'medium' | 'low'
  originalStart: Date
  originalEnd: Date
  newStart?: Date
  newEnd?: Date
  action: 'move' | 'unschedule'
  reason: string
}

interface DisplacementDialogProps {
  displacements: Displacement[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: () => void
  onReject: () => void
  triggerTaskName?: string
}

/**
 * Dialog for approving task displacements
 *
 * Shows list of tasks that will be moved/unscheduled when a higher priority
 * task is scheduled. Explains why each displacement is happening and requires
 * explicit user approval.
 */
export function DisplacementDialog({
  displacements,
  open,
  onOpenChange,
  onApprove,
  onReject,
  triggerTaskName,
}: DisplacementDialogProps) {
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

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-red-500/10 text-red-500',
      medium: 'bg-yellow-500/10 text-yellow-500',
      low: 'bg-green-500/10 text-green-500',
    }
    return (
      <Badge className={cn('text-xs capitalize', colors[priority])}>
        {priority}
      </Badge>
    )
  }

  const movedTasks = displacements.filter((d) => d.action === 'move')
  const unscheduledTasks = displacements.filter((d) => d.action === 'unschedule')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Task Displacement Required
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                {triggerTaskName ? (
                  <>
                    Scheduling <strong>"{triggerTaskName}"</strong> requires moving{' '}
                    {displacements.length} other task
                    {displacements.length > 1 ? 's' : ''}.
                  </>
                ) : (
                  <>
                    This action will affect {displacements.length} other task
                    {displacements.length > 1 ? 's' : ''} on your calendar.
                  </>
                )}
              </p>

              {/* Explanation of priority-based displacement */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-blue-700 dark:text-blue-300">
                  Higher priority tasks can displace lower priority ones when there
                  are scheduling conflicts. The affected tasks will be rescheduled
                  to the next available slot.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] mt-4">
          <div className="space-y-3 pr-4">
            {/* Tasks being moved */}
            {movedTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MoveRight className="h-4 w-4 text-amber-500" />
                  Will be moved ({movedTasks.length})
                </h4>
                <div className="space-y-2">
                  {movedTasks.map((displacement) => (
                    <div
                      key={displacement.taskId}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">
                          {displacement.taskName}
                        </p>
                        {getPriorityBadge(displacement.taskPriority)}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDate(displacement.originalStart)}{' '}
                            {formatTime(displacement.originalStart)}
                          </span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Calendar className="h-3 w-3" />
                          {displacement.newStart ? (
                            <span>
                              {formatDate(displacement.newStart)}{' '}
                              {formatTime(displacement.newStart)}
                            </span>
                          ) : (
                            <span>Next available slot</span>
                          )}
                        </div>
                      </div>

                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {displacement.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks being unscheduled */}
            {unscheduledTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Will be unscheduled ({unscheduledTasks.length})
                </h4>
                <div className="space-y-2">
                  {unscheduledTasks.map((displacement) => (
                    <div
                      key={displacement.taskId}
                      className="p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">
                          {displacement.taskName}
                        </p>
                        {getPriorityBadge(displacement.taskPriority)}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground line-through">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDate(displacement.originalStart)}{' '}
                            {formatTime(displacement.originalStart)}
                          </span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-destructive">Removed from calendar</span>
                      </div>

                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {displacement.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onReject}>
            Cancel
          </Button>
          <Button
            onClick={onApprove}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Confirm Displacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
