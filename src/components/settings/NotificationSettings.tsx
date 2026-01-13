import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Bell, BellOff, Check, X, Loader2 } from 'lucide-react'
import {
  getNotificationPreferences,
  cacheNotificationPreferences,
  saveNotificationPreferences,
  enableNotifications,
  disableNotifications,
  requestNotificationPermission,
  type NotificationPreferences,
} from '@/services/notifications'
import { sendNotification } from '@/lib/notifications'
import { useToast } from '@/hooks/useToast'

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export function NotificationSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<NotificationPreferences>(getNotificationPreferences())
  const [permissionGranted, setPermissionGranted] = useState(Notification.permission === 'granted')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Listen for permission changes
    const checkPermission = () => {
      setPermissionGranted(Notification.permission === 'granted')
    }

    const interval = setInterval(checkPermission, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission()
    setPermissionGranted(granted)

    if (granted) {
      toast({
        title: 'Permission granted',
        description: 'You can now receive notifications.',
      })
    } else {
      toast({
        title: 'Permission denied',
        description: 'Please enable notifications in your browser settings.',
        variant: 'destructive',
      })
    }
  }

  const handleEnableNotifications = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const success = await enableNotifications(user.uid)

      if (success) {
        const newPrefs = { ...preferences, enabled: true }
        setPreferences(newPrefs)
        cacheNotificationPreferences(newPrefs)

        toast({
          title: 'Notifications enabled',
          description: `You'll receive daily task notifications at ${preferences.time}.`,
        })

        // Send test notification
        sendNotification('Notifications Enabled', {
          body: `You'll receive daily task summaries at ${preferences.time}.`,
        })
      } else {
        toast({
          title: 'Failed to enable notifications',
          description: 'Please check your browser permissions.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error enabling notifications:', error)
      toast({
        title: 'Error',
        description: 'Failed to enable notifications. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisableNotifications = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      await disableNotifications(user.uid)

      const newPrefs = { ...preferences, enabled: false }
      setPreferences(newPrefs)
      cacheNotificationPreferences(newPrefs)

      toast({
        title: 'Notifications disabled',
        description: "You won't receive daily task notifications.",
      })
    } catch (error) {
      console.error('Error disabling notifications:', error)
      toast({
        title: 'Error',
        description: 'Failed to disable notifications. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return

    const newTime = e.target.value
    const newPrefs = { ...preferences, time: newTime }
    setPreferences(newPrefs)
    cacheNotificationPreferences(newPrefs)

    try {
      await saveNotificationPreferences(user.uid, newPrefs)
    } catch (error) {
      console.error('Error saving time:', error)
    }
  }

  const handleDayToggle = async (day: number) => {
    if (!user) return

    const newDays = preferences.days.includes(day)
      ? preferences.days.filter((d) => d !== day)
      : [...preferences.days, day].sort()

    // Don't allow removing all days
    if (newDays.length === 0) {
      toast({
        title: 'Invalid selection',
        description: 'You must select at least one day.',
        variant: 'destructive',
      })
      return
    }

    const newPrefs = { ...preferences, days: newDays }
    setPreferences(newPrefs)
    cacheNotificationPreferences(newPrefs)

    try {
      await saveNotificationPreferences(user.uid, newPrefs)
    } catch (error) {
      console.error('Error saving days:', error)
    }
  }

  const handleTestNotification = async () => {
    try {
      console.log('Test notification requested')
      console.log('Notification permission:', Notification.permission)

      if (Notification.permission !== 'granted') {
        toast({
          title: 'Permission not granted',
          description: 'Please grant notification permission first.',
          variant: 'destructive',
        })
        return
      }

      // Check if service worker is registered
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        console.log('Service worker registrations:', registrations.length)
      }

      sendNotification('🧠 Brain Dumper Test', {
        body: 'If you see this, notifications are working! Daily summaries will look similar.',
        tag: 'test-notification',
        requireInteraction: false,
      })

      toast({
        title: 'Test notification sent',
        description: 'Check if you received the notification!',
      })
    } catch (error) {
      console.error('Test notification error:', error)
      toast({
        title: 'Notification failed',
        description: 'Check console for details.',
        variant: 'destructive',
      })
    }
  }

  const notSupported = !('Notification' in window)

  if (notSupported) {
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
          Daily Task Notifications
        </CardTitle>
        <CardDescription>
          Get a daily summary of your scheduled tasks with Morning/Afternoon/Evening indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="space-y-2">
          <Label>Permission Status</Label>
          <div className="flex items-center gap-2">
            {permissionGranted ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">Granted</span>
              </div>
            ) : Notification.permission === 'denied' ? (
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
        {permissionGranted && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Task Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily summary of today's tasks plus overdue items
                </p>
              </div>
              <Button
                variant={preferences.enabled ? 'default' : 'outline'}
                size="sm"
                onClick={preferences.enabled ? handleDisableNotifications : handleEnableNotifications}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : preferences.enabled ? (
                  'Enabled'
                ) : (
                  'Disabled'
                )}
              </Button>
            </div>

            {preferences.enabled && (
              <>
                {/* Notification Time */}
                <div className="space-y-2">
                  <Label htmlFor="notification-time">Notification Time</Label>
                  <Input
                    id="notification-time"
                    type="time"
                    value={preferences.time}
                    onChange={handleTimeChange}
                    className="w-40"
                  />
                  <p className="text-xs text-muted-foreground">
                    You'll receive your daily task summary at this time (local time)
                  </p>
                </div>

                {/* Days of Week */}
                <div className="space-y-3">
                  <Label>Notify on these days</Label>
                  <div className="flex gap-2">
                    {DAYS.map((day) => (
                      <div key={day.value} className="flex flex-col items-center gap-1">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={preferences.days.includes(day.value)}
                          onCheckedChange={() => handleDayToggle(day.value)}
                        />
                        <Label
                          htmlFor={`day-${day.value}`}
                          className="text-xs cursor-pointer"
                        >
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which days you want to receive notifications
                  </p>
                </div>

                {/* Test Notification */}
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

        {/* Information Box */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium text-sm mb-2">How Notifications Work</h4>
          <p className="text-xs text-muted-foreground mb-3">
            <strong>Test Notification:</strong> Tests browser notifications (works immediately)
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            <strong>Daily Notifications:</strong> Require Cloud Function deployment (see NOTIFICATIONS_CLOUD_FUNCTION_SETUP.md)
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Daily notifications will show:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Today's scheduled tasks organized by Morning/Afternoon/Evening</li>
            <li>Overdue tasks from previous days</li>
            <li>One line per task for easy reading</li>
            <li>Clicking opens the app to your scheduled tasks view</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
