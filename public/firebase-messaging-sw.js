// Firebase Cloud Messaging Service Worker
// Auto-generated from vite.config.ts - DO NOT EDIT MANUALLY
// This file is generated at build time with environment variables

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

// Initialize Firebase in the service worker
// Config is injected at build time from environment variables
firebase.initializeApp({
  apiKey: 'PLACEHOLDER_WILL_BE_REPLACED_AT_BUILD',
  authDomain: 'PLACEHOLDER_WILL_BE_REPLACED_AT_BUILD',
  projectId: 'PLACEHOLDER_WILL_BE_REPLACED_AT_BUILD',
  storageBucket: 'PLACEHOLDER_WILL_BE_REPLACED_AT_BUILD',
  messagingSenderId: 'PLACEHOLDER_WILL_BE_REPLACED_AT_BUILD',
  appId: 'PLACEHOLDER_WILL_BE_REPLACED_AT_BUILD'
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
      url: payload.data?.url || '/schedule',
    },
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/schedule'

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
