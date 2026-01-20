import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/context/TaskContext'
import { useCalendar } from '@/context/CalendarContext'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DateTimePicker, type DateTimeValue } from '@/components/ui/date-time-picker'
import { Check, X, ArrowLeft, Loader2, Plus, Trash2, CalendarIcon, Clock, MessageSquare, Repeat, Tag, Edit, ArrowRight, Sparkles } from 'lucide-react'
import type { ParsedTask, Priority, Recurrence, TimeSlot, SchedulingSuggestion, Task } from '@/types'
import { formatDate, formatTimeOfDay } from '@/lib/utils'
import { CATEGORIES, RECURRENCE_OPTIONS } from '@/lib/constants'
import { useToast } from '@/hooks/useToast'
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog'
import {
  ScheduleApprovalPanel,
  ScheduleSummaryCard,
} from '@/components/scheduling'
import { getAvailability } from '@/services/availability'
import { addDays, startOfDay } from 'date-fns'

type ApprovalState = 'pending' | 'approved' | 'rejected' | 'modified'

interface ScheduledTaskItem {
  task: Task
  proposedSlot: TimeSlot | null
  suggestions: SchedulingSuggestion[]
  approvalState: ApprovalState
  error?: string
}

interface ScheduleProposal {
  items: ScheduledTaskItem[]
  generatedAt: Date
  summary: {
    totalTasks: number
    scheduled: number
    conflicts: number
    displacements: number
    unschedulable: number
  }
}

type ApprovalStep = 'tasks' | 'schedule'

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
  const { isConnected: isCalendarConnected, enabledCalendarIds, workCalendarId, personalCalendarId } = useCalendar()
  // Use work calendar as primary for scheduling, fall back to personal or first enabled
  const primaryCalendarId = workCalendarId || personalCalendarId || enabledCalendarIds[0]
  const { toast } = useToast()
  const [tasks, setTasks] = useState<ParsedTask[]>([])
  const [suggestedProjects, setSuggestedProjects] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [currentStep, setCurrentStep] = useState<ApprovalStep>('tasks')
  const [scheduleProposal, setScheduleProposal] = useState<ScheduleProposal | null>(null)
  const [scheduleApprovals, setScheduleApprovals] = useState<Map<string, ApprovalState>>(new Map())
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false)
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

  // Generate schedule proposal from approved tasks using real availability
  const generateScheduleProposal = async () => {
    setIsGeneratingSchedule(true)
    try {
      // Get the calendar to schedule on (prefer primary, fall back to first enabled)
      const calendarId = primaryCalendarId || enabledCalendarIds[0]
      if (!calendarId) {
        throw new Error('No calendar available for scheduling')
      }

      // Fetch real availability for the next 7 days
      const startDate = startOfDay(new Date())
      const endDate = addDays(startDate, 7)

      const availabilityWindows = await getAvailability({
        calendarIds: [calendarId],
        startDate,
        endDate,
      })

      // Collect all available slots from the availability windows
      // The API returns 30-minute interval slots, so we need to merge consecutive available slots
      // into larger contiguous blocks that can accommodate tasks of various durations
      const allAvailableSlots: TimeSlot[] = []

      for (const window of availabilityWindows) {
        let currentBlock: { start: Date; end: Date } | null = null

        for (const slot of window.slots) {
          if (slot.available) {
            if (currentBlock === null) {
              // Start a new block
              currentBlock = { start: slot.start, end: slot.end }
            } else if (slot.start.getTime() === currentBlock.end.getTime()) {
              // Extend the current block (consecutive slot)
              currentBlock.end = slot.end
            } else {
              // Gap detected - save current block and start new one
              allAvailableSlots.push({
                start: currentBlock.start,
                end: currentBlock.end,
                available: true,
              })
              currentBlock = { start: slot.start, end: slot.end }
            }
          } else {
            // Busy slot - save current block if exists
            if (currentBlock !== null) {
              allAvailableSlots.push({
                start: currentBlock.start,
                end: currentBlock.end,
                available: true,
              })
              currentBlock = null
            }
          }
        }

        // Don't forget the last block of the day
        if (currentBlock !== null) {
          allAvailableSlots.push({
            start: currentBlock.start,
            end: currentBlock.end,
            available: true,
          })
        }
      }

      console.log('[Schedule] Merged availability blocks:', allAvailableSlots.map(s => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        durationMin: (s.end.getTime() - s.start.getTime()) / 60000
      })))

      // Convert ParsedTasks to Task-like objects
      const mockTasks: Task[] = tasks.map((task, index) => ({
        id: `temp-${index}`,
        content: task.content,
        project: task.project,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        dueTime: task.dueTime,
        timeEstimate: task.timeEstimate,
        completed: false,
        archived: false,
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        order: index,
        recurrence: task.recurrence,
        category: task.category,
      }))

      // Sort tasks by priority (high first) then by due date
      const sortedTasks = [...mockTasks].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        if (a.dueDate && b.dueDate) {
          return a.dueDate.getTime() - b.dueDate.getTime()
        }
        return 0
      })

      // Track used time ranges to avoid double-booking
      const usedRanges: Array<{ start: Date; end: Date }> = []

      // Find slots for each task sequentially
      const items: ScheduledTaskItem[] = sortedTasks.map((task) => {
        const duration = task.timeEstimate || 60 // Default 60 min if no estimate
        console.log(`[Schedule] Finding slot for task "${task.content}" (${duration} min)`)

        // Find the first available slot that fits this task and doesn't overlap with used ranges
        let foundSlot: TimeSlot | null = null

        for (const slot of allAvailableSlots) {
          const slotStart = slot.start
          const slotEnd = slot.end
          const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / 60000

          // Skip if slot is too short
          if (slotDuration < duration) {
            console.log(`[Schedule] Skipping slot (${slotDuration}min < ${duration}min needed)`)
            continue
          }

          // Try to find a portion of this slot that doesn't overlap with used ranges
          let candidateStart = new Date(slotStart)

          while (candidateStart.getTime() + duration * 60000 <= slotEnd.getTime()) {
            const candidateEnd = new Date(candidateStart.getTime() + duration * 60000)

            // Check if this candidate overlaps with any used range
            const hasOverlap = usedRanges.some(
              (range) => candidateStart < range.end && candidateEnd > range.start
            )

            if (!hasOverlap) {
              foundSlot = {
                start: candidateStart,
                end: candidateEnd,
                available: true,
              }
              // Mark this range as used
              usedRanges.push({ start: candidateStart, end: candidateEnd })
              break
            }

            // Move to next 15-minute increment
            candidateStart = new Date(candidateStart.getTime() + 15 * 60000)
          }

          if (foundSlot) break
        }

        if (foundSlot) {
          console.log(`[Schedule] ✓ Found slot for "${task.content}": ${foundSlot.start.toISOString()} - ${foundSlot.end.toISOString()}`)
          return {
            task,
            proposedSlot: foundSlot,
            suggestions: [
              {
                slot: foundSlot,
                score: 85,
                reasoning: 'Best available slot based on your calendar availability',
                factors: [
                  { name: 'Calendar availability', weight: 0.5, value: 100, description: 'Free slot' },
                  { name: 'Priority order', weight: 0.3, value: 90, description: 'Scheduled by priority' },
                ],
                conflicts: [],
              },
            ],
            approvalState: 'pending' as ApprovalState,
          }
        }

        console.log(`[Schedule] ✗ No slot found for "${task.content}" (needed ${duration}min, checked ${allAvailableSlots.length} blocks)`)
        return {
          task,
          proposedSlot: null,
          suggestions: [],
          approvalState: 'pending' as ApprovalState,
          error: duration ? 'No available slot found in the next 7 days' : 'No time estimate provided',
        }
      })

      const scheduled = items.filter((i) => i.proposedSlot !== null).length

      setScheduleProposal({
        items,
        generatedAt: new Date(),
        summary: {
          totalTasks: items.length,
          scheduled,
          conflicts: 0,
          displacements: 0,
          unschedulable: items.length - scheduled,
        },
      })

      // Initialize approvals - auto-approve scheduled items
      const initialApprovals = new Map<string, ApprovalState>()
      items.forEach((item) => {
        initialApprovals.set(item.task.id, item.proposedSlot ? 'approved' : 'rejected')
      })
      setScheduleApprovals(initialApprovals)
    } catch (error) {
      console.error('Failed to generate schedule:', error)
      toast({
        title: 'Failed to generate schedule',
        description: error instanceof Error ? error.message : 'Could not create scheduling suggestions. Try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingSchedule(false)
    }
  }

  const handleProceedToSchedule = async () => {
    if (isCalendarConnected) {
      await generateScheduleProposal()
      setCurrentStep('schedule')
    } else {
      // If calendar is not connected, skip scheduling step
      handleSaveAll()
    }
  }

  const handleScheduleApprovalChange = (taskId: string, state: ApprovalState) => {
    setScheduleApprovals((prev) => new Map(prev).set(taskId, state))
  }

  const handleApproveAllSchedules = () => {
    if (!scheduleProposal) return
    const newApprovals = new Map<string, ApprovalState>()
    scheduleProposal.items.forEach((item) => {
      if (item.proposedSlot) {
        newApprovals.set(item.task.id, 'approved')
      } else {
        newApprovals.set(item.task.id, 'rejected')
      }
    })
    setScheduleApprovals(newApprovals)
  }

  const handleRejectAllSchedules = () => {
    if (!scheduleProposal) return
    const newApprovals = new Map<string, ApprovalState>()
    scheduleProposal.items.forEach((item) => {
      newApprovals.set(item.task.id, 'rejected')
    })
    setScheduleApprovals(newApprovals)
  }

  const handleBackToTasks = () => {
    setCurrentStep('tasks')
    setScheduleProposal(null)
    setScheduleApprovals(new Map())
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

      // Create tasks with schedule data if available
      const tasksToAdd = tasks.map((task, index) => {
        const taskData: Parameters<typeof bulkAddTasks>[0][number] = {
          content: task.content,
          project: task.project,
          priority: task.priority,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          dueTime: task.dueTime,
          scheduledDate: task.dueDate ? new Date(task.dueDate) : undefined,
          scheduledTime: task.scheduledTime,
          timeEstimate: task.timeEstimate,
          recurrence: task.recurrence,
          category: task.category,
          completed: false,
          archived: false,
          order: index,
        }

        // Add scheduling data if we have a schedule proposal and approved slot
        if (scheduleProposal && currentStep === 'schedule') {
          const scheduleItem = scheduleProposal.items.find(
            (item) => item.task.id === `temp-${index}`
          )
          const approvalState = scheduleApprovals.get(`temp-${index}`)

          if (scheduleItem?.proposedSlot && approvalState === 'approved') {
            // The calendarId is required for the Firestore trigger to create the calendar event
            const calendarId = primaryCalendarId || enabledCalendarIds[0]
            taskData.scheduledStart = scheduleItem.proposedSlot.start
            taskData.scheduledEnd = scheduleItem.proposedSlot.end
            taskData.calendarId = calendarId
            taskData.syncStatus = 'pending'
          }
        }

        return taskData
      })

      await bulkAddTasks(tasksToAdd)

      // Clear session storage
      sessionStorage.removeItem('parsedTasks')
      sessionStorage.removeItem('suggestedProjects')
      sessionStorage.removeItem('originalInput')

      const scheduledCount = scheduleProposal
        ? Array.from(scheduleApprovals.values()).filter((s) => s === 'approved').length
        : 0

      toast({
        title: 'Tasks saved',
        description: scheduledCount > 0
          ? `${tasksToAdd.length} task${tasksToAdd.length > 1 ? 's' : ''} added, ${scheduledCount} scheduled.`
          : `${tasksToAdd.length} task${tasksToAdd.length > 1 ? 's' : ''} added successfully.`,
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
                      <span className="text-sm flex items-center gap-1">
                        {formatDate(new Date(currentTask.dueDate))}
                        {formatTimeOfDay(currentTask.dueTime) && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                            {formatTimeOfDay(currentTask.dueTime)}
                          </Badge>
                        )}
                      </span>
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
            // Convert Date to string for ParsedTask compatibility
            const parsedUpdates: Partial<ParsedTask> = {
              ...updates,
              dueDate: updates.dueDate instanceof Date
                ? updates.dueDate.toISOString().split('T')[0]
                : updates.dueDate
            }
            handleUpdateTask(currentTaskIndex, parsedUpdates)
          }}
        />
      </div>
    )
  }

  // Schedule Step UI
  if (currentStep === 'schedule' && scheduleProposal) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToTasks}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold mb-1">Review Schedule</h1>
              <p className="text-sm text-muted-foreground">
                Approve or modify the proposed schedule for your tasks.
              </p>
            </div>
          </div>
        </div>

        {/* Schedule summary */}
        <ScheduleSummaryCard summary={scheduleProposal.summary} />

        {/* Schedule approval panel */}
        <ScheduleApprovalPanel
          proposal={scheduleProposal}
          approvals={scheduleApprovals}
          onApprovalChange={handleScheduleApprovalChange}
          onApproveAll={handleApproveAllSchedules}
          onRejectAll={handleRejectAllSchedules}
          isProcessing={isSaving}
        />

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleBackToTasks}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Button>
          <Button onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirm & Save All
              </>
            )}
          </Button>
        </div>
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

                  <DateTimePicker
                    value={{
                      date: task.dueDate ? new Date(task.dueDate) : undefined,
                      timeOfDay: (task.dueTime as 'morning' | 'afternoon' | 'evening') || null,
                    }}
                    onChange={(value: DateTimeValue) =>
                      handleUpdateTask(index, {
                        dueDate: value.date ? value.date.toISOString().split('T')[0] : undefined,
                        dueTime: value.timeOfDay || undefined,
                      })
                    }
                    placeholder="Due date"
                    className="w-[200px]"
                  />
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
        {isCalendarConnected ? (
          <Button
            onClick={handleProceedToSchedule}
            disabled={isGeneratingSchedule || tasks.length === 0}
          >
            {isGeneratingSchedule ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating schedule...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Review Schedule
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
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
        )}
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
