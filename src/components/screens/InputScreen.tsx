import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/context/TaskContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseBrainDump } from '@/services/gemini'
import { Brain, Loader2, Sparkles, History, Mic } from 'lucide-react'
import { BrainDumpHistoryDialog } from '@/components/screens/BrainDumpHistory'
import { VoiceInputGuide } from '@/components/screens/VoiceInputGuide'

export function InputScreen() {
  const navigate = useNavigate()
  const { projects } = useTasks()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showVoiceGuide, setShowVoiceGuide] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keyboard shortcut: Ctrl/Cmd + Enter to process
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && input.trim() && !isProcessing) {
        e.preventDefault()
        handleProcess()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input, isProcessing])

  const handleProcess = async () => {
    if (!input.trim()) return

    setIsProcessing(true)
    setError(null)

    try {
      // Pass existing project names to the parser
      const existingProjectNames = projects.map((p) => p.name)
      const result = await parseBrainDump(input, existingProjectNames)

      if (result.tasks.length === 0) {
        setError('No tasks could be extracted. Try adding more detail.')
        return
      }

      // Store parsed tasks in session storage for approval screen
      sessionStorage.setItem('parsedTasks', JSON.stringify(result.tasks))
      sessionStorage.setItem(
        'suggestedProjects',
        JSON.stringify(result.suggestedProjects)
      )
      sessionStorage.setItem('originalInput', input)

      navigate('/approve')
    } catch (err) {
      setError('Failed to process. Please try again.')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReprocess = (content: string) => {
    setInput(content)
    setShowHistory(false)
    // Focus the textarea after a short delay to ensure the dialog is closed
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const placeholderText = `Example:
- Need to finish the quarterly report by Friday, it's urgent
- Call mom tomorrow about her birthday party
- Buy groceries - milk, eggs, bread
- Eventually clean out the garage
- Schedule dentist appointment for next week
- Research vacation spots for summer @personal
- Fix the bug in the login page, critical for launch`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Brain Dumper</CardTitle>
                <CardDescription>
                  Pour out your thoughts. AI will organize them into tasks.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={placeholderText}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[300px] resize-none pr-12"
              disabled={isProcessing}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setShowVoiceGuide(true)}
              disabled={isProcessing}
              title="How to use voice input"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {input.length} characters
            </p>
            <Button
              onClick={handleProcess}
              disabled={!input.trim() || isProcessing}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Process with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">Tips for better results:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Use words like "urgent" or "eventually" to set priority</li>
            <li>• Mention dates like "tomorrow" or "next Friday"</li>
            <li>• Use @project to assign tasks to projects</li>
            <li>• Add time estimates like "30 min" or "2 hours"</li>
            <li>• Say "every Monday" or "daily" for recurring tasks</li>
          </ul>
          <div className="mt-4 pt-4 border-t hidden md:block">
            <h3 className="font-medium mb-2">Keyboard shortcuts:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Enter</kbd> — Process with AI</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <BrainDumpHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        onReprocess={handleReprocess}
      />
      <VoiceInputGuide open={showVoiceGuide} onOpenChange={setShowVoiceGuide} />
    </div>
  )
}
