# Firebase Messaging Service Worker

## ⚠️ Important: Auto-Generated File

The `firebase-messaging-sw.js` file in this directory is **automatically generated** at build time by the Vite build process.

### How It Works

1. **Template**: The checked-in version has placeholder values
2. **Build Time**: During `npm run build` or `npm run dev`, the Vite plugin in `vite.config.ts` generates a new version with real Firebase config values from environment variables
3. **Git Ignore**: The generated file is ignored by Git (see `.gitignore`)

### Environment Variables Used

The following environment variables are injected into the service worker at build time:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Editing the Service Worker

**DO NOT** edit `firebase-messaging-sw.js` directly. Instead:

1. Edit the `generateFirebaseServiceWorker()` function in `vite.config.ts`
2. Modify the template string to add/change functionality
3. The file will be regenerated on the next build

### Local Development

When you run `npm run dev` or `npm run build`, the service worker is automatically generated with your `.env` values. Make sure you have all required environment variables set in your `.env` file.

### GitHub Actions / CI/CD

The GitHub workflows automatically inject the environment variables from GitHub Secrets, so the service worker is generated correctly during deployment.

See:
- `.github/workflows/firebase-deploy.yml`
- `.github/workflows/ci.yml`

### Security

By auto-generating this file:
- ✅ Firebase config never committed to Git
- ✅ Secrets stay in environment variables/GitHub Secrets
- ✅ Each environment (dev, staging, prod) gets the correct config
- ✅ No manual find/replace needed
