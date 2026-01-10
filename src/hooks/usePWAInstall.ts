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

  useEffect(() => {
    // Check if already installed (PWA or standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isIOSStandalone = (window.navigator as any).standalone === true

    if (isStandalone || isInstalled) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

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
    canInstall: (!!installPrompt || isIOSDevice) && !isInstalled && !isStandalone,
    isInstalled: isInstalled || isStandalone,
    isIOSDevice,
    install,
  }
}
