import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Brain, Calendar, ListTodo, Search, Trash2, ArrowLeft, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface BrainDumpHistoryEntry {
  id: string
  content: string
  createdAt: string
  taskCount: number
}

export function HistoryView() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<BrainDumpHistoryEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<BrainDumpHistoryEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('brainDumpHistory')
    if (stored) {
      setHistory(JSON.parse(stored))
    }
  }, [])

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history
    const query = searchQuery.toLowerCase()
    return history.filter((entry) =>
      entry.content.toLowerCase().includes(query)
    )
  }, [history, searchQuery])

  const handleDelete = (id: string) => {
    const updated = history.filter((entry) => entry.id !== id)
    setHistory(updated)
    localStorage.setItem('brainDumpHistory', JSON.stringify(updated))
    if (selectedEntry?.id === id) {
      setSelectedEntry(null)
    }
    setDeleteId(null)
  }

  const handleClearAll = () => {
    setHistory([])
    localStorage.removeItem('brainDumpHistory')
    setSelectedEntry(null)
    setShowClearAllDialog(false)
  }

  const handleReprocess = (content: string) => {
    sessionStorage.setItem('reprocessContent', content)
    navigate('/')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Brain Dumper History
          </h1>
          <p className="text-sm text-muted-foreground">
            View and reprocess your previous brain dumps
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No brain dumps yet.</p>
            <p className="text-sm mt-1 text-muted-foreground">
              Your brain dump history will appear here after you process tasks.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate('/')}
            >
              Create Your First Dump
            </Button>
          </CardContent>
        </Card>
      ) : selectedEntry ? (
        /* Detail View */
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEntry(null)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(new Date(selectedEntry.createdAt))}
                </span>
                <span className="flex items-center gap-1">
                  <ListTodo className="h-3 w-3" />
                  {selectedEntry.taskCount} tasks extracted
                </span>
              </div>
            </div>

            <ScrollArea className="max-h-[500px]">
              <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg">
                {selectedEntry.content}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
              <Button
                variant="outline"
                onClick={() => handleReprocess(selectedEntry.content)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reprocess
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* List View */
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brain dumps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredHistory.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No results for "{searchQuery}"</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-3 pr-4">
                {filteredHistory.map((entry) => (
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
                            setDeleteId(entry.id)
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
          )}

          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearAllDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All History
            </Button>
          </div>
        </>
      )}

      {/* Delete Single Entry Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brain Dump?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All History?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {history.length} brain dump entries? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
