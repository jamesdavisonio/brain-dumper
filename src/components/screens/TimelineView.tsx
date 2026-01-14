import { useMemo, useState, useEffect, useRef } from 'react'
import { useTasks } from '@/context/TaskContext'
import { SwipeableTaskCard } from '@/components/tasks/SwipeableTaskCard'
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
import { ChevronLeft, ChevronRight, GripVertical, Sunrise, Sun, Moon, Clock } from 'lucide-react'
import type { Task } from '@/types'

function SortableSwipeableTaskCard({ task, inTimeline = false }: { task: Task; inTimeline?: boolean }) {
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
          <SwipeableTaskCard task={task} inTimeline={inTimeline} />
        </div>
      </div>
    </div>
  )
}

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

export function TimelineView() {
  const { tasks, updateTask, loading } = useTasks()
  const [dayOffset, setDayOffset] = useState(0)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const hasAssignedDates = useRef(false)

  // Disable drag-and-drop on mobile (touch devices)
  const isMobile = 'ontouchstart' in window

  // Desktop shows 3 days, mobile shows 1 day at a time
  const daysToShow = isMobile ? 1 : 3

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Auto-assign today's date to tasks without a scheduled date (only once on load)
  useEffect(() => {
    if (loading || hasAssignedDates.current) return

    const today = startOfDay(new Date())
    const unscheduledTasks = tasks.filter(
      (t) => !t.archived && !t.completed && !t.scheduledDate
    )

    if (unscheduledTasks.length > 0) {
      hasAssignedDates.current = true
      // Assign today's date to unscheduled tasks
      unscheduledTasks.forEach((task) => {
        updateTask(task.id, { scheduledDate: today })
      })
    }
  }, [tasks, updateTask, loading])

  // Start from today (or today + offset days)
  const startDate = useMemo(() => {
    const today = startOfDay(new Date())
    return addDays(today, dayOffset * daysToShow)
  }, [dayOffset, daysToShow])

  // Show days starting from the start date, sorted by nearest date
  const weekDays = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i))
  }, [startDate, daysToShow])

  const scheduledByDay = useMemo(() => {
    const grouped: Record<string, { unscheduled: Task[]; morning: Task[]; afternoon: Task[]; evening: Task[] }> = {}
    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayTasks = tasks.filter(
        (t) =>
          !t.archived &&
          !t.completed &&
          t.scheduledDate &&
          isSameDay(t.scheduledDate, day)
      )

      // Group tasks by time of day - unscheduled (no time) first, then morning, afternoon, evening
      grouped[dateKey] = {
        unscheduled: dayTasks.filter((t) => !t.scheduledTime || !['morning', 'afternoon', 'evening'].includes(t.scheduledTime.toLowerCase())),
        morning: dayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'morning'),
        afternoon: dayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'afternoon'),
        evening: dayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'evening'),
      }
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
    }
  }

  // Format the date range for the header
  const getHeaderText = () => {
    const today = startOfDay(new Date())
    if (dayOffset === 0) {
      if (daysToShow === 1) {
        return 'Today'
      }
      return 'Next 3 Days'
    }
    const endDate = addDays(startDate, daysToShow - 1)
    if (daysToShow === 1) {
      return format(startDate, 'EEEE, MMMM d')
    }
    if (isSameDay(startDate, today)) {
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
    }
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-xl font-semibold">{getHeaderText()}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDayOffset((prev) => prev - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setDayOffset(0)}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDayOffset((prev) => prev + 1)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Day columns */}
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayTasksGrouped = scheduledByDay[dateKey] || { unscheduled: [], morning: [], afternoon: [], evening: [] }
            const allDayTasks = [...dayTasksGrouped.unscheduled, ...dayTasksGrouped.morning, ...dayTasksGrouped.afternoon, ...dayTasksGrouped.evening]
            const isToday = isSameDay(day, new Date())
            const totalTime = getTotalTimeEstimate(allDayTasks)

            return (
              <Card
                key={dateKey}
                className={isToday ? 'border-primary' : ''}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={isToday ? 'text-primary font-bold' : ''}>
                          {format(day, 'EEEE')}
                          {isToday && ' (Today)'}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {format(day, 'MMMM d')}
                        </span>
                      </div>
                      {totalTime > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          <Clock className="h-3 w-3" />
                          {formatTimeEstimate(totalTime)}
                        </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext
                    id={`day-${dateKey}`}
                    items={allDayTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4 min-h-[400px]">
                      {/* Unscheduled Section (no time assigned) */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            Unscheduled
                          </div>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div className="space-y-2 min-h-[40px]">
                          {dayTasksGrouped.unscheduled.length > 0 ? (
                            dayTasksGrouped.unscheduled.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-2">
                              No tasks
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Morning Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Sunrise className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            Morning
                          </div>
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-900/30"></div>
                        </div>
                        <div className="space-y-2 min-h-[40px]">
                          {dayTasksGrouped.morning.length > 0 ? (
                            dayTasksGrouped.morning.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-2">
                              No tasks
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Afternoon Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Sun className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                            Afternoon
                          </div>
                          <div className="flex-1 h-px bg-orange-200 dark:bg-orange-900/30"></div>
                        </div>
                        <div className="space-y-2 min-h-[40px]">
                          {dayTasksGrouped.afternoon.length > 0 ? (
                            dayTasksGrouped.afternoon.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-2">
                              No tasks
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Evening Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Moon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                            Evening
                          </div>
                          <div className="flex-1 h-px bg-indigo-200 dark:bg-indigo-900/30"></div>
                        </div>
                        <div className="space-y-2 min-h-[40px]">
                          {dayTasksGrouped.evening.length > 0 ? (
                            dayTasksGrouped.evening.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-2">
                              No tasks
                            </div>
                          )}
                        </div>
                      </div>
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
              <SwipeableTaskCard task={activeTask} inTimeline={true} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
