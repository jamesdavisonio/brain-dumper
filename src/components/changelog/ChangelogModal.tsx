import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CHANGELOG, CURRENT_VERSION } from '@/data/changelog'
import { Sparkles, Wrench, Bug } from 'lucide-react'

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

const CHANGE_ICONS = {
  feature: Sparkles,
  improvement: Wrench,
  fix: Bug,
}

const CHANGE_COLORS = {
  feature: 'text-green-500',
  improvement: 'text-blue-500',
  fix: 'text-amber-500',
}

export function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  const latestEntry = CHANGELOG[0]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What's New in v{CURRENT_VERSION}
          </DialogTitle>
          <DialogDescription>{latestEntry.title}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px]">
          <ul className="space-y-3 py-2">
            {latestEntry.changes.map((change, idx) => {
              const Icon = CHANGE_ICONS[change.type]
              return (
                <li key={idx} className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${CHANGE_COLORS[change.type]}`} />
                  <span className="text-sm">{change.description}</span>
                </li>
              )
            })}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={onClose}>Got it!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
