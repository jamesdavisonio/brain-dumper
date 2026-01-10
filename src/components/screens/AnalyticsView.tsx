import { useMemo } from 'react'
import { useTasks } from '@/context/TaskContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  Folder,
  Tag,
  AlertCircle,
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from 'date-fns'
import type { TaskStats, WeeklyStats, Priority } from '@/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const CATEGORY_COLORS: Record<string, string> = {
  Work: 'bg-blue-500',
  Personal: 'bg-purple-500',
  Health: 'bg-green-500',
  Finance: 'bg-yellow-500',
  Shopping: 'bg-pink-500',
  Home: 'bg-orange-500',
  Learning: 'bg-cyan-500',
  Social: 'bg-indigo-500',
  Travel: 'bg-teal-500',
  Admin: 'bg-gray-500',
}

export function AnalyticsView() {
  const { tasks, projects, loading } = useTasks()

  const stats = useMemo<TaskStats>(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.completed).length
    const archivedTasks = tasks.filter((t) => t.archived).length

    const tasksByProject: Record<string, number> = {}
    const tasksByPriority: Record<Priority, number> = { high: 0, medium: 0, low: 0 }
    const tasksByCategory: Record<string, number> = {}

    tasks.forEach((task) => {
      // By project
      const projectName = task.project || 'No Project'
      tasksByProject[projectName] = (tasksByProject[projectName] || 0) + 1

      // By priority
      tasksByPriority[task.priority] = (tasksByPriority[task.priority] || 0) + 1

      // By category
      if (task.category) {
        tasksByCategory[task.category] = (tasksByCategory[task.category] || 0) + 1
      }
    })

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    return {
      totalTasks,
      completedTasks,
      archivedTasks,
      tasksByProject,
      tasksByPriority,
      tasksByCategory,
      completionRate,
    }
  }, [tasks])

  const weeklyStats = useMemo<WeeklyStats[]>(() => {
    const weeks: WeeklyStats[] = []
    const now = new Date()

    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 })

      const completed = tasks.filter(
        (t) =>
          t.completed &&
          t.updatedAt &&
          isWithinInterval(t.updatedAt, { start: weekStart, end: weekEnd })
      ).length

      const created = tasks.filter(
        (t) =>
          t.createdAt &&
          isWithinInterval(t.createdAt, { start: weekStart, end: weekEnd })
      ).length

      weeks.push({
        week: format(weekStart, 'MMM d'),
        completed,
        created,
      })
    }

    return weeks
  }, [tasks])

  const activeTasks = tasks.filter((t) => !t.completed && !t.archived)
  const overdueTasks = activeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date()
  )
  const upcomingTasks = activeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= new Date()
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-xl font-semibold">Analytics</h1>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {activeTasks.length} active, {stats.archivedTasks} archived
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <Progress value={stats.completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{overdueTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              {upcomingTasks.length} tasks with upcoming due dates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(stats.tasksByProject).length - (stats.tasksByProject['No Project'] ? 1 : 0)} with tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Weekly Activity
            </CardTitle>
            <CardDescription>Tasks created and completed per week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyStats.map((week) => (
                <div key={week.week} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{week.week}</span>
                    <span className="text-muted-foreground">
                      {week.created} created / {week.completed} done
                    </span>
                  </div>
                  <div className="flex gap-1 h-4">
                    <div
                      className="bg-blue-500 rounded"
                      style={{ width: `${Math.min((week.created / 10) * 100, 100)}%` }}
                      title={`${week.created} created`}
                    />
                    <div
                      className="bg-green-500 rounded"
                      style={{ width: `${Math.min((week.completed / 10) * 100, 100)}%` }}
                      title={`${week.completed} completed`}
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded" /> Created
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" /> Completed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Priority Distribution
            </CardTitle>
            <CardDescription>Tasks by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['high', 'medium', 'low'] as Priority[]).map((priority) => {
                const count = stats.tasksByPriority[priority]
                const percentage = stats.totalTasks > 0 ? (count / stats.totalTasks) * 100 : 0
                return (
                  <div key={priority} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{priority}</span>
                      <span className="text-muted-foreground">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full ${PRIORITY_COLORS[priority]} rounded`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Project */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Tasks by Project
            </CardTitle>
            <CardDescription>Distribution across projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.tasksByProject)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([project, count]) => {
                  const percentage = stats.totalTasks > 0 ? (count / stats.totalTasks) * 100 : 0
                  const projectData = projects.find((p) => p.name === project)
                  return (
                    <div key={project} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate flex-1">{project}</span>
                        <span className="text-muted-foreground ml-2">{count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: projectData?.color || '#6366f1',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tasks by Category
            </CardTitle>
            <CardDescription>Auto-categorized task distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.tasksByCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No categorized tasks yet. Categories will appear after your next brain dump.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.tasksByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => {
                    const percentage = stats.totalTasks > 0 ? (count / stats.totalTasks) * 100 : 0
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{category}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div
                            className={`h-full ${CATEGORY_COLORS[category] || 'bg-gray-500'} rounded`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
