import { useMemo, useState } from 'react'
import { useTasks } from '@/context/TaskContext'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import type { Task } from '@/types'

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <TaskCard task={task} />
        </div>
      </div>
    </div>
  )
}

export function TimelineView() {
  const { tasks, updateTask, loading } = useTasks()
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  // Start from today (or today + offset weeks)
  const startDate = useMemo(() => {
    const today = startOfDay(new Date())
    return addDays(today, weekOffset * 7)
  }, [weekOffset])

  // Show 7 days starting from the start date
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
  }, [startDate])

  const unscheduledTasks = useMemo(() => {
    return tasks.filter((t) => !t.archived && !t.completed && !t.scheduledDate)
  }, [tasks])

  const scheduledByDay = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd')
      grouped[dateKey] = tasks.filter(
        (t) =>
          !t.archived &&
          !t.completed &&
          t.scheduledDate &&
          isSameDay(t.scheduledDate, day)
      )
    })
    return grouped
  }, [tasks, weekDays])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    // Check if dropped on a day column
    if (overId.startsWith('day-')) {
      const dateStr = overId.replace('day-', '')
      const date = new Date(dateStr)
      updateTask(taskId, { scheduledDate: date })
    } else if (overId === 'unscheduled') {
      updateTask(taskId, { scheduledDate: undefined })
    }
  }

  // Format the date range for the header
  const getHeaderText = () => {
    const today = startOfDay(new Date())
    if (weekOffset === 0) {
      return 'This Week'
    } else if (weekOffset === 1) {
      return 'Next Week'
    } else if (weekOffset === -1) {
      return 'Last Week'
    }
    const endDate = addDays(startDate, 6)
    if (isSameDay(startDate, today)) {
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
    }
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{getHeaderText()}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((prev) => prev - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setWeekOffset(0)}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((prev) => prev + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-4">
          {/* Unscheduled column */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Unscheduled</CardTitle>
            </CardHeader>
            <CardContent>
              <SortableContext
                id="unscheduled"
                items={unscheduledTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {unscheduledTasks.map((task) => (
                    <SortableTaskCard key={task.id} task={task} />
                  ))}
                  {unscheduledTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No unscheduled tasks
                    </p>
                  )}
                </div>
              </SortableContext>
            </CardContent>
          </Card>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayTasks = scheduledByDay[dateKey] || []
            const isToday = isSameDay(day, new Date())

            return (
              <Card
                key={dateKey}
                className={isToday ? 'border-primary' : ''}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    <span className={isToday ? 'text-primary font-bold' : ''}>
                      {format(day, 'EEE')}
                      {isToday && ' (Today)'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {format(day, 'MMM d')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext
                    id={`day-${dateKey}`}
                    items={dayTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 min-h-[100px]">
                      {dayTasks.map((task) => (
                        <SortableTaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="opacity-80">
              <TaskCard task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
