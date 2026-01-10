import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { detectOS, type OSType } from '@/lib/utils'
import { Smartphone, Monitor, Keyboard } from 'lucide-react'

interface VoiceInputGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getOSInstructions = (os: OSType) => {
  switch (os) {
    case 'android':
      return {
        icon: <Smartphone className="h-8 w-8 text-primary" />,
        title: 'Use Android Keyboard Voice Input',
        steps: [
          'Tap on the text area above to bring up your keyboard',
          'Look for the microphone icon on your keyboard (usually near the space bar)',
          'Tap the microphone icon to start voice input',
          'Speak naturally - punctuation is automatic',
          'Tap the microphone icon again or tap the text area when done',
        ],
        tip: 'Android keyboard voice input provides better accuracy and automatic punctuation compared to browser-based voice recognition.',
      }
    case 'ios':
      return {
        icon: <Smartphone className="h-8 w-8 text-primary" />,
        title: 'Use iOS Keyboard Voice Input',
        steps: [
          'Tap on the text area above to bring up your keyboard',
          'Look for the microphone icon on your keyboard (bottom right, near the space bar)',
          'Tap the microphone icon to start dictation',
          'Speak naturally - you can say punctuation like "period" or "comma"',
          'Tap the keyboard icon or "Done" when finished',
        ],
        tip: 'iOS dictation provides superior accuracy and works across all apps. Make sure dictation is enabled in Settings > General > Keyboard.',
      }
    case 'mac':
      return {
        icon: <Monitor className="h-8 w-8 text-primary" />,
        title: 'Use macOS Voice Dictation',
        steps: [
          'Click on the text area above',
          'Press the Fn (Function) key twice quickly to start dictation',
          'Or go to Edit menu and select "Start Dictation"',
          'Speak naturally - you can say punctuation commands',
          'Press Fn twice again or click "Done" to stop',
        ],
        tip: 'Enable dictation in System Settings > Keyboard > Dictation. You can also use enhanced dictation for offline use.',
      }
    case 'windows':
      return {
        icon: <Keyboard className="h-8 w-8 text-primary" />,
        title: 'Use Windows Voice Typing',
        steps: [
          'Click on the text area above',
          'Press Windows key + H to open voice typing',
          'Click the microphone icon if it doesn\'t start automatically',
          'Speak naturally - automatic punctuation is included',
          'Press Windows key + H again or click the microphone to stop',
        ],
        tip: 'Windows 11 has improved voice typing with better accuracy. Make sure your microphone is set up in Settings > System > Sound.',
      }
    case 'linux':
      return {
        icon: <Monitor className="h-8 w-8 text-primary" />,
        title: 'Use System Voice Input',
        steps: [
          'Most Linux distributions don\'t have built-in voice input',
          'You may need to install third-party tools like:',
          '• Nerd Dictation (command-line tool)',
          '• Lipsurf (browser extension)',
          '• Or use Google Docs\' voice typing and copy the text',
        ],
        tip: 'For the best experience on Linux, consider using a dedicated speech-to-text application or browser extension.',
      }
    default:
      return {
        icon: <Keyboard className="h-8 w-8 text-primary" />,
        title: 'Use Your Device\'s Voice Input',
        steps: [
          'Most modern devices have built-in voice input',
          'On mobile: Look for a microphone icon on your keyboard',
          'On desktop: Check your system settings for voice/dictation features',
          'Speak naturally and your device will transcribe your words',
        ],
        tip: 'Native voice input typically provides better accuracy than browser-based solutions.',
      }
  }
}

export function VoiceInputGuide({ open, onOpenChange }: VoiceInputGuideProps) {
  const os = detectOS()
  const instructions = getOSInstructions(os)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {instructions.icon}
            <DialogTitle>{instructions.title}</DialogTitle>
          </div>
          <DialogDescription>
            Follow these steps to use your device's native voice input for better accuracy
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ol className="space-y-3">
            {instructions.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {index + 1}
                </span>
                <span className="text-sm pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> {instructions.tip}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
