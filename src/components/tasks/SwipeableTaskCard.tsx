import { useState, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import { TaskCard } from './TaskCard'
import { Check, Archive, Pencil } from 'lucide-react'
import { useTasks } from '@/context/TaskContext'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface SwipeableTaskCardProps {
  task: Task
  showProject?: boolean
  inTimeline?: boolean
  projectBorder?: boolean
  onEditClick?: () => void
}

export function SwipeableTaskCard({ task, showProject = true, inTimeline = false, projectBorder = false, onEditClick }: SwipeableTaskCardProps) {
  const { updateTask } = useTasks()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
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
    // Trigger click on the card to open edit dialog
    if (onEditClick) {
      onEditClick()
    } else if (cardRef.current) {
      cardRef.current.click()
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

      const threshold = 50

      if (eventData.deltaX > threshold) {
        // Swipe right = complete action immediately
        handleComplete()
      } else if (eventData.deltaX < -threshold) {
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
    delta: 10, // Require 10px horizontal movement before capturing swipe
  })

  if (!isMobile) {
    return <TaskCard task={task} showProject={showProject} inTimeline={inTimeline} projectBorder={projectBorder} />
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
        <div ref={cardRef}>
          <TaskCard task={task} showProject={showProject} inTimeline={inTimeline} projectBorder={projectBorder} />
        </div>
      </div>
    </div>
  )
}
