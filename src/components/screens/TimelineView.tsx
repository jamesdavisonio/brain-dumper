import { useMemo, useState } from 'react'
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
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
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

export function TimelineView() {
  const { tasks, updateTask, loading } = useTasks()
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Disable drag-and-drop on mobile (touch devices)
  const isMobile = 'ontouchstart' in window

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
    const grouped: Record<string, { morning: Task[]; afternoon: Task[]; evening: Task[]; unspecified: Task[] }> = {}
    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayTasks = tasks.filter(
        (t) =>
          !t.archived &&
          !t.completed &&
          t.scheduledDate &&
          isSameDay(t.scheduledDate, day)
      )

      // Group tasks by time of day
      grouped[dateKey] = {
        morning: dayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'morning'),
        afternoon: dayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'afternoon'),
        evening: dayTasks.filter((t) => t.scheduledTime?.toLowerCase() === 'evening'),
        unspecified: dayTasks.filter((t) => !t.scheduledTime || !['morning', 'afternoon', 'evening'].includes(t.scheduledTime.toLowerCase())),
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
      <div className="flex items-center justify-between py-2">
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
                    isMobile ? (
                      <SwipeableTaskCard key={task.id} task={task} />
                    ) : (
                      <SortableSwipeableTaskCard key={task.id} task={task} />
                    )
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
            const dayTasksGrouped = scheduledByDay[dateKey] || { morning: [], afternoon: [], evening: [], unspecified: [] }
            const allDayTasks = [...dayTasksGrouped.morning, ...dayTasksGrouped.afternoon, ...dayTasksGrouped.evening, ...dayTasksGrouped.unspecified]
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
                    items={allDayTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4 min-h-[400px]">
                      {/* Morning Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            Morning
                          </div>
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-900/30"></div>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {dayTasksGrouped.morning.length > 0 ? (
                            dayTasksGrouped.morning.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-4">
                              No tasks scheduled
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Afternoon Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                            Afternoon
                          </div>
                          <div className="flex-1 h-px bg-orange-200 dark:bg-orange-900/30"></div>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {dayTasksGrouped.afternoon.length > 0 ? (
                            dayTasksGrouped.afternoon.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-4">
                              No tasks scheduled
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Evening Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                            Evening
                          </div>
                          <div className="flex-1 h-px bg-indigo-200 dark:bg-indigo-900/30"></div>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {dayTasksGrouped.evening.length > 0 ? (
                            dayTasksGrouped.evening.map((task) => (
                              isMobile ? (
                                <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              ) : (
                                <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                              )
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground/50 italic text-center py-4">
                              No tasks scheduled
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Unspecified time tasks */}
                      {dayTasksGrouped.unspecified.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-dashed border-muted">
                          {dayTasksGrouped.unspecified.map((task) => (
                            isMobile ? (
                              <SwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                            ) : (
                              <SortableSwipeableTaskCard key={task.id} task={task} inTimeline={true} />
                            )
                          ))}
                        </div>
                      )}
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
