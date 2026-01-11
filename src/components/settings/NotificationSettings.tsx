import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Bell, BellOff, Check, X } from 'lucide-react'
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendNotification,
} from '@/lib/notifications'

export function NotificationSettings() {
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermissionStatus())
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('notificationsEnabled') === 'true'
  )
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(
    localStorage.getItem('dailySummaryEnabled') === 'true'
  )
  const [dailySummaryTime, setDailySummaryTime] = useState(
    localStorage.getItem('dailySummaryTime') || '09:00'
  )

  useEffect(() => {
    // Listen for permission changes
    const checkPermission = () => {
      setPermissionStatus(getNotificationPermissionStatus())
    }

    // Check every second (permission can change from browser settings)
    const interval = setInterval(checkPermission, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleRequestPermission = async () => {
    try {
      const result = await requestNotificationPermission()

      if (result === 'granted') {
        setPermissionStatus(getNotificationPermissionStatus())
        setNotificationsEnabled(true)
        localStorage.setItem('notificationsEnabled', 'true')

        // Send test notification
        sendNotification('Notifications Enabled', {
          body: 'You will now receive task reminders and daily summaries.',
        })
      } else if (result === 'denied') {
        setPermissionStatus(getNotificationPermissionStatus())
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error)
    }
  }

  const handleToggleNotifications = () => {
    if (!permissionStatus.granted) {
      handleRequestPermission()
      return
    }

    const newValue = !notificationsEnabled
    setNotificationsEnabled(newValue)
    localStorage.setItem('notificationsEnabled', String(newValue))

    if (newValue) {
      sendNotification('Notifications Enabled', {
        body: 'You will now receive task reminders.',
      })
    }
  }

  const handleToggleDailySummary = () => {
    const newValue = !dailySummaryEnabled
    setDailySummaryEnabled(newValue)
    localStorage.setItem('dailySummaryEnabled', String(newValue))
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    setDailySummaryTime(newTime)
    localStorage.setItem('dailySummaryTime', newTime)
  }

  const handleTestNotification = () => {
    sendNotification('Test Notification', {
      body: 'This is a test notification from Brain Dumper.',
    })
  }

  if (!permissionStatus.supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser or device does not support notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage how and when you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="space-y-2">
          <Label>Permission Status</Label>
          <div className="flex items-center gap-2">
            {permissionStatus.granted ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">Granted</span>
              </div>
            ) : permissionStatus.denied ? (
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-4 w-4" />
                <span className="text-sm">Denied - Enable in browser settings</span>
              </div>
            ) : (
              <Button onClick={handleRequestPermission} size="sm">
                Request Permission
              </Button>
            )}
          </div>
        </div>

        {/* Enable/Disable Notifications */}
        {permissionStatus.granted && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for tasks and reminders
                </p>
              </div>
              <Button
                variant={notificationsEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggleNotifications}
              >
                {notificationsEnabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {notificationsEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Daily Summary</Label>
                    <p className="text-sm text-muted-foreground">
                      Get a daily summary of your tasks
                    </p>
                  </div>
                  <Button
                    variant={dailySummaryEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleToggleDailySummary}
                  >
                    {dailySummaryEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {dailySummaryEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="summary-time">Summary Time</Label>
                    <Input
                      id="summary-time"
                      type="time"
                      value={dailySummaryTime}
                      onChange={handleTimeChange}
                      className="w-40"
                    />
                    <p className="text-xs text-muted-foreground">
                      You'll receive a daily summary at this time
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  className="w-full"
                >
                  Send Test Notification
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
