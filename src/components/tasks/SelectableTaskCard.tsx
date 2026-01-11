import { Checkbox } from '@/components/ui/checkbox'
import { SwipeableTaskCard } from './SwipeableTaskCard'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface SelectableTaskCardProps {
  task: Task
  showProject?: boolean
  inTimeline?: boolean
  projectBorder?: boolean
  selectionMode: boolean
  isSelected: boolean
  onSelectionChange: (taskId: string, selected: boolean) => void
}

export function SelectableTaskCard({
  task,
  showProject = true,
  inTimeline = false,
  projectBorder = false,
  selectionMode,
  isSelected,
  onSelectionChange,
}: SelectableTaskCardProps) {
  if (!selectionMode) {
    return <SwipeableTaskCard task={task} showProject={showProject} inTimeline={inTimeline} projectBorder={projectBorder} />
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-1 rounded-lg transition-colors',
        isSelected && 'bg-primary/5'
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelectionChange(task.id, checked === true)}
        className="mt-5"
      />
      <div className="flex-1">
        <SwipeableTaskCard task={task} showProject={showProject} inTimeline={inTimeline} projectBorder={projectBorder} />
      </div>
    </div>
  )
}
