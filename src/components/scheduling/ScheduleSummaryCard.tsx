import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Calendar,
  Check,
  AlertTriangle,
  XCircle,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduleSummary {
  totalTasks: number
  scheduled: number
  conflicts: number
  displacements: number
  unschedulable: number
}

interface ScheduleSummaryCardProps {
  summary: ScheduleSummary
  className?: string
}

/**
 * Summary of scheduling proposal
 *
 * Shows overview stats with icons:
 * - Total tasks to schedule
 * - Successfully scheduled count
 * - Conflicts detected
 * - Displacements required
 * - Tasks that couldn't be scheduled
 */
export function ScheduleSummaryCard({
  summary,
  className,
}: ScheduleSummaryCardProps) {
  const {
    totalTasks,
    scheduled,
    conflicts,
    displacements,
    unschedulable,
  } = summary

  const successRate = totalTasks > 0 ? (scheduled / totalTasks) * 100 : 0
  const hasIssues = conflicts > 0 || unschedulable > 0

  const getStatusColor = (): string => {
    if (unschedulable > 0) return 'text-destructive'
    if (conflicts > 0) return 'text-amber-600 dark:text-amber-400'
    return 'text-green-600 dark:text-green-400'
  }

  const getStatusMessage = (): string => {
    if (totalTasks === 0) return 'No tasks to schedule'
    if (unschedulable === totalTasks) return 'Could not schedule any tasks'
    if (scheduled === totalTasks && conflicts === 0) return 'All tasks scheduled successfully'
    if (conflicts > 0) return 'Schedule ready with some conflicts'
    return `${scheduled} of ${totalTasks} tasks scheduled`
  }

  const stats = [
    {
      label: 'Scheduled',
      value: scheduled,
      icon: Check,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Conflicts',
      value: conflicts,
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      hide: conflicts === 0,
    },
    {
      label: 'Displacements',
      value: displacements,
      icon: ArrowRightLeft,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      hide: displacements === 0,
    },
    {
      label: 'Unschedulable',
      value: unschedulable,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      hide: unschedulable === 0,
    },
  ].filter((stat) => !stat.hide)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Schedule Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status message */}
        <div className={cn('text-sm font-medium', getStatusColor())}>
          {getStatusMessage()}
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(successRate)}%</span>
            </div>
            <Progress value={successRate} max={100} className="h-2" />
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg',
                  stat.bgColor
                )}
              >
                <Icon className={cn('h-4 w-4', stat.color)} />
                <div>
                  <div className={cn('text-lg font-semibold', stat.color)}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total tasks */}
        <div className="flex items-center justify-between pt-2 border-t text-sm">
          <span className="text-muted-foreground">Total tasks</span>
          <span className="font-medium">{totalTasks}</span>
        </div>

        {/* Warning for issues */}
        {hasIssues && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {conflicts > 0 && unschedulable > 0
                ? `${conflicts} conflict${conflicts > 1 ? 's' : ''} and ${unschedulable} task${unschedulable > 1 ? 's' : ''} need attention`
                : conflicts > 0
                ? `${conflicts} scheduling conflict${conflicts > 1 ? 's' : ''} detected`
                : `${unschedulable} task${unschedulable > 1 ? 's' : ''} could not be scheduled`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
