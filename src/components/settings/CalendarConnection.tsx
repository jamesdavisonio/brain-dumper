import { useState } from 'react'
import { Calendar, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OAuthButton } from './OAuthButton'
import { ConnectionStatus } from './ConnectionStatus'
import { CalendarSelector } from './CalendarSelector'
import { DisconnectDialog } from './DisconnectDialog'
import { useCalendar } from '@/context/CalendarContext'

export function CalendarConnection() {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Use the calendar context
  const {
    isConnected,
    isConnecting,
    connectionError,
    calendars,
    isLoadingCalendars,
    enabledCalendarIds,
    connectedEmail,
    connectedAt,
    connect,
    disconnect,
    toggleCalendar,
    setCalendarType,
  } = useCalendar()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await disconnect()
      setShowDisconnectDialog(false)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleToggleCalendar = async (calendarId: string, enabled: boolean) => {
    try {
      await toggleCalendar(calendarId, enabled)
    } catch (error) {
      console.error('Failed to toggle calendar:', error)
    }
  }

  const handleTypeChange = async (calendarId: string, type: 'work' | 'personal') => {
    try {
      await setCalendarType(calendarId, type)
    } catch (error) {
      console.error('Failed to change calendar type:', error)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Connect your Google Calendar to automatically schedule tasks around your existing events.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error State */}
          {connectionError && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Connection failed
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {connectionError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Not Connected State */}
          {!isConnected && !connectionError && (
            <div className="space-y-4">
              <ConnectionStatus isConnected={false} />
              <OAuthButton
                onClick={handleConnect}
                isLoading={isConnecting}
                disabled={isConnecting}
              />
            </div>
          )}

          {/* Connected State */}
          {isConnected && (
            <div className="space-y-6">
              {/* Connection Status */}
              <ConnectionStatus
                isConnected={true}
                connectedEmail={connectedEmail ?? undefined}
                connectedAt={connectedAt ?? undefined}
              />

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Calendar Selector */}
              <CalendarSelector
                calendars={calendars.map(c => ({
                  id: c.id,
                  name: c.name,
                  color: c.color,
                  isPrimary: c.primary,
                  type: c.type,
                }))}
                enabledIds={enabledCalendarIds}
                onToggle={handleToggleCalendar}
                onTypeChange={handleTypeChange}
                isLoading={isLoadingCalendars}
              />

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Disconnect Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="text-muted-foreground hover:text-destructive hover:border-destructive"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <DisconnectDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
        onConfirm={handleDisconnect}
        isDisconnecting={isDisconnecting}
      />
    </>
  )
}
