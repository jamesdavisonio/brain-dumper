/**
 * A simplified hook for checking calendar connection status
 * Use this when you only need connection-related functionality
 * @module hooks/useCalendarConnection
 */

import { useCalendar } from '@/context/CalendarContext'

/**
 * Return type for the useCalendarConnection hook
 */
export interface CalendarConnectionState {
  /** Whether a calendar is currently connected */
  isConnected: boolean
  /** Whether a connection attempt is in progress */
  isConnecting: boolean
  /** Any connection error that occurred */
  connectionError: string | null
  /** Email of the connected Google account */
  connectedEmail: string | null
  /** When the calendar was connected */
  connectedAt: Date | null
  /** Function to initiate calendar connection */
  connect: () => Promise<void>
  /** Function to disconnect the calendar */
  disconnect: () => Promise<void>
}

/**
 * A simplified hook for calendar connection status and actions
 * This hook provides only the connection-related parts of the calendar context,
 * which is useful for components that only need to check or manage connection state.
 *
 * @example
 * ```tsx
 * function CalendarConnectButton() {
 *   const { isConnected, isConnecting, connect, disconnect } = useCalendarConnection();
 *
 *   if (isConnected) {
 *     return <button onClick={disconnect}>Disconnect</button>;
 *   }
 *
 *   return (
 *     <button onClick={connect} disabled={isConnecting}>
 *       {isConnecting ? 'Connecting...' : 'Connect Calendar'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @returns CalendarConnectionState - Connection status and actions
 * @throws Error if used outside of CalendarProvider
 */
export function useCalendarConnection(): CalendarConnectionState {
  const {
    isConnected,
    isConnecting,
    connectionError,
    connectedEmail,
    connectedAt,
    connect,
    disconnect,
  } = useCalendar()

  return {
    isConnected,
    isConnecting,
    connectionError,
    connectedEmail,
    connectedAt,
    connect,
    disconnect,
  }
}
