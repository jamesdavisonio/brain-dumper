# Brain Dump Task Manager

A productivity app that lets you dump your thoughts and uses AI to organize them into actionable tasks.

## Recent Updates

### UI Improvements (January 2026)
- **Cleaner Input Interface**: Replaced character counter with microphone icon for voice input
- **Mobile-Optimized Navigation**: History button now shows icon-only on mobile devices
- **Simplified Branding**: Updated main heading to "Dump your thoughts" with clearer subtitle
- **Streamlined Processing**: Changed button text from "Process with AI" to "Process"
- **Enhanced Approval Flow**: Added "Review & Approve" title above tasks in approval screen
- **Better Mobile Layout**: Reduced spacing between task content and action buttons for improved mobile experience
- **PWA Icon Fix**: Fixed icon display with proper background color
- **Rebranding**: Updated app name from "Brain Dump" to "Brain Dumper" across the interface

## Features

- **Brain Dump**: Pour out your thoughts in unstructured text
- **AI-Powered Parsing**: Gemini AI extracts tasks, priorities, and projects
- **Task Management**: View tasks in list or timeline format
- **Drag & Drop Scheduling**: Schedule tasks by dragging to calendar days
- **Real-time Sync**: Tasks sync across devices via Firebase
- **Dark Mode**: System-aware theme support

## Tech Stack

- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui
- Firebase (Auth + Firestore)
- Google Gemini AI
- @dnd-kit for drag-and-drop

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase project with Authentication and Firestore enabled
- Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd brain-dump-task-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Fill in your Firebase and Gemini credentials in `.env`:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

5. Start the development server:
```bash
npm run dev
```

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Google Authentication
3. Create a Firestore database
4. Update `.firebaserc` with your project ID
5. Deploy Firestore rules:
```bash
firebase deploy --only firestore:rules
```

## GitHub Actions Deployment

The project includes automatic deployment to Firebase Hosting via GitHub Actions.

### Required Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON
- `FIREBASE_TOKEN` - Firebase CLI token (for Firestore rules deployment)

### Getting Firebase Service Account

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Copy the entire JSON content and add it as `FIREBASE_SERVICE_ACCOUNT` secret

### Getting Firebase Token

```bash
firebase login:ci
```

Copy the token and add it as `FIREBASE_TOKEN` secret.

## Deployment Workflow

- **Pull Requests**: Deploy to a preview channel (expires in 7 days)
- **Push to main/master**: Deploy to production (live channel)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT
