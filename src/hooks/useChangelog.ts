import { useState, useEffect } from 'react'
import { CURRENT_VERSION } from '@/data/changelog'

const SEEN_VERSION_KEY = 'brain-dumper-seen-version'

export function useChangelog() {
  const [showModal, setShowModal] = useState(false)
  const [hasNewChanges, setHasNewChanges] = useState(false)

  useEffect(() => {
    const seenVersion = localStorage.getItem(SEEN_VERSION_KEY)
    if (seenVersion !== CURRENT_VERSION) {
      setHasNewChanges(true)
      setShowModal(true)
    }
  }, [])

  const dismissChangelog = () => {
    localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION)
    setShowModal(false)
    setHasNewChanges(false)
  }

  return { showModal, hasNewChanges, dismissChangelog, setShowModal }
}
