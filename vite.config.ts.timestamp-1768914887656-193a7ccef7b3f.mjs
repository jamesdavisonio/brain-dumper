// vite.config.ts
import { defineConfig } from "file:///sessions/modest-sharp-bardeen/mnt/brain-dumper/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/modest-sharp-bardeen/mnt/brain-dumper/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { writeFileSync } from "fs";
var __vite_injected_original_dirname = "/sessions/modest-sharp-bardeen/mnt/brain-dumper";
var generateFirebaseServiceWorker = () => ({
  name: "generate-firebase-sw",
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
`;
    writeFileSync(path.resolve(__vite_injected_original_dirname, "public/firebase-messaging-sw.js"), swContent);
    console.log("\u2713 Generated firebase-messaging-sw.js with environment variables");
  }
});
var vite_config_default = defineConfig({
  plugins: [
    react(),
    generateFirebaseServiceWorker()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvbW9kZXN0LXNoYXJwLWJhcmRlZW4vbW50L2JyYWluLWR1bXBlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL21vZGVzdC1zaGFycC1iYXJkZWVuL21udC9icmFpbi1kdW1wZXIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL21vZGVzdC1zaGFycC1iYXJkZWVuL21udC9icmFpbi1kdW1wZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IHdyaXRlRmlsZVN5bmMgfSBmcm9tICdmcydcblxuLy8gUGx1Z2luIHRvIGdlbmVyYXRlIGZpcmViYXNlLW1lc3NhZ2luZy1zdy5qcyB3aXRoIGVudiB2YXJpYWJsZXNcbmNvbnN0IGdlbmVyYXRlRmlyZWJhc2VTZXJ2aWNlV29ya2VyID0gKCkgPT4gKHtcbiAgbmFtZTogJ2dlbmVyYXRlLWZpcmViYXNlLXN3JyxcbiAgYnVpbGRTdGFydCgpIHtcbiAgICBjb25zdCBzd0NvbnRlbnQgPSBgLy8gRmlyZWJhc2UgQ2xvdWQgTWVzc2FnaW5nIFNlcnZpY2UgV29ya2VyXG4vLyBBdXRvLWdlbmVyYXRlZCBmcm9tIHZpdGUuY29uZmlnLnRzIC0gRE8gTk9UIEVESVQgTUFOVUFMTFlcblxuLy8gSW1wb3J0IEZpcmViYXNlIHNjcmlwdHMgZm9yIHNlcnZpY2Ugd29ya2VyXG5pbXBvcnRTY3JpcHRzKCdodHRwczovL3d3dy5nc3RhdGljLmNvbS9maXJlYmFzZWpzLzEwLjE0LjEvZmlyZWJhc2UtYXBwLWNvbXBhdC5qcycpXG5pbXBvcnRTY3JpcHRzKCdodHRwczovL3d3dy5nc3RhdGljLmNvbS9maXJlYmFzZWpzLzEwLjE0LjEvZmlyZWJhc2UtbWVzc2FnaW5nLWNvbXBhdC5qcycpXG5cbi8vIEluaXRpYWxpemUgRmlyZWJhc2UgaW4gdGhlIHNlcnZpY2Ugd29ya2VyXG5maXJlYmFzZS5pbml0aWFsaXplQXBwKHtcbiAgYXBpS2V5OiAnJHtwcm9jZXNzLmVudi5WSVRFX0ZJUkVCQVNFX0FQSV9LRVl9JyxcbiAgYXV0aERvbWFpbjogJyR7cHJvY2Vzcy5lbnYuVklURV9GSVJFQkFTRV9BVVRIX0RPTUFJTn0nLFxuICBwcm9qZWN0SWQ6ICcke3Byb2Nlc3MuZW52LlZJVEVfRklSRUJBU0VfUFJPSkVDVF9JRH0nLFxuICBzdG9yYWdlQnVja2V0OiAnJHtwcm9jZXNzLmVudi5WSVRFX0ZJUkVCQVNFX1NUT1JBR0VfQlVDS0VUfScsXG4gIG1lc3NhZ2luZ1NlbmRlcklkOiAnJHtwcm9jZXNzLmVudi5WSVRFX0ZJUkVCQVNFX01FU1NBR0lOR19TRU5ERVJfSUR9JyxcbiAgYXBwSWQ6ICcke3Byb2Nlc3MuZW52LlZJVEVfRklSRUJBU0VfQVBQX0lEfSdcbn0pXG5cbmNvbnN0IG1lc3NhZ2luZyA9IGZpcmViYXNlLm1lc3NhZ2luZygpXG5cbi8vIEhhbmRsZSBiYWNrZ3JvdW5kIG1lc3NhZ2VzXG5tZXNzYWdpbmcub25CYWNrZ3JvdW5kTWVzc2FnZSgocGF5bG9hZCkgPT4ge1xuICBjb25zb2xlLmxvZygnUmVjZWl2ZWQgYmFja2dyb3VuZCBtZXNzYWdlOicsIHBheWxvYWQpXG5cbiAgY29uc3Qgbm90aWZpY2F0aW9uVGl0bGUgPSBwYXlsb2FkLm5vdGlmaWNhdGlvbj8udGl0bGUgfHwgJ0JyYWluIER1bXBlcidcbiAgY29uc3Qgbm90aWZpY2F0aW9uT3B0aW9ucyA9IHtcbiAgICBib2R5OiBwYXlsb2FkLm5vdGlmaWNhdGlvbj8uYm9keSB8fCAnWW91IGhhdmUgbmV3IHRhc2tzJyxcbiAgICBpY29uOiAnL2ljb24tMTkyeDE5Mi5wbmcnLFxuICAgIGJhZGdlOiAnL2Zhdmljb24tMzJ4MzIucG5nJyxcbiAgICB0YWc6ICdkYWlseS10YXNrcycsXG4gICAgcmVxdWlyZUludGVyYWN0aW9uOiBmYWxzZSxcbiAgICBkYXRhOiB7XG4gICAgICB1cmw6IHBheWxvYWQuZGF0YT8udXJsIHx8ICcvc2NoZWR1bGUnLFxuICAgIH0sXG4gIH1cblxuICBzZWxmLnJlZ2lzdHJhdGlvbi5zaG93Tm90aWZpY2F0aW9uKG5vdGlmaWNhdGlvblRpdGxlLCBub3RpZmljYXRpb25PcHRpb25zKVxufSlcblxuLy8gSGFuZGxlIG5vdGlmaWNhdGlvbiBjbGlja3NcbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbm90aWZpY2F0aW9uY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgZXZlbnQubm90aWZpY2F0aW9uLmNsb3NlKClcblxuICBjb25zdCB1cmxUb09wZW4gPSBldmVudC5ub3RpZmljYXRpb24uZGF0YT8udXJsIHx8ICcvc2NoZWR1bGUnXG5cbiAgZXZlbnQud2FpdFVudGlsKFxuICAgIGNsaWVudHMubWF0Y2hBbGwoeyB0eXBlOiAnd2luZG93JywgaW5jbHVkZVVuY29udHJvbGxlZDogdHJ1ZSB9KS50aGVuKChjbGllbnRMaXN0KSA9PiB7XG4gICAgICAvLyBDaGVjayBpZiB0aGVyZSdzIGFscmVhZHkgYSB3aW5kb3cgb3BlblxuICAgICAgZm9yIChjb25zdCBjbGllbnQgb2YgY2xpZW50TGlzdCkge1xuICAgICAgICBpZiAoY2xpZW50LnVybC5pbmNsdWRlcyh1cmxUb09wZW4pICYmICdmb2N1cycgaW4gY2xpZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGNsaWVudC5mb2N1cygpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9wZW4gYSBuZXcgd2luZG93XG4gICAgICBpZiAoY2xpZW50cy5vcGVuV2luZG93KSB7XG4gICAgICAgIHJldHVybiBjbGllbnRzLm9wZW5XaW5kb3codXJsVG9PcGVuKVxuICAgICAgfVxuICAgIH0pXG4gIClcbn0pXG5gXG4gICAgd3JpdGVGaWxlU3luYyhwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAncHVibGljL2ZpcmViYXNlLW1lc3NhZ2luZy1zdy5qcycpLCBzd0NvbnRlbnQpXG4gICAgY29uc29sZS5sb2coJ1x1MjcxMyBHZW5lcmF0ZWQgZmlyZWJhc2UtbWVzc2FnaW5nLXN3LmpzIHdpdGggZW52aXJvbm1lbnQgdmFyaWFibGVzJylcbiAgfVxufSlcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgZ2VuZXJhdGVGaXJlYmFzZVNlcnZpY2VXb3JrZXIoKVxuICBdLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICB2ZW5kb3I6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgICBmaXJlYmFzZTogWydmaXJlYmFzZS9hcHAnLCAnZmlyZWJhc2UvYXV0aCcsICdmaXJlYmFzZS9maXJlc3RvcmUnXSxcbiAgICAgICAgICBkbmQ6IFsnQGRuZC1raXQvY29yZScsICdAZG5kLWtpdC9zb3J0YWJsZScsICdAZG5kLWtpdC91dGlsaXRpZXMnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQStULFNBQVMsb0JBQW9CO0FBQzVWLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFIOUIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTSxnQ0FBZ0MsT0FBTztBQUFBLEVBQzNDLE1BQU07QUFBQSxFQUNOLGFBQWE7QUFDWCxVQUFNLFlBQVk7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFTVCxRQUFRLElBQUkscUJBQXFCO0FBQUEsaUJBQzdCLFFBQVEsSUFBSSx5QkFBeUI7QUFBQSxnQkFDdEMsUUFBUSxJQUFJLHdCQUF3QjtBQUFBLG9CQUNoQyxRQUFRLElBQUksNEJBQTRCO0FBQUEsd0JBQ3BDLFFBQVEsSUFBSSxpQ0FBaUM7QUFBQSxZQUN6RCxRQUFRLElBQUksb0JBQW9CO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBOEN4QyxrQkFBYyxLQUFLLFFBQVEsa0NBQVcsaUNBQWlDLEdBQUcsU0FBUztBQUNuRixZQUFRLElBQUksc0VBQWlFO0FBQUEsRUFDL0U7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLDhCQUE4QjtBQUFBLEVBQ2hDO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixRQUFRLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ2pELFVBQVUsQ0FBQyxnQkFBZ0IsaUJBQWlCLG9CQUFvQjtBQUFBLFVBQ2hFLEtBQUssQ0FBQyxpQkFBaUIscUJBQXFCLG9CQUFvQjtBQUFBLFFBQ2xFO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
