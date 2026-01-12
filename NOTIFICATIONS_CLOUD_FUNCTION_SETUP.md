# Daily Notifications Cloud Function Setup

This document explains how to set up the Cloud Function to send daily task notifications to users.

## Overview

The notification system uses Firebase Cloud Messaging (FCM) to send daily summaries of tasks to users at their configured time. The frontend is already set up - you just need to deploy the Cloud Function.

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase Blaze plan (Cloud Functions require paid plan)
- Firebase project with Cloud Messaging enabled

## Step 1: Initialize Firebase Functions

```bash
cd /path/to/brain-dumper
firebase init functions
```

Select:
- Language: TypeScript
- ESLint: Yes
- Install dependencies: Yes

## Step 2: Install Required Dependencies

```bash
cd functions
npm install firebase-admin firebase-functions
```

## Step 3: Create the Cloud Function

Create `functions/src/index.ts` with the following content:

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

interface NotificationPreferences {
  enabled: boolean
  time: string // HH:MM format
  days: number[] // 0=Sunday, 1=Monday, etc.
  timezone: string
}

interface Task {
  id: string
  content: string
  scheduledDate?: Date
  scheduledTime?: string // 'morning' | 'afternoon' | 'evening' or HH:MM
  dueDate?: Date
  dueTime?: string
  completed: boolean
  archived: boolean
}

/**
 * Scheduled function that runs every hour to check if any users need notifications
 */
export const sendDailyTaskNotifications = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting daily task notifications check...')

    try {
      // Get all users with notification preferences
      const usersSnapshot = await admin.firestore().collection('users').get()

      const now = new Date()
      const promises: Promise<void>[] = []

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data()
        const userId = userDoc.id

        // Check if user has FCM token and notification preferences
        if (!userData.fcmToken || !userData.notificationPreferences) {
          continue
        }

        const prefs = userData.notificationPreferences as NotificationPreferences

        // Check if notifications are enabled
        if (!prefs.enabled) {
          continue
        }

        // Check if today is a notification day
        const userDate = getUserDate(now, prefs.timezone)
        const dayOfWeek = userDate.getDay()

        if (!prefs.days.includes(dayOfWeek)) {
          continue
        }

        // Check if it's time to send notification (within current hour)
        const [hour, minute] = prefs.time.split(':').map(Number)
        const userHour = userDate.getHours()

        if (userHour === hour) {
          // Time to send notification
          promises.push(sendNotificationToUser(userId, userData.fcmToken, prefs.timezone))
        }
      }

      await Promise.allSettled(promises)
      console.log(`Processed ${promises.length} notifications`)
    } catch (error) {
      console.error('Error in sendDailyTaskNotifications:', error)
    }

    return null
  })

/**
 * Get the current date/time in the user's timezone
 */
function getUserDate(now: Date, timezone: string): Date {
  const userDateString = now.toLocaleString('en-US', { timeZone: timezone })
  return new Date(userDateString)
}

/**
 * Send notification to a specific user
 */
async function sendNotificationToUser(
  userId: string,
  fcmToken: string,
  timezone: string
): Promise<void> {
  try {
    // Get today's date in user's timezone
    const now = new Date()
    const userDate = getUserDate(now, timezone)
    const today = new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate())

    // Fetch user's tasks
    const tasksSnapshot = await admin
      .firestore()
      .collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .where('archived', '==', false)
      .get()

    const tasks: Task[] = tasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      scheduledDate: doc.data().scheduledDate?.toDate(),
      dueDate: doc.data().dueDate?.toDate(),
    })) as Task[]

    // Categorize tasks
    const scheduledToday: Task[] = []
    const overdueTasks: Task[] = []

    tasks.forEach((task) => {
      // Check if scheduled for today
      if (task.scheduledDate) {
        const taskDate = new Date(
          task.scheduledDate.getFullYear(),
          task.scheduledDate.getMonth(),
          task.scheduledDate.getDate()
        )
        if (taskDate.getTime() === today.getTime()) {
          scheduledToday.push(task)
        }
      }

      // Check if overdue
      if (task.dueDate) {
        const dueDate = new Date(
          task.dueDate.getFullYear(),
          task.dueDate.getMonth(),
          task.dueDate.getDate()
        )
        if (dueDate.getTime() < today.getTime()) {
          overdueTasks.push(task)
        }
      }
    })

    // Don't send notification if no tasks
    if (scheduledToday.length === 0 && overdueTasks.length === 0) {
      console.log(`No tasks for user ${userId}`)
      return
    }

    // Build notification message
    const { title, body } = buildNotificationMessage(scheduledToday, overdueTasks)

    // Send FCM notification
    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        url: '/schedule',
        type: 'daily-tasks',
      },
      android: {
        priority: 'high' as const,
        notification: {
          icon: '/icon-192x192.png',
          color: '#2563eb',
          tag: 'daily-tasks',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: scheduledToday.length + overdueTasks.length,
          },
        },
      },
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/favicon-32x32.png',
          tag: 'daily-tasks',
          requireInteraction: false,
        },
      },
    }

    await admin.messaging().send(message)
    console.log(`Notification sent to user ${userId}`)
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error)
    // If token is invalid, remove it
    if ((error as any).code === 'messaging/invalid-registration-token' ||
        (error as any).code === 'messaging/registration-token-not-registered') {
      await admin.firestore().collection('users').doc(userId).update({
        fcmToken: admin.firestore.FieldValue.delete(),
      })
    }
  }
}

/**
 * Build notification message from tasks
 */
function buildNotificationMessage(
  scheduledToday: Task[],
  overdueTasks: Task[]
): { title: string; body: string } {
  const totalCount = scheduledToday.length + overdueTasks.length
  const title = `You have ${totalCount} task${totalCount > 1 ? 's' : ''}`

  const lines: string[] = []

  // Group scheduled tasks by time of day
  const morning = scheduledToday.filter((t) => t.scheduledTime === 'Morning' || t.scheduledTime === 'morning')
  const afternoon = scheduledToday.filter((t) => t.scheduledTime === 'Afternoon' || t.scheduledTime === 'afternoon')
  const evening = scheduledToday.filter((t) => t.scheduledTime === 'Evening' || t.scheduledTime === 'evening')
  const noTime = scheduledToday.filter((t) => !t.scheduledTime || (!['Morning', 'Afternoon', 'Evening', 'morning', 'afternoon', 'evening'].includes(t.scheduledTime)))

  if (morning.length > 0) {
    lines.push('🌅 Morning:')
    morning.forEach((t) => lines.push(`  • ${t.content}`))
  }

  if (afternoon.length > 0) {
    lines.push('☀️ Afternoon:')
    afternoon.forEach((t) => lines.push(`  • ${t.content}`))
  }

  if (evening.length > 0) {
    lines.push('🌙 Evening:')
    evening.forEach((t) => lines.push(`  • ${t.content}`))
  }

  if (noTime.length > 0) {
    if (lines.length > 0) lines.push('') // Add separator
    lines.push('📅 Today:')
    noTime.forEach((t) => lines.push(`  • ${t.content}`))
  }

  // Add overdue tasks
  if (overdueTasks.length > 0) {
    if (lines.length > 0) lines.push('') // Add separator
    lines.push(`⚠️ Overdue (${overdueTasks.length}):`)
    overdueTasks.slice(0, 3).forEach((t) => lines.push(`  • ${t.content}`))
    if (overdueTasks.length > 3) {
      lines.push(`  ... and ${overdueTasks.length - 3} more`)
    }
  }

  return {
    title,
    body: lines.join('\n'),
  }
}
```

## Step 4: Update Firebase Configuration

### Add VAPID Key (Web Push Certificate)

1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Under "Web Push certificates", click "Generate Key Pair"
3. Copy the key and add it to your `.env` file:

```env
VITE_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE
```

### Update Service Worker Configuration

Update `public/firebase-messaging-sw.js` with your actual Firebase config values from the Firebase Console.

## Step 5: Deploy the Cloud Function

```bash
# Build the functions
cd functions
npm run build

# Deploy
firebase deploy --only functions
```

## Step 6: Update Firestore Security Rules

Add rules to allow users to update their notification preferences:

```javascript
// In firestore.rules
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Step 7: Test the System

1. Go to Settings in the app
2. Enable Daily Task Notifications
3. Set a time a few minutes from now
4. Create some tasks scheduled for today
5. Wait for the notification

## Monitoring

View Cloud Function logs:

```bash
firebase functions:log
```

Or in Firebase Console → Functions → Logs

## Troubleshooting

### No notifications received

1. Check browser notification permissions
2. Verify FCM token is saved in Firestore (`users/{userId}/fcmToken`)
3. Check Cloud Function logs for errors
4. Verify user has `notificationPreferences.enabled: true`
5. Make sure today is in the selected days

### "Invalid token" errors

The function automatically removes invalid FCM tokens. Users will need to re-enable notifications in Settings.

### Time zone issues

The function converts times to the user's timezone. Make sure the user's timezone is correctly detected (it's auto-detected from their browser).

## Cost Considerations

- Cloud Functions on the Blaze plan: First 2M invocations/month free
- FCM notifications: Free
- Firestore reads: Billed per read operation

With hourly checks, this should be well within the free tier for most use cases.

## Next Steps

- Monitor function performance in Firebase Console
- Adjust schedule frequency if needed (currently every hour)
- Add analytics to track notification engagement
- Consider batching database reads for better performance
