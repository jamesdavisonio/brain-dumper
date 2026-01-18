import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  createMockCalendarList,
  createMockEventList,
  createMockFreeBusyResponse,
  type GoogleCalendarEvent,
} from './googleCalendar'

// Google Calendar API Handlers
const googleCalendarHandlers = [
  // Calendar List
  http.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', () => {
    return HttpResponse.json(createMockCalendarList())
  }),

  // Events List
  http.get('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', () => {
    return HttpResponse.json(createMockEventList())
  }),

  // Get Single Event
  http.get(
    'https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId',
    ({ params }) => {
      const { eventId } = params
      return HttpResponse.json({
        kind: 'calendar#event',
        id: eventId,
        summary: 'Test Event',
        status: 'confirmed',
      })
    }
  ),

  // Create Event
  http.post(
    'https://www.googleapis.com/calendar/v3/calendars/:calendarId/events',
    async ({ request }) => {
      const body = (await request.json()) as Partial<GoogleCalendarEvent>
      return HttpResponse.json({
        kind: 'calendar#event',
        id: `created-event-${Date.now()}`,
        status: 'confirmed',
        ...body,
      })
    }
  ),

  // Update Event
  http.put(
    'https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId',
    async ({ params, request }) => {
      const { eventId } = params
      const body = (await request.json()) as Partial<GoogleCalendarEvent>
      return HttpResponse.json({
        kind: 'calendar#event',
        id: eventId,
        status: 'confirmed',
        ...body,
      })
    }
  ),

  // Delete Event
  http.delete(
    'https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId',
    () => {
      return new HttpResponse(null, { status: 204 })
    }
  ),

  // FreeBusy Query
  http.post('https://www.googleapis.com/calendar/v3/freeBusy', () => {
    return HttpResponse.json(createMockFreeBusyResponse())
  }),
]

// Gemini API Handlers
const geminiHandlers = [
  http.post('https://generativelanguage.googleapis.com/v1beta/*', async () => {
    // Mock response for brain dump parsing
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  tasks: [
                    {
                      content: 'Test task from brain dump',
                      priority: 'medium',
                      project: 'General',
                    },
                  ],
                  suggestedProjects: ['General'],
                }),
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    }

    return HttpResponse.json(mockResponse)
  }),
]

// Firebase Auth Handlers (for REST API if used)
const firebaseAuthHandlers = [
  http.post('https://identitytoolkit.googleapis.com/*', () => {
    return HttpResponse.json({
      idToken: 'mock-id-token',
      email: 'test@example.com',
      refreshToken: 'mock-refresh-token',
      expiresIn: '3600',
      localId: 'test-user-123',
    })
  }),
]

// Firebase Functions Handlers
const firebaseFunctionsHandlers = [
  http.post('https://*.cloudfunctions.net/*', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      result: {
        success: true,
        data: body,
      },
    })
  }),
]

// Combine all handlers
export const handlers = [
  ...googleCalendarHandlers,
  ...geminiHandlers,
  ...firebaseAuthHandlers,
  ...firebaseFunctionsHandlers,
]

// Create and export the MSW server
export const server = setupServer(...handlers)

// Export handler arrays for selective use in tests
export {
  googleCalendarHandlers,
  geminiHandlers,
  firebaseAuthHandlers,
  firebaseFunctionsHandlers,
}

// Helper to add custom handlers to the server
export const addHandler = (handler: ReturnType<typeof http.get | typeof http.post>) => {
  server.use(handler)
}

// Helper to reset handlers to defaults
export const resetHandlers = () => {
  server.resetHandlers()
}

// Helper for common error responses
export const mockErrorResponse = (
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  status: number,
  message: string
) => {
  const httpMethod = http[method]
  server.use(
    httpMethod(url, () => {
      return HttpResponse.json(
        {
          error: {
            code: status,
            message,
            status: status >= 500 ? 'INTERNAL' : 'INVALID_REQUEST',
          },
        },
        { status }
      )
    })
  )
}

// Helper for network errors
export const mockNetworkError = (
  method: 'get' | 'post' | 'put' | 'delete',
  url: string
) => {
  const httpMethod = http[method]
  server.use(
    httpMethod(url, () => {
      return HttpResponse.error()
    })
  )
}
