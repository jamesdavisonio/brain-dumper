import { vi } from 'vitest'

// Types for Google Calendar API responses
export interface GoogleCalendarListEntry {
  kind: 'calendar#calendarListEntry'
  etag: string
  id: string
  summary: string
  description?: string
  location?: string
  timeZone: string
  summaryOverride?: string
  colorId?: string
  backgroundColor?: string
  foregroundColor?: string
  hidden?: boolean
  selected?: boolean
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
  defaultReminders?: Array<{
    method: 'email' | 'popup'
    minutes: number
  }>
  notificationSettings?: {
    notifications: Array<{
      type: string
      method: string
    }>
  }
  primary?: boolean
  deleted?: boolean
  conferenceProperties?: {
    allowedConferenceSolutionTypes: string[]
  }
}

export interface GoogleCalendarList {
  kind: 'calendar#calendarList'
  etag: string
  nextPageToken?: string
  nextSyncToken?: string
  items: GoogleCalendarListEntry[]
}

export interface GoogleCalendarEvent {
  kind: 'calendar#event'
  etag: string
  id: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink: string
  created: string
  updated: string
  summary?: string
  description?: string
  location?: string
  colorId?: string
  creator: {
    id?: string
    email?: string
    displayName?: string
    self?: boolean
  }
  organizer: {
    id?: string
    email?: string
    displayName?: string
    self?: boolean
  }
  start: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  end: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  endTimeUnspecified?: boolean
  recurrence?: string[]
  recurringEventId?: string
  originalStartTime?: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  transparency?: 'opaque' | 'transparent'
  visibility?: 'default' | 'public' | 'private' | 'confidential'
  iCalUID: string
  sequence: number
  attendees?: Array<{
    id?: string
    email?: string
    displayName?: string
    organizer?: boolean
    self?: boolean
    resource?: boolean
    optional?: boolean
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
    comment?: string
    additionalGuests?: number
  }>
  hangoutLink?: string
  conferenceData?: {
    createRequest?: {
      requestId: string
      conferenceSolutionKey: {
        type: string
      }
      status: {
        statusCode: string
      }
    }
    entryPoints?: Array<{
      entryPointType: string
      uri: string
      label?: string
      pin?: string
      accessCode?: string
      meetingCode?: string
      passcode?: string
      password?: string
    }>
    conferenceSolution?: {
      key: {
        type: string
      }
      name: string
      iconUri: string
    }
    conferenceId?: string
    signature?: string
    notes?: string
  }
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: 'email' | 'popup'
      minutes: number
    }>
  }
}

export interface GoogleCalendarEventList {
  kind: 'calendar#events'
  etag: string
  summary: string
  description?: string
  updated: string
  timeZone: string
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
  defaultReminders?: Array<{
    method: 'email' | 'popup'
    minutes: number
  }>
  nextPageToken?: string
  nextSyncToken?: string
  items: GoogleCalendarEvent[]
}

export interface GoogleCalendarFreeBusyResponse {
  kind: 'calendar#freeBusy'
  timeMin: string
  timeMax: string
  calendars: {
    [calendarId: string]: {
      busy: Array<{
        start: string
        end: string
      }>
      errors?: Array<{
        domain: string
        reason: string
      }>
    }
  }
}

// Mock data generators
export const createMockCalendarListEntry = (
  overrides: Partial<GoogleCalendarListEntry> = {}
): GoogleCalendarListEntry => ({
  kind: 'calendar#calendarListEntry',
  etag: `"${Date.now()}"`,
  id: `calendar-${Date.now()}@group.calendar.google.com`,
  summary: 'Test Calendar',
  timeZone: 'America/New_York',
  accessRole: 'owner',
  backgroundColor: '#9fe1e7',
  foregroundColor: '#000000',
  selected: true,
  defaultReminders: [
    { method: 'popup', minutes: 30 },
  ],
  ...overrides,
})

export const createMockCalendarList = (
  calendars: Partial<GoogleCalendarListEntry>[] = []
): GoogleCalendarList => {
  const items = calendars.length > 0
    ? calendars.map((c) => createMockCalendarListEntry(c))
    : [
        createMockCalendarListEntry({
          id: 'primary',
          summary: 'Primary Calendar',
          primary: true,
          accessRole: 'owner',
        }),
        createMockCalendarListEntry({
          id: 'work@group.calendar.google.com',
          summary: 'Work',
          accessRole: 'owner',
        }),
        createMockCalendarListEntry({
          id: 'personal@group.calendar.google.com',
          summary: 'Personal',
          accessRole: 'writer',
        }),
      ]

  return {
    kind: 'calendar#calendarList',
    etag: `"${Date.now()}"`,
    nextSyncToken: 'mock-sync-token',
    items,
  }
}

export const createMockCalendarEvent = (
  overrides: Partial<GoogleCalendarEvent> = {}
): GoogleCalendarEvent => {
  const now = new Date()
  const startTime = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // 1 hour duration

  return {
    kind: 'calendar#event',
    etag: `"${Date.now()}"`,
    id: `event-${Date.now()}`,
    status: 'confirmed',
    htmlLink: 'https://www.google.com/calendar/event?eid=mock',
    created: now.toISOString(),
    updated: now.toISOString(),
    summary: 'Test Event',
    creator: {
      email: 'test@example.com',
      self: true,
    },
    organizer: {
      email: 'test@example.com',
      self: true,
    },
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/New_York',
    },
    iCalUID: `${Date.now()}@google.com`,
    sequence: 0,
    reminders: {
      useDefault: true,
    },
    ...overrides,
  }
}

export const createMockEventList = (
  events: Partial<GoogleCalendarEvent>[] = []
): GoogleCalendarEventList => {
  const items = events.length > 0
    ? events.map((e) => createMockCalendarEvent(e))
    : [
        createMockCalendarEvent({
          summary: 'Team Meeting',
          description: 'Weekly team sync',
        }),
        createMockCalendarEvent({
          summary: 'Lunch',
          start: {
            dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          },
          end: {
            dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
        }),
      ]

  return {
    kind: 'calendar#events',
    etag: `"${Date.now()}"`,
    summary: 'Test Calendar',
    updated: new Date().toISOString(),
    timeZone: 'America/New_York',
    accessRole: 'owner',
    defaultReminders: [
      { method: 'popup', minutes: 30 },
    ],
    nextSyncToken: 'mock-events-sync-token',
    items,
  }
}

export const createMockFreeBusyResponse = (
  calendarIds: string[] = ['primary'],
  busyPeriods: Array<{ start: Date; end: Date }> = []
): GoogleCalendarFreeBusyResponse => {
  const now = new Date()
  const calendars: GoogleCalendarFreeBusyResponse['calendars'] = {}

  calendarIds.forEach((id) => {
    calendars[id] = {
      busy: busyPeriods.map((period) => ({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      })),
    }
  })

  return {
    kind: 'calendar#freeBusy',
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
    calendars,
  }
}

// Mock API functions
export const mockGoogleCalendarApi = {
  calendarList: {
    list: vi.fn(() => Promise.resolve({ result: createMockCalendarList() })),
    get: vi.fn((calendarId: string) =>
      Promise.resolve({
        result: createMockCalendarListEntry({ id: calendarId }),
      })
    ),
  },
  events: {
    list: vi.fn(() => Promise.resolve({ result: createMockEventList() })),
    get: vi.fn((calendarId: string, eventId: string) =>
      Promise.resolve({
        result: createMockCalendarEvent({ id: eventId }),
      })
    ),
    insert: vi.fn((calendarId: string, event: Partial<GoogleCalendarEvent>) =>
      Promise.resolve({
        result: createMockCalendarEvent(event),
      })
    ),
    update: vi.fn(
      (calendarId: string, eventId: string, event: Partial<GoogleCalendarEvent>) =>
        Promise.resolve({
          result: createMockCalendarEvent({ ...event, id: eventId }),
        })
    ),
    delete: vi.fn(() => Promise.resolve({})),
  },
  freebusy: {
    query: vi.fn(() =>
      Promise.resolve({
        result: createMockFreeBusyResponse(),
      })
    ),
  },
}

// Mock gapi client
export const mockGapiClient = {
  calendar: mockGoogleCalendarApi,
  init: vi.fn(() => Promise.resolve()),
  load: vi.fn((api: string, callback: () => void) => {
    callback()
  }),
}

// Mock gapi auth
export const mockGapiAuth = {
  getAuthInstance: vi.fn(() => ({
    isSignedIn: {
      get: vi.fn(() => true),
      listen: vi.fn(),
    },
    signIn: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    currentUser: {
      get: vi.fn(() => ({
        getAuthResponse: vi.fn(() => ({
          access_token: 'mock-access-token',
          id_token: 'mock-id-token',
          expires_at: Date.now() + 3600000,
        })),
        getBasicProfile: vi.fn(() => ({
          getId: vi.fn(() => 'mock-user-id'),
          getEmail: vi.fn(() => 'test@example.com'),
          getName: vi.fn(() => 'Test User'),
          getImageUrl: vi.fn(() => 'https://example.com/photo.jpg'),
        })),
      })),
    },
  })),
}

// Mock gapi
export const mockGapi = {
  client: mockGapiClient,
  auth2: mockGapiAuth,
  load: vi.fn(
    (api: string, options: { callback: () => void }) => {
      if (options.callback) {
        options.callback()
      }
    }
  ),
}

// Helper to setup window.gapi mock
export const setupGapiMock = () => {
  ;(window as unknown as { gapi: typeof mockGapi }).gapi = mockGapi
}

// Reset all Google Calendar mocks
export const resetGoogleCalendarMocks = () => {
  mockGoogleCalendarApi.calendarList.list.mockClear()
  mockGoogleCalendarApi.calendarList.get.mockClear()
  mockGoogleCalendarApi.events.list.mockClear()
  mockGoogleCalendarApi.events.get.mockClear()
  mockGoogleCalendarApi.events.insert.mockClear()
  mockGoogleCalendarApi.events.update.mockClear()
  mockGoogleCalendarApi.events.delete.mockClear()
  mockGoogleCalendarApi.freebusy.query.mockClear()
  mockGapiClient.init.mockClear()
  mockGapiClient.load.mockClear()
}
