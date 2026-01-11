import { useState } from 'react'
import { useTasks } from '@/context/TaskContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Check,
  MoreVertical,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  Archive,
  Flag,
  Pencil,
} from 'lucide-react'
import { cn, formatDate, formatTimeEstimate } from '@/lib/utils'
import type { Task, Priority } from '@/types'
import { EditTaskDialog } from './EditTaskDialog'

interface TaskCardProps {
  task: Task
  showProject?: boolean
  inTimeline?: boolean
}

export function TaskCard({ task, showProject = true, inTimeline = false }: TaskCardProps) {
  const { updateTask, deleteTask, projects } = useTasks()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const project = projects.find((p) => p.name === task.project)

  const handleToggleComplete = () => {
    updateTask(task.id, { completed: !task.completed })
  }

  const handleSchedule = (date: Date | undefined) => {
    updateTask(task.id, { scheduledDate: date })
    setIsCalendarOpen(false)
  }

  const handlePriorityChange = (priority: Priority) => {
    updateTask(task.id, { priority })
  }

  const handleArchive = () => {
    updateTask(task.id, { archived: true })
  }

  const handleDelete = () => {
    deleteTask(task.id)
    setIsDeleteDialogOpen(false)
  }

  return (
    <Card
      className={cn(
        'group relative p-4 transition-all hover:shadow-md',
        task.completed && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={handleToggleComplete}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            task.completed
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/50 hover:border-primary'
          )}
        >
          {task.completed && <Check className="h-3 w-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm font-medium flex-1',
                task.completed && 'line-through text-muted-foreground'
              )}
            >
              {task.content}
            </p>
            {inTimeline && task.timeEstimate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {formatTimeEstimate(task.timeEstimate)}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {showProject && task.project && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: project?.color,
                  color: project?.color,
                }}
              >
                {task.project}
              </Badge>
            )}

            <Badge variant={task.priority} className="text-xs capitalize">
              {task.priority}
            </Badge>

            {!inTimeline && task.scheduledDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                {formatDate(task.scheduledDate)}
                {task.scheduledTime && ` at ${task.scheduledTime}`}
              </span>
            )}

            {!inTimeline && task.timeEstimate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimeEstimate(task.timeEstimate)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={task.scheduledDate}
                onSelect={handleSchedule}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePriorityChange('high')}>
                <Flag className="mr-2 h-4 w-4 text-red-500" />
                High Priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePriorityChange('medium')}>
                <Flag className="mr-2 h-4 w-4 text-yellow-500" />
                Medium Priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePriorityChange('low')}>
                <Flag className="mr-2 h-4 w-4 text-green-500" />
                Low Priority
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <EditTaskDialog
        task={task}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.content}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
