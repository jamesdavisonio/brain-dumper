import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Brain, Moon, Sun, LogOut, User, Download, Share } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export function Header() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { canInstall, isIOSDevice, install } = usePWAInstall()
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  const handleInstallClick = () => {
    if (isIOSDevice) {
      setShowIOSInstructions(true)
    } else {
      install()
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-semibold">Brain Dump</span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                {canInstall && (
                  <>
                    <DropdownMenuItem onClick={handleInstallClick}>
                      {isIOSDevice ? (
                        <>
                          <Share className="mr-2 h-4 w-4" />
                          Install App
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Install App
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* iOS Install Instructions Dialog */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Brain Dump</DialogTitle>
            <DialogDescription>
              To install this app on your iPhone or iPad:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">1.</span>
                <span className="flex-1">
                  Tap the <Share className="inline h-4 w-4 mx-1" /> <strong>Share</strong> button in your browser (usually at the bottom of Safari)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">2.</span>
                <span className="flex-1">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">3.</span>
                <span className="flex-1">
                  Tap <strong>"Add"</strong> in the top right corner
                </span>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-4">
              The app will appear on your home screen and work like a native app!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
