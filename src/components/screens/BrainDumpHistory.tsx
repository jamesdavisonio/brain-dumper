import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Brain, Calendar, ListTodo, Trash2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface BrainDumpHistoryEntry {
  id: string
  content: string
  createdAt: string
  taskCount: number
}

interface BrainDumpHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BrainDumpHistoryDialog({
  open,
  onOpenChange,
}: BrainDumpHistoryDialogProps) {
  const [history, setHistory] = useState<BrainDumpHistoryEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<BrainDumpHistoryEntry | null>(null)

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem('brainDumpHistory')
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    }
  }, [open])

  const handleDelete = (id: string) => {
    const updated = history.filter((entry) => entry.id !== id)
    setHistory(updated)
    localStorage.setItem('brainDumpHistory', JSON.stringify(updated))
    if (selectedEntry?.id === id) {
      setSelectedEntry(null)
    }
  }

  const handleClearAll = () => {
    setHistory([])
    localStorage.removeItem('brainDumpHistory')
    setSelectedEntry(null)
  }

  return (
    <>
      <Dialog open={open && !selectedEntry} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Brain Dump History
            </DialogTitle>
            <DialogDescription>
              View your previous brain dumps. Click to read the full content.
            </DialogDescription>
          </DialogHeader>

          {history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No brain dumps yet.</p>
              <p className="text-sm mt-1">
                Your brain dump history will appear here after you save tasks.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[400px] pr-4">
                <div className="space-y-3">
                  {history.map((entry) => (
                    <Card
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">
                              {entry.content.slice(0, 150)}
                              {entry.content.length > 150 && '...'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(new Date(entry.createdAt))}
                              </span>
                              <span className="flex items-center gap-1">
                                <ListTodo className="h-3 w-3" />
                                {entry.taskCount} tasks
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(entry.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All History
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Brain Dump
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedEntry(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selectedEntry && (
              <DialogDescription className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(new Date(selectedEntry.createdAt))}
                </span>
                <span className="flex items-center gap-1">
                  <ListTodo className="h-3 w-3" />
                  {selectedEntry.taskCount} tasks extracted
                </span>
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedEntry && (
            <ScrollArea className="max-h-[400px]">
              <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg">
                {selectedEntry.content}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
