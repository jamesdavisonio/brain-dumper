import { useState, useEffect } from 'react'
import { useTasks } from '@/context/TaskContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker, type DateTimeValue } from '@/components/ui/date-time-picker'
import { Clock, Tag, Repeat, Plus, Minus } from 'lucide-react'
import { CATEGORIES, RECURRENCE_OPTIONS } from '@/lib/constants'
import type { Task, Priority, Recurrence } from '@/types'

interface TaskData {
  content: string
  priority: Priority
  project?: string
  category?: string
  dueDate?: Date | string
  dueTime?: string
  timeEstimate?: number
  recurrence?: Recurrence
}

interface EditTaskDialogProps {
  task: TaskData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (updates: Partial<TaskData>) => void | Promise<void>
  availableProjects?: string[]
}

export function EditTaskDialog({ task, open, onOpenChange, onSave, availableProjects }: EditTaskDialogProps) {
  const taskContext = useTasks()
  const projectsList = availableProjects || (taskContext ? taskContext.projects.map(p => p.name) : [])
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [project, setProject] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [dueDateTimeValue, setDueDateTimeValue] = useState<DateTimeValue>({ date: undefined, timeOfDay: null })
  const [timeEstimate, setTimeEstimate] = useState<number | undefined>()
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>()

  useEffect(() => {
    if (task) {
      setContent(task.content)
      setPriority(task.priority)
      setProject(task.project || '')
      setCategory(task.category || '')
      // Handle both Date and string formats
      if (task.dueDate) {
        const date = typeof task.dueDate === 'string' ? new Date(task.dueDate) : task.dueDate
        const timeOfDay = (task.dueTime as 'morning' | 'afternoon' | 'evening') || null
        setDueDateTimeValue({ date, timeOfDay })
      } else {
        setDueDateTimeValue({ date: undefined, timeOfDay: null })
      }
      setTimeEstimate(task.timeEstimate)
      setRecurrence(task.recurrence)
    }
  }, [task])

  const handleSave = async () => {
    if (!task || !content.trim()) return

    const updates = {
      content: content.trim(),
      priority,
      project: project || undefined,
      category: category || undefined,
      dueDate: dueDateTimeValue.date,
      dueTime: dueDateTimeValue.timeOfDay || undefined,
      // Auto-schedule task when due date is set
      scheduledDate: dueDateTimeValue.date,
      scheduledTime: dueDateTimeValue.timeOfDay || undefined,
      timeEstimate,
      recurrence,
    }

    if (onSave) {
      // Use custom save handler (for ApprovalScreen)
      await onSave(updates)
    } else if ('id' in task) {
      // Fall back to updateTask for saved tasks
      await taskContext.updateTask((task as Task).id, updates)
    }

    onOpenChange(false)
  }

  const adjustTimeEstimate = (delta: number) => {
    setTimeEstimate((prev) => {
      const current = prev || 0
      const newValue = Math.max(0, current + delta)
      return newValue === 0 ? undefined : newValue
    })
  }

  const handleRecurrenceChange = (value: string) => {
    if (value === 'none') {
      setRecurrence(undefined)
    } else {
      setRecurrence({ type: value as 'daily' | 'weekly' | 'monthly', interval: 1 })
    }
  }

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task and save when done
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="content">Task Description</Label>
            <Input
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Low
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={project || 'none'} onValueChange={(v) => setProject(v === 'none' ? '' : v)}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {projectsList.map((projectName) => (
                    <SelectItem key={projectName} value={projectName}>
                      {projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
                <SelectTrigger id="category">
                  <Tag className="mr-2 h-3 w-3" />
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <DateTimePicker
                value={dueDateTimeValue}
                onChange={setDueDateTimeValue}
                placeholder="Pick a date..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recurrence">Recurrence</Label>
              <Select
                value={recurrence?.type || 'none'}
                onValueChange={handleRecurrenceChange}
              >
                <SelectTrigger id="recurrence">
                  <Repeat className="mr-2 h-3 w-3" />
                  <SelectValue placeholder="No repeat" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeEstimate">Time Estimate (mins)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => adjustTimeEstimate(-15)}
                  disabled={!timeEstimate || timeEstimate < 15}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 flex-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="timeEstimate"
                    type="number"
                    min="0"
                    step="15"
                    placeholder="e.g., 30"
                    value={timeEstimate || ''}
                    onChange={(e) =>
                      setTimeEstimate(e.target.value ? parseInt(e.target.value, 10) : undefined)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => adjustTimeEstimate(15)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!content.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
