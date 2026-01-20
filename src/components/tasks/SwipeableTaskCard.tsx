import { useState, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import { TaskCard } from './TaskCard'
import { EditTaskDialog } from './EditTaskDialog'
import { Check, Archive, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import { useTasks } from '@/context/TaskContext'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'
import { addDays } from 'date-fns'

interface SwipeableTaskCardProps {
  task: Task
  showProject?: boolean
  inTimeline?: boolean
  projectBorder?: boolean
  showScheduling?: boolean
  onEditClick?: () => void
}

export function SwipeableTaskCard({ task, showProject = true, inTimeline = false, projectBorder = false, showScheduling = true, onEditClick }: SwipeableTaskCardProps) {
  const { updateTask } = useTasks()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Only enable swipe on mobile (touch devices)
  const isMobile = 'ontouchstart' in window

  const handleComplete = () => {
    setIsAnimating(true)
    updateTask(task.id, { completed: !task.completed })

    // Reset position after animation
    setTimeout(() => {
      setSwipeOffset(0)
      setIsAnimating(false)
    }, 300)
  }

  const handleArchive = () => {
    setIsAnimating(true)
    updateTask(task.id, { archived: true })

    // Reset position after animation
    setTimeout(() => {
      setSwipeOffset(0)
      setIsAnimating(false)
    }, 300)
  }

  const handleEdit = () => {
    setSwipeOffset(0)
    // Open edit dialog
    if (onEditClick) {
      onEditClick()
    } else {
      setIsEditDialogOpen(true)
    }
  }

  // Move task up in time-of-day (afternoon -> morning, evening -> afternoon, next day morning -> previous day evening)
  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task.scheduledDate) return

    const currentTime = task.scheduledTime?.toLowerCase()

    if (currentTime === 'afternoon') {
      updateTask(task.id, { scheduledTime: 'morning' })
    } else if (currentTime === 'evening') {
      updateTask(task.id, { scheduledTime: 'afternoon' })
    } else if (currentTime === 'morning') {
      // Move to previous day evening
      const prevDay = addDays(task.scheduledDate, -1)
      updateTask(task.id, { scheduledDate: prevDay, scheduledTime: 'evening' })
    } else {
      // No time specified - set to evening
      updateTask(task.id, { scheduledTime: 'evening' })
    }
  }

  // Move task down in time-of-day (morning -> afternoon, afternoon -> evening, evening -> next day morning)
  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task.scheduledDate) return

    const currentTime = task.scheduledTime?.toLowerCase()

    if (currentTime === 'morning') {
      updateTask(task.id, { scheduledTime: 'afternoon' })
    } else if (currentTime === 'afternoon') {
      updateTask(task.id, { scheduledTime: 'evening' })
    } else if (currentTime === 'evening') {
      // Move to next day morning
      const nextDay = addDays(task.scheduledDate, 1)
      updateTask(task.id, { scheduledDate: nextDay, scheduledTime: 'morning' })
    } else {
      // No time specified - set to morning
      updateTask(task.id, { scheduledTime: 'morning' })
    }
  }

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!isMobile) return

      // Limit swipe distance - left swipe shows more to reveal buttons
      const maxOffsetRight = 80
      const maxOffsetLeft = 140 // More space for two buttons

      let offset = eventData.deltaX
      if (offset > 0) {
        offset = Math.min(maxOffsetRight, offset)
      } else {
        offset = Math.max(-maxOffsetLeft, offset)
      }

      setSwipeOffset(offset)
    },
    onSwiped: (eventData) => {
      if (!isMobile) return

      const completeThreshold = 100 // Increased from 50 to prevent accidental completion
      const revealThreshold = 60 // Threshold for revealing Edit/Archive buttons

      if (eventData.deltaX > completeThreshold) {
        // Swipe right = complete action immediately (requires significant swipe)
        handleComplete()
      } else if (eventData.deltaX < -revealThreshold) {
        // Swipe left = reveal Edit/Archive buttons (stay open)
        setSwipeOffset(-140)
      } else {
        // Reset if threshold not met
        setSwipeOffset(0)
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: false, // Allow vertical scrolling
    delta: 20, // Increased from 10 to 20 - require more horizontal movement before capturing swipe
  })

  if (!isMobile) {
    return <TaskCard task={task} showProject={showProject} inTimeline={inTimeline} projectBorder={projectBorder} showScheduling={showScheduling} />
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex items-center justify-between">
        {/* Right swipe action - complete */}
        <div
          className={cn(
            'flex items-center gap-2 text-green-600 transition-opacity pl-4',
            swipeOffset > 20 ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Check className="h-5 w-5" />
          <span className="text-sm font-medium">{task.completed ? 'Undo' : 'Complete'}</span>
        </div>

        {/* Left swipe actions - Edit and Archive buttons */}
        <div
          className={cn(
            'flex items-center gap-2 pr-2 transition-opacity',
            swipeOffset < -20 ? 'opacity-100' : 'opacity-0'
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEdit()
            }}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg active:bg-blue-600"
          >
            <Pencil className="h-5 w-5" />
            <span className="text-xs font-medium">Edit</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleArchive()
            }}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-lg active:bg-orange-600"
          >
            <Archive className="h-5 w-5" />
            <span className="text-xs font-medium">Archive</span>
          </button>
        </div>
      </div>

      {/* Task card with swipe transform */}
      <div
        {...handlers}
        className={cn(
          'relative z-10',
          isAnimating && 'transition-transform duration-300'
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
        }}
      >
        <div ref={cardRef} className="relative">
          <TaskCard task={task} showProject={showProject} inTimeline={inTimeline} projectBorder={projectBorder} showScheduling={showScheduling} />

          {/* Time navigation arrows - only in timeline mode */}
          {inTimeline && task.scheduledDate && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
              <button
                onClick={handleMoveUp}
                className="p-1 rounded bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
                aria-label="Move to earlier time slot"
              >
                <ChevronUp className="h-4 w-4 text-primary" />
              </button>
              <button
                onClick={handleMoveDown}
                className="p-1 rounded bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
                aria-label="Move to later time slot"
              >
                <ChevronDown className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <EditTaskDialog
        task={task}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  )
}
