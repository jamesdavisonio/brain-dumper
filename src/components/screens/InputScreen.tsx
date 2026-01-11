import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/context/TaskContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseBrainDump } from '@/services/gemini'
import { Loader2, Sparkles, History, Mic } from 'lucide-react'
import { VoiceInputGuide } from '@/components/screens/VoiceInputGuide'

export function InputScreen() {
  const navigate = useNavigate()
  const { projects } = useTasks()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVoiceGuide, setShowVoiceGuide] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check for reprocess content from history
  useEffect(() => {
    const reprocessContent = sessionStorage.getItem('reprocessContent')
    if (reprocessContent) {
      setInput(reprocessContent)
      sessionStorage.removeItem('reprocessContent')
      // Focus textarea after short delay
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [])

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

      // Save to brain dump history immediately after processing
      const history = JSON.parse(localStorage.getItem('brainDumpHistory') || '[]')
      history.unshift({
        id: Date.now().toString(),
        content: input,
        createdAt: new Date().toISOString(),
        taskCount: result.tasks.length,
      })
      // Keep only last 50 entries
      localStorage.setItem('brainDumpHistory', JSON.stringify(history.slice(0, 50)))

      navigate('/approve')
    } catch (err) {
      setError('Failed to process. Please try again.')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
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
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="mb-2">Dump your thoughts</CardTitle>
              <CardDescription>
                AI will organise them into tasks
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/history')}
            >
              <History className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">History</span>
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
              className="min-h-[300px] resize-none"
              disabled={isProcessing}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowVoiceGuide(true)}
              disabled={isProcessing}
              className="text-muted-foreground hover:text-foreground"
            >
              <Mic className="h-4 w-4 mr-1" />
              <span className="text-xs">Voice input</span>
            </Button>
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
                  Process
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

      <VoiceInputGuide open={showVoiceGuide} onOpenChange={setShowVoiceGuide} />
    </div>
  )
}
