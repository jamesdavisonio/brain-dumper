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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Clock, Tag, Repeat } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Task, Priority, Recurrence } from '@/types'

const CATEGORIES = ['Work', 'Personal', 'Health', 'Finance', 'Shopping', 'Home', 'Learning', 'Social', 'Travel', 'Admin'] as const

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

interface EditTaskDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditTaskDialog({ task, open, onOpenChange }: EditTaskDialogProps) {
  const { updateTask, projects } = useTasks()
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [project, setProject] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [timeEstimate, setTimeEstimate] = useState<number | undefined>()
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>()

  useEffect(() => {
    if (task) {
      setContent(task.content)
      setPriority(task.priority)
      setProject(task.project || '')
      setCategory(task.category || '')
      setDueDate(task.dueDate)
      setScheduledDate(task.scheduledDate)
      setTimeEstimate(task.timeEstimate)
      setRecurrence(task.recurrence)
    }
  }, [task])

  const handleSave = async () => {
    if (!task || !content.trim()) return

    await updateTask(task.id, {
      content: content.trim(),
      priority,
      project: project || undefined,
      category: category || undefined,
      dueDate,
      scheduledDate,
      timeEstimate,
      recurrence,
    })

    onOpenChange(false)
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
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? formatDate(dueDate) : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDueDate(undefined)}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Scheduled</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !scheduledDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? formatDate(scheduledDate) : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                  />
                  {scheduledDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setScheduledDate(undefined)}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
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
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="timeEstimate"
                  type="number"
                  min="0"
                  placeholder="e.g., 30"
                  value={timeEstimate || ''}
                  onChange={(e) =>
                    setTimeEstimate(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
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
