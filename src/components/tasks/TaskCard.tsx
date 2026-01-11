import { useState } from 'react'
import { useTasks } from '@/context/TaskContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { cn, formatDate, formatTimeEstimate, formatTimeOfDay } from '@/lib/utils'
import type { Task, Priority } from '@/types'
import { EditTaskDialog } from './EditTaskDialog'
import { ProjectIcon } from '@/components/ui/project-icon'

interface TaskCardProps {
  task: Task
  showProject?: boolean
  inTimeline?: boolean
  projectBorder?: boolean
}

export function TaskCard({ task, showProject = true, inTimeline = false, projectBorder = false }: TaskCardProps) {
  const { updateTask, deleteTask, projects } = useTasks()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const project = projects.find((p) => p.name === task.project)

  const handleToggleComplete = () => {
    updateTask(task.id, { completed: !task.completed })
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

  // Determine which date to show (prefer scheduledDate for timeline, dueDate otherwise)
  const displayDate = inTimeline ? task.scheduledDate : (task.scheduledDate || task.dueDate)
  const displayTime = inTimeline ? task.scheduledTime : (task.scheduledTime || task.dueTime)

  // Get abbreviated priority
  const priorityShort = task.priority === 'high' ? 'H' : task.priority === 'medium' ? 'M' : 'L'

  return (
    <Card
      className={cn(
        'group relative p-3 transition-all hover:shadow-md cursor-pointer',
        task.completed && 'opacity-60',
        projectBorder && project && 'border-l-4'
      )}
      style={projectBorder && project ? { borderLeftColor: project.color } : undefined}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleComplete()
          }}
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            task.completed
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/50 hover:border-primary'
          )}
        >
          {task.completed && <Check className="h-2.5 w-2.5" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title row with time estimate */}
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm font-medium flex-1 line-clamp-2',
                task.completed && 'line-through text-muted-foreground'
              )}
            >
              {task.content}
            </p>
            {task.timeEstimate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {formatTimeEstimate(task.timeEstimate)}
              </span>
            )}
          </div>

          {/* Metadata row - compact single line */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {showProject && task.project && (
              <Badge
                variant="outline"
                className="text-xs flex items-center gap-1 px-1.5 py-0 h-5"
                style={{
                  borderColor: project?.color,
                  color: project?.color,
                }}
              >
                {project?.icon && <ProjectIcon icon={project.icon} color={project.color} className="h-3 w-3" />}
                {task.project}
              </Badge>
            )}

            <Badge variant={task.priority} className="text-xs px-1.5 py-0 h-5">
              {priorityShort}
            </Badge>

            {displayDate && (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                <span>{formatDate(displayDate)}</span>
                {formatTimeOfDay(displayTime) && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4 ml-0.5">
                    {formatTimeOfDay(displayTime)}
                  </Badge>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Dropdown menu for additional actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePriorityChange('high') }}>
              <Flag className="mr-2 h-4 w-4 text-red-500" />
              High Priority
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePriorityChange('medium') }}>
              <Flag className="mr-2 h-4 w-4 text-yellow-500" />
              Medium Priority
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePriorityChange('low') }}>
              <Flag className="mr-2 h-4 w-4 text-green-500" />
              Low Priority
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive() }}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true) }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
