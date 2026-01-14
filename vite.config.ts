import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { writeFileSync } from 'fs'

// Plugin to generate firebase-messaging-sw.js with env variables
const generateFirebaseServiceWorker = () => ({
  name: 'generate-firebase-sw',
  buildStart() {
    const swContent = `// Firebase Cloud Messaging Service Worker
// Auto-generated from vite.config.ts - DO NOT EDIT MANUALLY

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: '${process.env.VITE_FIREBASE_API_KEY}',
  authDomain: '${process.env.VITE_FIREBASE_AUTH_DOMAIN}',
  projectId: '${process.env.VITE_FIREBASE_PROJECT_ID}',
  storageBucket: '${process.env.VITE_FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID}',
  appId: '${process.env.VITE_FIREBASE_APP_ID}'
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload)

  const notificationTitle = payload.notification?.title || 'Brain Dumper'
  const notificationOptions = {
    body: payload.notification?.body || 'You have new tasks',
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'daily-tasks',
    requireInteraction: false,
    data: {
      url: payload.data?.url || '/today',
    },
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/today'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
`
    writeFileSync(path.resolve(__dirname, 'public/firebase-messaging-sw.js'), swContent)
    console.log('✓ Generated firebase-messaging-sw.js with environment variables')
  }
})

export default defineConfig({
  plugins: [
    react(),
    generateFirebaseServiceWorker()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
})
