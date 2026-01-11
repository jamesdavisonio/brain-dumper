export interface NotificationPermissionStatus {
  granted: boolean
  denied: boolean
  prompt: boolean
  supported: boolean
}

export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  const supported = 'Notification' in window && 'serviceWorker' in navigator

  if (!supported) {
    return {
      granted: false,
      denied: false,
      prompt: false,
      supported: false,
    }
  }

  const permission = Notification.permission

  return {
    granted: permission === 'granted',
    denied: permission === 'denied',
    prompt: permission === 'default',
    supported: true,
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications')
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  return await Notification.requestPermission()
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return
  }

  try {
    new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options,
    })
  } catch (error) {
    console.error('Failed to send notification:', error)
  }
}

export interface DailySummaryData {
  totalTasks: number
  completedTasks: number
  dueTodayTasks: number
  overdueTasksCount: number
}

export function scheduleDailySummary(data: DailySummaryData): void {
  const { totalTasks, completedTasks, dueTodayTasks, overdueTasksCount } = data

  let body = ''

  if (dueTodayTasks > 0) {
    body += `${dueTodayTasks} task${dueTodayTasks > 1 ? 's' : ''} due today. `
  }

  if (overdueTasksCount > 0) {
    body += `${overdueTasksCount} overdue. `
  }

  if (completedTasks > 0) {
    body += `✓ ${completedTasks}/${totalTasks} completed.`
  } else {
    body += `${totalTasks} active task${totalTasks > 1 ? 's' : ''}.`
  }

  sendNotification('Daily Task Summary', {
    body: body.trim(),
    tag: 'daily-summary',
    requireInteraction: false,
  })
}

export function checkAndScheduleDailySummary(data: DailySummaryData): void {
  // Check if notifications are enabled
  const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true'
  const dailySummaryEnabled = localStorage.getItem('dailySummaryEnabled') === 'true'

  if (!notificationsEnabled || !dailySummaryEnabled) {
    return
  }

  // Check if we've already sent today's summary
  const lastSummaryDate = localStorage.getItem('lastSummaryDate')
  const today = new Date().toISOString().split('T')[0]

  if (lastSummaryDate === today) {
    return
  }

  // Get the configured time for daily summary (default to 9:00 AM)
  const summaryTime = localStorage.getItem('dailySummaryTime') || '09:00'
  const [hours, minutes] = summaryTime.split(':').map(Number)

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  // Check if it's time for the summary (within 5-minute window)
  const isTime =
    currentHour === hours &&
    currentMinute >= minutes &&
    currentMinute < minutes + 5

  if (isTime) {
    scheduleDailySummary(data)
    localStorage.setItem('lastSummaryDate', today)
  }
}
