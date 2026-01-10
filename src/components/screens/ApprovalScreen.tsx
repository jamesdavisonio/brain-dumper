import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/context/TaskContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Check, X, ArrowLeft, Loader2, Plus, Trash2, CalendarIcon, Clock, MessageSquare, Repeat, Tag, Edit } from 'lucide-react'
import type { ParsedTask, Priority, Recurrence } from '@/types'
import { cn, formatDate } from '@/lib/utils'
import { RECURRENCE_OPTIONS } from '@/lib/constants'
import { useToast } from '@/hooks/useToast'
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog'

function formatRecurrence(recurrence?: Recurrence): string {
  if (!recurrence) return 'No repeat'

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (recurrence.type === 'daily') {
    return recurrence.interval === 1 ? 'Daily' : `Every ${recurrence.interval} days`
  }
  if (recurrence.type === 'weekly') {
    if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
      const days = recurrence.daysOfWeek.map((d) => dayNames[d]).join(', ')
      return `Weekly on ${days}`
    }
    return recurrence.interval === 1 ? 'Weekly' : `Every ${recurrence.interval} weeks`
  }
  if (recurrence.type === 'monthly') {
    return recurrence.interval === 1 ? 'Monthly' : `Every ${recurrence.interval} months`
  }
  return 'Custom'
}

export function ApprovalScreen() {
  const navigate = useNavigate()
  const { bulkAddTasks, addProject, projects } = useTasks()
  const { toast } = useToast()
  const [tasks, setTasks] = useState<ParsedTask[]>([])
  const [suggestedProjects, setSuggestedProjects] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const isMobile = window.innerWidth < 768

  useEffect(() => {
    const storedTasks = sessionStorage.getItem('parsedTasks')
    const storedProjects = sessionStorage.getItem('suggestedProjects')

    if (!storedTasks) {
      navigate('/')
      return
    }

    setTasks(JSON.parse(storedTasks))
    if (storedProjects) {
      setSuggestedProjects(JSON.parse(storedProjects))
    }
  }, [navigate])

  const handleUpdateTask = (index: number, updates: Partial<ParsedTask>) => {
    setTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, ...updates } : task))
    )
  }

  const handleRemoveTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return
    await addProject(newProjectName.trim())
    setSuggestedProjects((prev) => [...prev, newProjectName.trim()])
    setNewProjectName('')
  }

  const handleRecurrenceChange = (index: number, value: string) => {
    if (value === 'none') {
      handleUpdateTask(index, { recurrence: undefined })
    } else {
      handleUpdateTask(index, {
        recurrence: { type: value as 'daily' | 'weekly' | 'monthly', interval: 1 },
      })
    }
  }

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) {
      setShowFeedback(false)
      return
    }

    // Store feedback for use in future brain dumps
    const feedbackHistory = JSON.parse(localStorage.getItem('parsingFeedback') || '[]')
    feedbackHistory.unshift({
      id: Date.now().toString(),
      feedback: feedback.trim(),
      createdAt: new Date().toISOString(),
    })
    // Keep only last 10 feedback entries
    localStorage.setItem('parsingFeedback', JSON.stringify(feedbackHistory.slice(0, 10)))

    setFeedback('')
    setShowFeedback(false)
  }

  const handleSaveAll = async () => {
    if (tasks.length === 0) return

    setIsSaving(true)
    try {
      // Create any new projects from suggestions that don't exist
      const existingProjectNames = projects.map((p) => p.name.toLowerCase())
      const newProjects = suggestedProjects.filter(
        (p) => !existingProjectNames.includes(p.toLowerCase())
      )

      for (const projectName of newProjects) {
        await addProject(projectName)
      }

      // Create tasks
      const tasksToAdd = tasks.map((task, index) => ({
        content: task.content,
        project: task.project,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        timeEstimate: task.timeEstimate,
        recurrence: task.recurrence,
        category: task.category,
        completed: false,
        archived: false,
        order: index,
      }))

      await bulkAddTasks(tasksToAdd)

      // History is now saved immediately after processing in InputScreen
      // No need to save again here

      // Clear session storage
      sessionStorage.removeItem('parsedTasks')
      sessionStorage.removeItem('suggestedProjects')
      sessionStorage.removeItem('originalInput')

      toast({
        title: 'Tasks saved',
        description: `${tasksToAdd.length} task${tasksToAdd.length > 1 ? 's' : ''} added successfully.`,
      })

      navigate('/list')
    } catch (error) {
      console.error('Failed to save tasks:', error)
      toast({
        title: 'Error saving tasks',
        description: 'Please try again. Check your internet connection.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    sessionStorage.removeItem('parsedTasks')
    sessionStorage.removeItem('suggestedProjects')
    sessionStorage.removeItem('originalInput')
    navigate('/')
  }

  const handleApproveTask = () => {
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1)
    } else {
      // All tasks approved, save them
      handleSaveAll()
    }
  }

  const handleDismissTask = () => {
    handleRemoveTask(currentTaskIndex)
    // If we just removed the last task, go back
    if (currentTaskIndex >= tasks.length - 1 && tasks.length > 1) {
      setCurrentTaskIndex(Math.max(0, currentTaskIndex - 1))
    }
  }

  if (tasks.length === 0) {
    return null
  }

  const allProjects = [
    ...new Set([
      ...projects.map((p) => p.name),
      ...suggestedProjects,
    ]),
  ]

  const currentTask = tasks[currentTaskIndex]

  // Mobile UI - one task at a time
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1">
            <p className="text-sm font-medium">Task {currentTaskIndex + 1} of {tasks.length}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowEditDialog(true)}>
            <Edit className="h-5 w-5" />
          </Button>
        </div>

        {/* Task Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 pt-6 pb-4">
            <h1 className="text-lg font-semibold">Review & Approve</h1>
          </div>
          <Card className="mx-4 mb-4">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-2xl font-semibold mb-2">{currentTask.content}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Priority</p>
                  <Badge variant={currentTask.priority} className="capitalize">
                    {currentTask.priority}
                  </Badge>
                </div>

                {currentTask.project && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Project</p>
                    <Badge variant="outline">{currentTask.project}</Badge>
                  </div>
                )}

                {currentTask.category && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Category</p>
                    <Badge variant="outline">
                      <Tag className="mr-1 h-3 w-3" />
                      {currentTask.category}
                    </Badge>
                  </div>
                )}

                {currentTask.dueDate && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Due Date</p>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatDate(new Date(currentTask.dueDate))}</span>
                    </div>
                  </div>
                )}

                {currentTask.timeEstimate && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Time Estimate</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{currentTask.timeEstimate} minutes</span>
                    </div>
                  </div>
                )}

                {currentTask.recurrence && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Recurrence</p>
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatRecurrence(currentTask.recurrence)}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleDismissTask}
              className="h-14"
            >
              <X className="mr-2 h-5 w-5" />
              Dismiss
            </Button>
            <Button
              size="lg"
              onClick={handleApproveTask}
              className="h-14"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : currentTaskIndex < tasks.length - 1 ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Approve
                </>
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Save All
                </>
              )}
            </Button>
          </div>
          {currentTaskIndex < tasks.length - 1 && (
            <p className="text-xs text-center text-muted-foreground">
              {tasks.length - currentTaskIndex - 1} more task{tasks.length - currentTaskIndex - 1 !== 1 ? 's' : ''} to review
            </p>
          )}
        </div>

        {/* Edit Dialog for Mobile */}
        <EditTaskDialog
          task={currentTask}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          availableProjects={allProjects}
          onSave={(updates) => {
            handleUpdateTask(currentTaskIndex, updates)
          }}
        />
      </div>
    )
  }

  // Desktop UI - show all tasks
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold mb-1">Review Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} tasks extracted. Edit before saving.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFeedback(true)}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Feedback
        </Button>
      </div>

      <div className="space-y-3">
        {tasks.map((task, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Input
                    value={task.content}
                    onChange={(e) =>
                      handleUpdateTask(index, { content: e.target.value })
                    }
                    placeholder="Task description"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveTask(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={task.priority}
                    onValueChange={(value: Priority) =>
                      handleUpdateTask(index, { priority: value })
                    }
                  >
                    <SelectTrigger className="w-[110px]">
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

                  <Select
                    value={task.project || 'none'}
                    onValueChange={(value) =>
                      handleUpdateTask(index, {
                        project: value === 'none' ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {allProjects.map((project) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={task.category || 'none'}
                    onValueChange={(value) =>
                      handleUpdateTask(index, {
                        category: value === 'none' ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <Tag className="mr-2 h-3 w-3" />
                      <SelectValue placeholder="Category" />
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

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-[130px] justify-start text-left font-normal',
                          !task.dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {task.dueDate ? formatDate(new Date(task.dueDate)) : 'Due date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={task.dueDate ? new Date(task.dueDate) : undefined}
                        onSelect={(date) =>
                          handleUpdateTask(index, {
                            dueDate: date ? date.toISOString().split('T')[0] : undefined,
                          })
                        }
                        initialFocus
                      />
                      {task.dueDate && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => handleUpdateTask(index, { dueDate: undefined })}
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={task.recurrence?.type || 'none'}
                    onValueChange={(value) => handleRecurrenceChange(index, value)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <Repeat className="mr-2 h-3 w-3" />
                      <SelectValue placeholder="Repeat" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {task.recurrence && (
                    <Badge variant="secondary" className="text-xs">
                      {formatRecurrence(task.recurrence)}
                    </Badge>
                  )}

                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="mins"
                      value={task.timeEstimate || ''}
                      onChange={(e) =>
                        handleUpdateTask(index, {
                          timeEstimate: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      className="w-[80px]"
                    />
                  </div>

                  {task.category && (
                    <Badge variant="outline" className="text-xs">
                      {task.category}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {suggestedProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Suggested Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedProjects.map((project) => {
                const exists = projects.some(
                  (p) => p.name.toLowerCase() === project.toLowerCase()
                )
                return (
                  <Badge
                    key={project}
                    variant={exists ? 'secondary' : 'outline'}
                  >
                    {project}
                    {exists && <Check className="ml-1 h-3 w-3" />}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Add New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
            />
            <Button onClick={handleAddProject} disabled={!newProjectName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={handleSaveAll} disabled={isSaving || tasks.length === 0}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save {tasks.length} Tasks
            </>
          )}
        </Button>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Parsing Feedback</DialogTitle>
            <DialogDescription>
              Help improve the AI by sharing what it got wrong. Your feedback will be used to improve future brain dumps.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., 'Missed the urgency in task 2', 'Project name was misspelled', 'Date was wrong for Monday'"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedback(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
