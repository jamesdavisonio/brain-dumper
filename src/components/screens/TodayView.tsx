import { useMemo } from 'react'
import { useTasks } from '@/context/TaskContext'
import { SwipeableTaskCard } from '@/components/tasks/SwipeableTaskCard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format, isToday, startOfDay } from 'date-fns'
import { CalendarDays, Sunrise, Sun, Moon, Clock, CheckCircle2 } from 'lucide-react'
import type { Task } from '@/types'

function formatTimeEstimate(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}

function getTotalTimeEstimate(tasks: Task[]): number {
  return tasks.reduce((total, task) => total + (task.timeEstimate || 0), 0)
}

export function TodayView() {
  const { tasks, loading } = useTasks()

  // Filter for today's tasks only (not completed, not archived)
  const todayTasks = useMemo(() => {
    return tasks.filter(
      (t) => !t.archived && !t.completed && t.scheduledDate && isToday(t.scheduledDate)
    )
  }, [tasks])

  // Count completed tasks for today
  const completedTodayCount = useMemo(() => {
    return tasks.filter(
      (t) => !t.archived && t.completed && t.scheduledDate && isToday(t.scheduledDate)
    ).length
  }, [tasks])

  // Group by time of day
  const groupedTasks = useMemo(() => ({
    unscheduled: todayTasks.filter(
      (t) => !t.scheduledTime || !['morning', 'afternoon', 'evening'].includes(t.scheduledTime.toLowerCase())
    ),
    morning: todayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'morning'),
    afternoon: todayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'afternoon'),
    evening: todayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'evening'),
  }), [todayTasks])

  const totalTime = getTotalTimeEstimate(todayTasks)
  const today = startOfDay(new Date())

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Today</h1>
        </div>
        <p className="text-muted-foreground">{format(today, 'EEEE, MMMM d, yyyy')}</p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-4 mt-4">
          {totalTime > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              <Clock className="h-4 w-4" />
              {formatTimeEstimate(totalTime)} remaining
            </div>
          )}
          {completedTodayCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-4 w-4" />
              {completedTodayCount} completed
            </div>
          )}
        </div>
      </div>

      {/* Tasks Card */}
      <Card>
        <CardContent className="pt-6">
          {todayTasks.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks for today</h3>
              <p className="text-sm text-muted-foreground">
                Add tasks or schedule existing ones for today
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Unscheduled Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Unscheduled
                  </div>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                  {groupedTasks.unscheduled.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {groupedTasks.unscheduled.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {groupedTasks.unscheduled.length > 0 ? (
                    groupedTasks.unscheduled.map((task) => (
                      <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic text-center py-2">
                      No tasks
                    </p>
                  )}
                </div>
              </div>

              {/* Morning Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sunrise className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                    Morning
                  </div>
                  <div className="flex-1 h-px bg-amber-200 dark:bg-amber-900/30"></div>
                  {groupedTasks.morning.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {groupedTasks.morning.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {groupedTasks.morning.length > 0 ? (
                    groupedTasks.morning.map((task) => (
                      <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic text-center py-2">
                      No tasks
                    </p>
                  )}
                </div>
              </div>

              {/* Afternoon Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                  <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                    Afternoon
                  </div>
                  <div className="flex-1 h-px bg-orange-200 dark:bg-orange-900/30"></div>
                  {groupedTasks.afternoon.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {groupedTasks.afternoon.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {groupedTasks.afternoon.length > 0 ? (
                    groupedTasks.afternoon.map((task) => (
                      <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic text-center py-2">
                      No tasks
                    </p>
                  )}
                </div>
              </div>

              {/* Evening Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                    Evening
                  </div>
                  <div className="flex-1 h-px bg-indigo-200 dark:bg-indigo-900/30"></div>
                  {groupedTasks.evening.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {groupedTasks.evening.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {groupedTasks.evening.length > 0 ? (
                    groupedTasks.evening.map((task) => (
                      <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic text-center py-2">
                      No tasks
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
