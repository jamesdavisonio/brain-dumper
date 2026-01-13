import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { Moon, Sun, LogOut, User, Download, Share, Settings } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export function Header() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { canInstall, isIOSDevice, hasInstallPrompt, install } = usePWAInstall()
  const [showInstallInstructions, setShowInstallInstructions] = useState(false)

  const handleInstallClick = async () => {
    if (isIOSDevice) {
      // iOS always needs manual instructions
      setShowInstallInstructions(true)
    } else if (hasInstallPrompt) {
      // Has native install prompt (Chrome/Edge/etc)
      const success = await install()
      // If install failed or was dismissed, show manual instructions
      if (!success) {
        setShowInstallInstructions(true)
      }
    } else {
      // No native prompt available, show manual instructions
      setShowInstallInstructions(true)
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
          <img
            src={theme === 'dark' ? '/logo-full-transparent-white-text.svg?v=2' : '/logo-full-transparent-dark-text.svg?v=2'}
            alt="Brain Dumper"
            className="h-8"
          />
        </Link>

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
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Install Instructions Dialog */}
      <Dialog open={showInstallInstructions} onOpenChange={setShowInstallInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install Brain Dumper</DialogTitle>
            <DialogDescription>
              {isIOSDevice
                ? "To install this app on your iPhone or iPad:"
                : "To install this app on your device:"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isIOSDevice ? (
              // iOS Instructions
              <>
                <ol className="list-decimal list-inside space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">1.</span>
                    <span className="flex-1">
                      Tap the <Share className="inline h-4 w-4 mx-1" /> <strong>Share</strong> button in Safari (usually at the bottom)
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
              </>
            ) : (
              // Android/Desktop Instructions
              <>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium mb-2">Chrome / Edge (Desktop & Android):</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Look for the <Download className="inline h-4 w-4 mx-1" /> install icon in the address bar</li>
                      <li>Click it and follow the prompts</li>
                      <li>Or open the browser menu (⋮) and select "Install app"</li>
                    </ol>
                  </div>

                  <div>
                    <p className="font-medium mb-2">Firefox (Android):</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Tap the menu (⋮)</li>
                      <li>Select "Install"</li>
                    </ol>
                  </div>

                  <div>
                    <p className="font-medium mb-2">Samsung Internet:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Tap the menu (≡)</li>
                      <li>Tap "Add page to" → "Home screen"</li>
                    </ol>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                  If you previously uninstalled the app, you may need to wait a moment or refresh the page for the install option to appear again.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
