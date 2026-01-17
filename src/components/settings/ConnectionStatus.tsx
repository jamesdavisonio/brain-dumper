import { cn } from '@/lib/utils'

export interface ConnectionStatusProps {
  isConnected: boolean
  connectedEmail?: string
  connectedAt?: Date
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }
  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  }
  return 'Just now'
}

export function ConnectionStatus({
  isConnected,
  connectedEmail,
  connectedAt,
}: ConnectionStatusProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Status Indicator Dot */}
      <div
        className={cn(
          'mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0',
          isConnected ? 'bg-green-500' : 'bg-gray-400'
        )}
        aria-hidden="true"
      />

      {/* Status Text */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={cn(
            'text-sm font-medium',
            isConnected ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          )}
        >
          {isConnected ? 'Connected' : 'Not connected'}
        </span>

        {isConnected && connectedEmail && (
          <span
            className="text-sm text-muted-foreground truncate"
            title={connectedEmail}
          >
            {connectedEmail}
          </span>
        )}

        {isConnected && connectedAt && (
          <span className="text-xs text-muted-foreground">
            Connected {formatRelativeTime(connectedAt)}
          </span>
        )}

        {!isConnected && (
          <span className="text-sm text-muted-foreground">
            Connect your Google Calendar to automatically schedule tasks.
          </span>
        )}
      </div>
    </div>
  )
}
