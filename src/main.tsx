import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Register service workers for PWA and Firebase Messaging
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register PWA service worker for caching
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('SW registered:', registration)
    }).catch((error) => {
      console.log('SW registration failed:', error)
    })

    // Register Firebase Messaging service worker for notifications
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then((registration) => {
      console.log('Firebase Messaging SW registered:', registration)
    }).catch((error) => {
      console.log('Firebase Messaging SW registration failed:', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
