import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

interface NotificationPreferences {
  enabled: boolean;
  time: string; // HH:MM format
  days: number[]; // 0=Sunday, 1=Monday, etc.
  timezone: string;
}

interface Task {
  id: string;
  content: string;
  scheduledDate?: Date;
  scheduledTime?: string; // 'morning' | 'afternoon' | 'evening' or HH:MM
  dueDate?: Date;
  dueTime?: string;
  completed: boolean;
  archived: boolean;
}

/**
 * Scheduled function that runs every hour to check if any users need notifications
 */
export const sendDailyTaskNotifications = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('UTC')
  .onRun(async () => {
    console.log('Starting daily task notifications check...');

    try {
      // Get all users with notification preferences
      const usersSnapshot = await admin.firestore().collection('users').get();

      const now = new Date();
      const promises: Promise<void>[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Check if user has FCM token and notification preferences
        if (!userData.fcmToken || !userData.notificationPreferences) {
          continue;
        }

        const prefs = userData.notificationPreferences as NotificationPreferences;

        // Check if notifications are enabled
        if (!prefs.enabled) {
          continue;
        }

        // Check if today is a notification day
        const userDate = getUserDate(now, prefs.timezone);
        const dayOfWeek = userDate.getDay();

        if (!prefs.days.includes(dayOfWeek)) {
          continue;
        }

        // Check if it's time to send notification (within current hour)
        const [hour] = prefs.time.split(':').map(Number);
        const userHour = userDate.getHours();

        if (userHour === hour) {
          // Time to send notification
          promises.push(sendNotificationToUser(userId, userData.fcmToken, prefs.timezone));
        }
      }

      await Promise.allSettled(promises);
      console.log(`Processed ${promises.length} notifications`);
    } catch (error) {
      console.error('Error in sendDailyTaskNotifications:', error);
    }

    return null;
  });

/**
 * Get the current date/time in the user's timezone
 */
function getUserDate(now: Date, timezone: string): Date {
  const userDateString = now.toLocaleString('en-US', { timeZone: timezone });
  return new Date(userDateString);
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
    const now = new Date();
    const userDate = getUserDate(now, timezone);
    const today = new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate());

    // Fetch user's tasks
    const tasksSnapshot = await admin
      .firestore()
      .collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .where('archived', '==', false)
      .get();

    const tasks: Task[] = tasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      scheduledDate: doc.data().scheduledDate?.toDate(),
      dueDate: doc.data().dueDate?.toDate(),
    })) as Task[];

    // Categorize tasks
    const scheduledToday: Task[] = [];
    const overdueTasks: Task[] = [];

    tasks.forEach((task) => {
      // Check if scheduled for today
      if (task.scheduledDate) {
        const taskDate = new Date(
          task.scheduledDate.getFullYear(),
          task.scheduledDate.getMonth(),
          task.scheduledDate.getDate()
        );
        if (taskDate.getTime() === today.getTime()) {
          scheduledToday.push(task);
        }
      }

      // Check if overdue
      if (task.dueDate) {
        const dueDate = new Date(
          task.dueDate.getFullYear(),
          task.dueDate.getMonth(),
          task.dueDate.getDate()
        );
        if (dueDate.getTime() < today.getTime()) {
          overdueTasks.push(task);
        }
      }
    });

    // Don't send notification if no tasks
    if (scheduledToday.length === 0 && overdueTasks.length === 0) {
      console.log(`No tasks for user ${userId}`);
      return;
    }

    // Build notification message
    const { title, body } = buildNotificationMessage(scheduledToday, overdueTasks);

    // Send FCM notification
    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        url: '/today',
        type: 'daily-tasks',
      },
      android: {
        priority: 'high' as const,
        notification: {
          icon: 'ic_notification',
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
    };

    await admin.messaging().send(message);
    console.log(`Notification sent to user ${userId}`);
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
    // If token is invalid, remove it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorCode = (error as any).code;
    if (errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered') {
      await admin.firestore().collection('users').doc(userId).update({
        fcmToken: admin.firestore.FieldValue.delete(),
      });
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
  const totalCount = scheduledToday.length + overdueTasks.length;
  const title = `You have ${totalCount} task${totalCount > 1 ? 's' : ''} today`;

  const lines: string[] = [];

  // Group scheduled tasks by time of day
  const morning = scheduledToday.filter((t) =>
    t.scheduledTime?.toLowerCase() === 'morning'
  );
  const afternoon = scheduledToday.filter((t) =>
    t.scheduledTime?.toLowerCase() === 'afternoon'
  );
  const evening = scheduledToday.filter((t) =>
    t.scheduledTime?.toLowerCase() === 'evening'
  );
  const noTime = scheduledToday.filter((t) =>
    !t.scheduledTime ||
    !['morning', 'afternoon', 'evening'].includes(t.scheduledTime.toLowerCase())
  );

  if (morning.length > 0) {
    lines.push('Morning:');
    morning.slice(0, 3).forEach((t) => lines.push(`  - ${truncate(t.content, 40)}`));
    if (morning.length > 3) lines.push(`  ... and ${morning.length - 3} more`);
  }

  if (afternoon.length > 0) {
    lines.push('Afternoon:');
    afternoon.slice(0, 3).forEach((t) => lines.push(`  - ${truncate(t.content, 40)}`));
    if (afternoon.length > 3) lines.push(`  ... and ${afternoon.length - 3} more`);
  }

  if (evening.length > 0) {
    lines.push('Evening:');
    evening.slice(0, 3).forEach((t) => lines.push(`  - ${truncate(t.content, 40)}`));
    if (evening.length > 3) lines.push(`  ... and ${evening.length - 3} more`);
  }

  if (noTime.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Today:');
    noTime.slice(0, 3).forEach((t) => lines.push(`  - ${truncate(t.content, 40)}`));
    if (noTime.length > 3) lines.push(`  ... and ${noTime.length - 3} more`);
  }

  // Add overdue tasks
  if (overdueTasks.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`Overdue (${overdueTasks.length}):`);
    overdueTasks.slice(0, 2).forEach((t) => lines.push(`  - ${truncate(t.content, 40)}`));
    if (overdueTasks.length > 2) {
      lines.push(`  ... and ${overdueTasks.length - 2} more`);
    }
  }

  return {
    title,
    body: lines.join('\n'),
  };
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
