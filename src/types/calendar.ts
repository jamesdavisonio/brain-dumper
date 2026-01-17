/**
 * Calendar and event types for Brain Dumper scheduling features
 * @module types/calendar
 */

/**
 * Represents a connected calendar from an external provider (e.g., Google Calendar)
 */
export interface ConnectedCalendar {
  /** Unique identifier for the calendar */
  id: string;
  /** Display name of the calendar */
  name: string;
  /** Whether this is a work or personal calendar */
  type: 'work' | 'personal';
  /** Color used for displaying calendar events */
  color: string;
  /** Whether this is the user's primary calendar */
  primary: boolean;
  /** User's access level for this calendar */
  accessRole: 'reader' | 'writer' | 'owner';
  /** Whether sync is enabled for this calendar */
  enabled: boolean;
  /** Token used for incremental sync with the calendar provider */
  syncToken?: string;
  /** Timestamp of the last successful sync */
  lastSyncAt?: Date;
}

/**
 * Represents a calendar event from an external calendar
 */
export interface CalendarEvent {
  /** Unique identifier for the event */
  id: string;
  /** ID of the calendar this event belongs to */
  calendarId: string;
  /** Title/summary of the event */
  title: string;
  /** Optional description or notes for the event */
  description?: string;
  /** Start time of the event */
  start: Date;
  /** End time of the event */
  end: Date;
  /** Whether this is an all-day event */
  allDay: boolean;
  /** Confirmation status of the event */
  status: 'confirmed' | 'tentative' | 'cancelled';
  /** ID of the Brain Dumper task this event is linked to, if any */
  brainDumperTaskId?: string;
  /** If this event is a buffer, indicates whether it's before or after the main event */
  brainDumperBufferType?: 'before' | 'after';
  /** ID of the recurring event series this belongs to, if applicable */
  recurringEventId?: string;
  /** Link to view the event in the external calendar */
  htmlLink?: string;
}

/**
 * Represents a time slot for scheduling purposes
 */
export interface TimeSlot {
  /** Start time of the slot */
  start: Date;
  /** End time of the slot */
  end: Date;
  /** Whether this slot is available for scheduling */
  available: boolean;
  /** ID of the calendar this slot is from, if occupied */
  calendarId?: string;
  /** ID of the event occupying this slot, if any */
  eventId?: string;
}

/**
 * Represents availability information for a specific date
 */
export interface AvailabilityWindow {
  /** The date this availability window is for */
  date: Date;
  /** Time slots within this window */
  slots: TimeSlot[];
  /** Total free minutes available on this date */
  totalFreeMinutes: number;
  /** Total busy minutes on this date */
  totalBusyMinutes: number;
}

/**
 * Represents the current sync status with external calendars
 */
export interface CalendarSyncStatus {
  /** Timestamp of the last sync attempt */
  lastSyncAt: Date;
  /** Current sync status */
  status: 'synced' | 'syncing' | 'error' | 'pending';
  /** Error message if sync failed */
  error?: string;
  /** Number of events created in the last sync */
  eventsCreated: number;
  /** Number of events updated in the last sync */
  eventsUpdated: number;
  /** Number of events deleted in the last sync */
  eventsDeleted: number;
}

/**
 * OAuth connection state for calendar providers
 */
export interface OAuthState {
  /** Whether the user has connected their calendar */
  isConnected: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Error message if connection failed */
  error: string | null;
  /** Timestamp when the connection was established */
  connectedAt?: Date;
}

/**
 * OAuth tokens for calendar provider authentication
 * Note: These should be stored securely and never exposed to the client
 */
export interface OAuthTokens {
  /** Access token for API requests */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Expiration time of the access token */
  expiresAt: Date;
  /** OAuth scope granted */
  scope: string;
}
