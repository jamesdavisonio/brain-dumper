import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SuggestionCard } from './SuggestionCard'
import { TimeSlotPicker } from './TimeSlotPicker'
import { ConflictWarning } from './ConflictWarning'
import {
  Calendar,
  Clock,
  Loader2,
  Sparkles,
  Settings2,
  AlertTriangle,
} from 'lucide-react'
import { cn, formatTimeEstimate } from '@/lib/utils'
import type {
  Task,
  TimeSlot,
  SchedulingSuggestion,
  AvailabilityWindow,
  Conflict,
} from '@/types'

interface Displacement {
  taskId: string
  taskName: string
  originalStart: Date
  originalEnd: Date
  newStart?: Date
  newEnd?: Date
  action: 'move' | 'unschedule'
  reason: string
}

interface ScheduleSuggestionModalProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule: (slot: TimeSlot) => void
  suggestions?: SchedulingSuggestion[]
  availability?: AvailabilityWindow[]
  displacements?: Displacement[]
  isLoading?: boolean
  error?: string | null
}

/**
 * Modal for selecting a time slot for a task
 *
 * Features:
 * - Shows AI-suggested time slots
 * - Manual time picker as fallback
 * - Conflict warnings with displacement info
 * - Approval flow for displacements
 */
export function ScheduleSuggestionModal({
  task,
  open,
  onOpenChange,
  onSchedule,
  suggestions = [],
  availability = [],
  displacements = [],
  isLoading = false,
  error = null,
}: ScheduleSuggestionModalProps) {
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(
    suggestions.length > 0 ? 0 : null
  )
  const [manualDate, setManualDate] = useState<Date | undefined>()
  const [manualTime, setManualTime] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('suggestions')
  const [showDisplacementWarning, setShowDisplacementWarning] = useState(false)

  // Get selected slot based on current selection
  const selectedSlot = useMemo<TimeSlot | null>(() => {
    if (activeTab === 'suggestions' && selectedSuggestionIndex !== null) {
      return suggestions[selectedSuggestionIndex]?.slot ?? null
    }
    if (activeTab === 'manual' && manualDate && manualTime) {
      const [hours, minutes] = manualTime.split(':').map(Number)
      const start = new Date(manualDate)
      start.setHours(hours, minutes, 0, 0)
      const durationMs = (task.timeEstimate || 60) * 60000
      const end = new Date(start.getTime() + durationMs)
      return { start, end, available: true }
    }
    return null
  }, [activeTab, selectedSuggestionIndex, manualDate, manualTime, suggestions, task.timeEstimate])

  // Get conflicts for selected suggestion
  const selectedConflicts = useMemo<Conflict[]>(() => {
    if (activeTab === 'suggestions' && selectedSuggestionIndex !== null) {
      return suggestions[selectedSuggestionIndex]?.conflicts ?? []
    }
    return []
  }, [activeTab, selectedSuggestionIndex, suggestions])

  const hasDisplacements = displacements.length > 0
  const hasBlockingConflicts = selectedConflicts.some((c) => c.severity === 'error')

  const handleSchedule = () => {
    if (!selectedSlot) return

    if (hasDisplacements) {
      setShowDisplacementWarning(true)
    } else {
      onSchedule(selectedSlot)
    }
  }

  const handleApproveDisplacements = () => {
    if (selectedSlot) {
      onSchedule(selectedSlot)
    }
    setShowDisplacementWarning(false)
  }

  const handleManualTimeSelect = (date: Date, time: string) => {
    setManualDate(date)
    setManualTime(time)
  }

  const priorityLabel =
    task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'
  const priorityColor =
    task.priority === 'high'
      ? 'bg-red-500/10 text-red-500'
      : task.priority === 'medium'
      ? 'bg-yellow-500/10 text-yellow-500'
      : 'bg-green-500/10 text-green-500'

  return (
    <>
      <Dialog open={open && !showDisplacementWarning} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Task
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p className="font-medium text-foreground">{task.content}</p>
                <div className="flex flex-wrap gap-2">
                  {task.timeEstimate && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeEstimate(task.timeEstimate)}
                    </Badge>
                  )}
                  <Badge className={cn('capitalize', priorityColor)}>
                    {priorityLabel} Priority
                  </Badge>
                  {task.project && (
                    <Badge variant="outline">{task.project}</Badge>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="suggestions" className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                Suggested Times
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {suggestions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                Pick a Time
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggestions" className="flex-1 min-h-0 mt-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Finding best times...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-destructive">
                  <AlertTriangle className="h-8 w-8 mb-2" />
                  <p className="font-medium">Failed to load suggestions</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Calendar className="h-8 w-8 mb-2" />
                  <p className="font-medium">No suggestions available</p>
                  <p className="text-sm">Try picking a time manually</p>
                </div>
              ) : (
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                      <SuggestionCard
                        key={index}
                        suggestion={suggestion}
                        selected={selectedSuggestionIndex === index}
                        onSelect={() => setSelectedSuggestionIndex(index)}
                        showReasoning
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="manual" className="flex-1 min-h-0 mt-4">
              <TimeSlotPicker
                selectedDate={manualDate}
                selectedTime={manualTime}
                availability={availability}
                onSelect={handleManualTimeSelect}
                minDuration={task.timeEstimate || 30}
              />
            </TabsContent>
          </Tabs>

          {/* Conflict warning banner */}
          {selectedConflicts.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    {selectedConflicts.length} conflict
                    {selectedConflicts.length > 1 ? 's' : ''} detected
                  </p>
                  <p className="text-muted-foreground">
                    {selectedConflicts[0].description}
                    {selectedConflicts.length > 1 &&
                      ` and ${selectedConflicts.length - 1} more`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!selectedSlot || hasBlockingConflicts || isLoading}
            >
              {hasDisplacements ? (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Review Changes
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Displacement warning dialog */}
      {showDisplacementWarning && selectedSlot && (
        <ConflictWarning
          conflicts={selectedConflicts}
          displacements={displacements}
          onApproveDisplacements={handleApproveDisplacements}
          onReject={() => setShowDisplacementWarning(false)}
        />
      )}
    </>
  )
}
