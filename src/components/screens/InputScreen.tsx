import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/context/TaskContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseBrainDump } from '@/services/gemini'
import { Brain, Loader2, Sparkles, History, Mic, MicOff } from 'lucide-react'
import { BrainDumpHistoryDialog } from '@/components/screens/BrainDumpHistory'

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function InputScreen() {
  const navigate = useNavigate()
  const { projects } = useTasks()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(!!SpeechRecognition)
  }, [])

  // Keyboard shortcut: Ctrl/Cmd + Enter to process
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && input.trim() && !isProcessing) {
        e.preventDefault()
        handleProcess()
      }
      // Ctrl/Cmd + M to toggle voice input
      if ((e.ctrlKey || e.metaKey) && e.key === 'm' && speechSupported) {
        e.preventDefault()
        toggleListening()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input, isProcessing, speechSupported])

  const toggleListening = useCallback(() => {
    if (!speechSupported) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' '
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        setInput((prev) => prev + finalTranscript)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    textareaRef.current?.focus()
  }, [isListening, speechSupported])

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
                <CardTitle>Brain Dump</CardTitle>
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
              className={`min-h-[300px] resize-none pr-12 ${isListening ? 'ring-2 ring-red-500' : ''}`}
              disabled={isProcessing}
            />
            {speechSupported && (
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'ghost'}
                size="icon"
                className="absolute top-2 right-2"
                onClick={toggleListening}
                disabled={isProcessing}
                title={isListening ? 'Stop voice input' : 'Start voice input (Ctrl+M)'}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            {isListening && (
              <div className="absolute bottom-2 left-2 flex items-center gap-2 text-sm text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Listening...
              </div>
            )}
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
          <div className="mt-4 pt-4 border-t">
            <h3 className="font-medium mb-2">Keyboard shortcuts:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Enter</kbd> — Process with AI</li>
              {speechSupported && (
                <li>• <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">M</kbd> — Toggle voice input</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <BrainDumpHistoryDialog open={showHistory} onOpenChange={setShowHistory} />
    </div>
  )
}
