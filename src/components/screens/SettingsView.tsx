import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings } from 'lucide-react'
import { CalendarConnection } from '@/components/settings/CalendarConnection'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { SchedulingPreferences } from '@/components/settings/SchedulingPreferences'
import { useCalendar } from '@/context/CalendarContext'

export function SettingsView() {
  const navigate = useNavigate()
  const { isConnected } = useCalendar()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your Brain Dumper preferences
          </p>
        </div>
      </div>

      {/* Calendar Integration */}
      <CalendarConnection />

      {/* Scheduling Preferences - only show when calendar is connected */}
      {isConnected && <SchedulingPreferences />}

      {/* Notification Settings */}
      <NotificationSettings />
    </div>
  )
}
