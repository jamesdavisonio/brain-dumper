import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Helper to detect iOS
const isIOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

// Helper to detect if running in standalone mode (iOS)
const isInStandaloneMode = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canShowInstructions, setCanShowInstructions] = useState(false)

  useEffect(() => {
    // Check if already installed (PWA or standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isIOSStandalone = (window.navigator as any).standalone === true

    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true)
      // Clear the flag that tracks if we've shown install before
      localStorage.removeItem('pwa-install-available')
      return
    }

    // If not installed, we can potentially show install instructions
    setCanShowInstructions(true)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      // Mark that install prompt is available (for future reference)
      localStorage.setItem('pwa-install-available', 'true')
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      localStorage.setItem('pwa-installed', 'true')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check if previously installed (helps with reinstall scenarios)
    const wasInstalled = localStorage.getItem('pwa-installed') === 'true'

    // If previously installed but not in standalone mode now, user likely uninstalled
    if (wasInstalled && !isStandalone && !isIOSStandalone) {
      // Clear the installed flag so we can show install option again
      localStorage.removeItem('pwa-installed')
      setCanShowInstructions(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return false

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
        setInstallPrompt(null)
        return true
      }
    } catch (error) {
      console.error('Install failed:', error)
    }
    return false
  }

  const isIOSDevice = isIOS()
  const isStandalone = isInStandaloneMode()

  return {
    // Can install if: has prompt OR is iOS OR can show instructions - and not already installed
    canInstall: (!!installPrompt || isIOSDevice || canShowInstructions) && !isInstalled && !isStandalone,
    isInstalled: isInstalled || isStandalone,
    isIOSDevice,
    hasInstallPrompt: !!installPrompt,
    canShowInstructions,
    install,
  }
}
