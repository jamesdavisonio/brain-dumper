import { useMemo } from 'react'
import { useTasks } from '@/context/TaskContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw, Trash2, Calendar, Archive } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function ArchiveView() {
  const { tasks, updateTask, deleteTask, loading } = useTasks()

  const archivedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.archived)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
  }, [tasks])

  const handleRestore = (taskId: string) => {
    updateTask(taskId, { archived: false, completed: false })
  }

  const handleDelete = (taskId: string) => {
    deleteTask(taskId)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Archive</h1>
        </div>
        <Badge variant="secondary">{archivedTasks.length} tasks</Badge>
      </div>

      {archivedTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No archived tasks.</p>
            <p className="text-sm mt-1">
              Completed tasks can be archived from the task list.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {archivedTasks.map((task) => (
            <Card key={task.id} className="group">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground line-through">
                      {task.content}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {task.project && (
                        <Badge variant="outline" className="text-xs">
                          {task.project}
                        </Badge>
                      )}

                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Archived {formatDate(task.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(task.id)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(task.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
