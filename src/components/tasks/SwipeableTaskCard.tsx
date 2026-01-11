import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import { TaskCard } from './TaskCard'
import { Check, Archive } from 'lucide-react'
import { useTasks } from '@/context/TaskContext'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface SwipeableTaskCardProps {
  task: Task
  showProject?: boolean
  inTimeline?: boolean
}

export function SwipeableTaskCard({ task, showProject = true, inTimeline = false }: SwipeableTaskCardProps) {
  const { updateTask } = useTasks()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Only enable swipe on mobile (touch devices)
  const isMobile = 'ontouchstart' in window

  const handleSwipe = (direction: 'left' | 'right') => {
    setIsAnimating(true)

    if (direction === 'right') {
      // Swipe right = complete/uncomplete
      updateTask(task.id, { completed: !task.completed })
    } else if (direction === 'left') {
      // Swipe left = archive
      updateTask(task.id, { archived: true })
    }

    // Reset position after animation
    setTimeout(() => {
      setSwipeOffset(0)
      setIsAnimating(false)
    }, 300)
  }

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!isMobile) return

      // Limit swipe distance
      const maxOffset = 80
      const offset = Math.max(-maxOffset, Math.min(maxOffset, eventData.deltaX))
      setSwipeOffset(offset)
    },
    onSwiped: (eventData) => {
      if (!isMobile) return

      const threshold = 50

      if (eventData.deltaX > threshold) {
        handleSwipe('right')
      } else if (eventData.deltaX < -threshold) {
        handleSwipe('left')
      } else {
        // Reset if threshold not met
        setSwipeOffset(0)
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
  })

  if (!isMobile) {
    return <TaskCard task={task} showProject={showProject} inTimeline={inTimeline} />
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        {/* Right swipe action - complete */}
        <div
          className={cn(
            'flex items-center gap-2 text-green-600 transition-opacity',
            swipeOffset > 20 ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Check className="h-5 w-5" />
          <span className="text-sm font-medium">{task.completed ? 'Undo' : 'Complete'}</span>
        </div>

        {/* Left swipe action - archive */}
        <div
          className={cn(
            'flex items-center gap-2 text-orange-600 transition-opacity',
            swipeOffset < -20 ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span className="text-sm font-medium">Archive</span>
          <Archive className="h-5 w-5" />
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
        <TaskCard task={task} showProject={showProject} inTimeline={inTimeline} />
      </div>
    </div>
  )
}
