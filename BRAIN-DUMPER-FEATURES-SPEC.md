# Brain Dumper - Technical Specification
## Google Calendar Integration & Intelligent Scheduling

**Version:** 1.0.0
**Date:** January 17, 2026
**Stack:** React 18 + TypeScript + Vite + Tailwind | Firebase | Gemini 2.0 Flash

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Models](#3-data-models)
4. [API Design](#4-api-design)
5. [Frontend Components](#5-frontend-components)
6. [Intelligent Scheduling Engine](#6-intelligent-scheduling-engine)
7. [Security Considerations](#7-security-considerations)
8. [Implementation Phases](#8-implementation-phases)
9. [Testing Strategy](#9-testing-strategy)
10. [Appendix](#10-appendix)

---

## 1. Executive Summary

This specification details the implementation of two interconnected features for Brain Dumper:

1. **Google Calendar Integration** - Bidirectional sync between tasks and calendar events
2. **Intelligent Scheduling Logic** - AI-assisted task scheduling based on task type, availability, and user preferences

### Goals

- Seamless OAuth 2.0 authentication with Google Calendar API
- Real-time two-way synchronization between tasks and calendar blocks
- Smart scheduling that respects task types, buffer times, and existing commitments
- Conflict resolution with automatic rescheduling capabilities

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (React)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Calendar   │  │  Scheduling │  │    Task     │  │   Settings  │    │
│  │    View     │  │   Controls  │  │   Manager   │  │    Panel    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                              │                                           │
│                    ┌─────────┴─────────┐                                │
│                    │   React Context    │                                │
│                    │  (CalendarProvider)│                                │
│                    └───────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FIREBASE SERVICES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Cloud Functions │    │    Firestore     │    │   Firebase Auth  │  │
│  │                  │    │                  │    │                  │  │
│  │  - OAuth Handler │    │  - users         │    │  - Google OAuth  │  │
│  │  - Calendar Sync │    │  - tasks         │    │  - Session Mgmt  │  │
│  │  - Scheduler     │    │  - calendarSync  │    │                  │  │
│  │  - Webhook Recv  │    │  - scheduleRules │    │                  │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                          │
│  │  Secret Manager  │    │  Pub/Sub Topics  │                          │
│  │  (OAuth Tokens)  │    │  (Async Events)  │                          │
│  └──────────────────┘    └──────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐                          │
│  │ Google Calendar  │    │   Gemini 2.0     │                          │
│  │       API        │    │     Flash        │                          │
│  │                  │    │                  │                          │
│  │  - Events CRUD   │    │  - Task Parsing  │                          │
│  │  - Watch/Push    │    │  - Schedule Opt  │                          │
│  │  - Free/Busy     │    │  - Conflict Res  │                          │
│  └──────────────────┘    └──────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TASK SCHEDULING FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

User Creates Task                    Calendar Event Created
       │                                      │
       ▼                                      ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Gemini    │───▶│  Scheduler  │───▶│  Calendar   │───▶│  Firestore  │
│  (Parsing)  │    │   Engine    │    │  API Write  │    │   Update    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       │                  ▼                  │                  │
       │         ┌─────────────┐             │                  │
       │         │ Availability│             │                  │
       │         │   Engine    │             │                  │
       │         └─────────────┘             │                  │
       │                  │                  │                  │
       │                  ▼                  │                  │
       │         ┌─────────────┐             │                  │
       │         │  Free/Busy  │◀────────────┘                  │
       │         │    Query    │                                │
       │         └─────────────┘                                │
       │                                                        │
       └────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        TWO-WAY SYNC FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

         Task Completed                    Calendar Block Deleted
               │                                    │
               ▼                                    ▼
        ┌─────────────┐                     ┌─────────────┐
        │  Firestore  │                     │   Webhook   │
        │   Trigger   │                     │  Receiver   │
        └─────────────┘                     └─────────────┘
               │                                    │
               ▼                                    ▼
        ┌─────────────┐                     ┌─────────────┐
        │   Delete    │                     │  Flag Task  │
        │ Cal Event   │                     │ as Deleted  │
        └─────────────┘                     └─────────────┘
```

### 2.3 Component Interaction Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND COMPONENT TREE                             │
└─────────────────────────────────────────────────────────────────────────┘

<App>
  │
  ├── <AuthProvider>
  │     └── <CalendarProvider>
  │           │
  │           ├── <DashboardLayout>
  │           │     │
  │           │     ├── <TaskInput>
  │           │     │     └── <GeminiParser>
  │           │     │
  │           │     ├── <TaskList>
  │           │     │     ├── <TaskCard>
  │           │     │     │     ├── <ScheduleButton>
  │           │     │     │     └── <TaskTypeIndicator>
  │           │     │     └── <TaskFilters>
  │           │     │
  │           │     └── <CalendarView>
  │           │           ├── <CalendarHeader>
  │           │           ├── <WeekView>
  │           │           │     └── <TimeBlock>
  │           │           └── <CalendarSync Status>
  │           │
  │           └── <SettingsPanel>
  │                 ├── <CalendarConnection>
  │                 │     ├── <GoogleOAuthButton>
  │                 │     └── <CalendarSelector>
  │                 │
  │                 └── <SchedulingPreferences>
  │                       ├── <TaskTypeRules>
  │                       ├── <BufferTimeSettings>
  │                       └── <ProtectedSlots>
  │
  └── <Modals>
        ├── <ConflictResolutionModal>
        └── <ScheduleSuggestionModal>
```

---

## 3. Data Models

### 3.1 Firestore Collections Schema

#### Collection: `users/{userId}`

```typescript
interface User {
  // Existing fields
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // New fields for calendar integration
  calendarIntegration: {
    enabled: boolean;
    connectedAt: Timestamp | null;
    lastSyncAt: Timestamp | null;
    syncStatus: 'idle' | 'syncing' | 'error';
    errorMessage: string | null;
  };

  schedulingPreferences: {
    timezone: string;  // e.g., "America/New_York"
    workingHours: {
      start: string;   // "09:00"
      end: string;     // "17:00"
    };
    workingDays: number[];  // [1, 2, 3, 4, 5] (Mon-Fri)
    defaultTaskDuration: number;  // minutes, default 30
  };
}
```

#### Collection: `users/{userId}/calendars/{calendarId}`

```typescript
interface ConnectedCalendar {
  calendarId: string;           // Google Calendar ID
  name: string;                 // "Work Calendar"
  color: string;                // "#4285f4"
  type: 'work' | 'personal';
  accessRole: 'owner' | 'writer' | 'reader';

  // Sync configuration
  readAvailability: boolean;    // Check for conflicts
  writeEvents: boolean;         // Create time blocks
  isPrimary: boolean;           // Primary calendar for writing

  // Metadata
  addedAt: Timestamp;
  lastSyncAt: Timestamp;
}
```

#### Collection: `users/{userId}/tasks/{taskId}`

```typescript
interface Task {
  // Existing fields
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // New scheduling fields
  taskType: TaskType;
  estimatedDuration: number;    // minutes

  scheduling: {
    isScheduled: boolean;
    scheduledStart: Timestamp | null;
    scheduledEnd: Timestamp | null;
    calendarEventId: string | null;
    calendarId: string | null;

    // Buffer times
    prepTime: number;           // minutes before
    windDownTime: number;       // minutes after
    prepEventId: string | null;
    windDownEventId: string | null;

    // Scheduling metadata
    scheduledAt: Timestamp | null;
    scheduledBy: 'user' | 'auto' | 'ai';
    autoRescheduleEnabled: boolean;
  };

  // Conflict tracking
  conflicts: {
    hasConflict: boolean;
    conflictReason: string | null;
    suggestedSlots: ScheduleSlot[];
    flaggedForReview: boolean;
  };

  // AI parsing metadata (from Gemini)
  aiMetadata: {
    parsedAt: Timestamp | null;
    confidence: number;
    extractedEntities: {
      dates: string[];
      people: string[];
      locations: string[];
    };
    suggestedTaskType: TaskType | null;
    suggestedDuration: number | null;
  };
}

type TaskType =
  | 'deep_work'      // Coding, writing, analysis
  | 'meeting'        // Video calls, in-person
  | 'call'           // Phone/quick calls
  | 'admin'          // Email, paperwork
  | 'creative'       // Design, brainstorming
  | 'review'         // Code review, document review
  | 'planning'       // Sprint planning, roadmapping
  | 'break'          // Scheduled breaks
  | 'other';

interface ScheduleSlot {
  start: Timestamp;
  end: Timestamp;
  score: number;      // AI-calculated fit score 0-100
  reason: string;     // "Morning slot ideal for deep work"
}
```

#### Collection: `users/{userId}/scheduleRules/{ruleId}`

```typescript
interface ScheduleRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;   // Higher = evaluated first

  // Rule conditions
  conditions: {
    taskTypes: TaskType[];
    priorities: ('low' | 'medium' | 'high' | 'urgent')[];
    daysOfWeek: number[];  // 0-6, Sunday = 0
  };

  // Rule actions
  actions: {
    preferredTimeRange: {
      start: string;  // "09:00"
      end: string;    // "12:00"
    };
    bufferBefore: number;   // minutes
    bufferAfter: number;    // minutes
    minDuration: number;    // minutes
    maxDuration: number;    // minutes

    // Advanced options
    avoidBackToBack: boolean;
    preferContiguousBlocks: boolean;
    maxTasksPerDay: number | null;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Collection: `users/{userId}/protectedSlots/{slotId}`

```typescript
interface ProtectedSlot {
  id: string;
  name: string;                 // "Ad-hoc call slot"
  enabled: boolean;

  recurrence: {
    type: 'daily' | 'weekly' | 'monthly';
    daysOfWeek: number[];       // [1, 2, 3, 4, 5] for weekdays
    startTime: string;          // "14:00"
    endTime: string;            // "15:00"
    timezone: string;
  };

  purpose: 'adhoc_calls' | 'buffer' | 'personal' | 'other';
  allowOverrideForUrgent: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Collection: `users/{userId}/calendarSyncLog/{logId}`

```typescript
interface CalendarSyncLog {
  id: string;
  timestamp: Timestamp;
  direction: 'to_calendar' | 'from_calendar';
  action: 'create' | 'update' | 'delete';

  taskId: string | null;
  eventId: string | null;
  calendarId: string;

  status: 'success' | 'failed' | 'pending';
  errorMessage: string | null;

  details: {
    previousState: object | null;
    newState: object | null;
    triggeredBy: 'user' | 'webhook' | 'scheduled_sync';
  };
}
```

### 3.2 Secure Token Storage (Google Secret Manager)

```typescript
// Stored in Google Secret Manager, NOT Firestore
interface OAuthTokens {
  userId: string;
  accessToken: string;          // Short-lived
  refreshToken: string;         // Long-lived
  tokenType: string;
  scope: string;
  expiresAt: number;            // Unix timestamp
  issuedAt: number;
}

// Secret naming convention:
// projects/{project-id}/secrets/oauth-{userId}/versions/latest
```

---

## 4. API Design

### 4.1 Cloud Functions Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLOUD FUNCTIONS ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────┘

HTTP Callable Functions (Client-facing)
├── calendarOAuthInit          POST    Initiate OAuth flow
├── calendarOAuthCallback      GET     Handle OAuth callback
├── calendarDisconnect         POST    Revoke calendar access
├── calendarList               GET     List connected calendars
├── calendarToggle             POST    Enable/disable calendar
├── scheduleTask               POST    Schedule a single task
├── scheduleBulk               POST    Schedule multiple tasks
├── rescheduleTask             POST    Reschedule existing task
├── unscheduleTask             POST    Remove from calendar
├── getSuggestions             POST    Get AI schedule suggestions
└── resolveConflict            POST    Apply conflict resolution

Firestore Triggers (Background)
├── onTaskCreated              Trigger auto-scheduling evaluation
├── onTaskUpdated              Sync changes to calendar
├── onTaskDeleted              Remove calendar events
└── onTaskCompleted            Clean up calendar blocks

Scheduled Functions (Cron)
├── dailyCalendarSync          Every 15 min  Full sync check
├── refreshOAuthTokens         Every 30 min  Refresh expiring tokens
└── cleanupSyncLogs            Daily         Prune old logs

Webhook Handlers
├── calendarWebhook            POST    Google Calendar push notifications
└── calendarWatchRenewal       Cron    Renew watch subscriptions
```

### 4.2 Function Specifications

#### 4.2.1 OAuth Functions

```typescript
// ============================================================
// calendarOAuthInit - Initiate Google OAuth 2.0 Flow
// ============================================================

// Endpoint: POST /calendarOAuthInit
// Auth: Required (Firebase Auth)

interface OAuthInitRequest {
  redirectUri: string;          // Where to return after auth
  scopes?: string[];            // Additional scopes if needed
}

interface OAuthInitResponse {
  authUrl: string;              // Google OAuth consent URL
  state: string;                // CSRF protection token
}

// Cloud Function Implementation
export const calendarOAuthInit = onCall(
  { cors: true, enforceAppCheck: true },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const state = generateSecureState(auth.uid);
    await storeOAuthState(auth.uid, state);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      data.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state,
      prompt: 'consent',        // Force refresh token
    });

    return { authUrl, state };
  }
);

// ============================================================
// calendarOAuthCallback - Handle OAuth Callback
// ============================================================

// Endpoint: GET /calendarOAuthCallback
// Auth: Via state token

interface OAuthCallbackRequest {
  code: string;                 // Authorization code
  state: string;                // CSRF token
  error?: string;               // Error if user denied
}

interface OAuthCallbackResponse {
  success: boolean;
  calendars?: ConnectedCalendar[];
  error?: string;
}

export const calendarOAuthCallback = onRequest(
  { cors: true },
  async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/settings?error=oauth_denied`);
    }

    // Validate state and get userId
    const userId = await validateOAuthState(state as string);
    if (!userId) {
      return res.redirect(`${FRONTEND_URL}/settings?error=invalid_state`);
    }

    // Exchange code for tokens
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code as string);

    // Store tokens securely in Secret Manager
    await storeTokensSecurely(userId, tokens);

    // Fetch available calendars
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();

    // Store calendar metadata in Firestore
    await storeCalendarMetadata(userId, calendarList.data.items);

    // Set up webhook for real-time updates
    await setupCalendarWatch(userId, oauth2Client);

    // Update user document
    await updateUserCalendarStatus(userId, true);

    return res.redirect(`${FRONTEND_URL}/settings?success=calendar_connected`);
  }
);
```

#### 4.2.2 Scheduling Functions

```typescript
// ============================================================
// scheduleTask - Schedule a Single Task
// ============================================================

// Endpoint: POST /scheduleTask
// Auth: Required

interface ScheduleTaskRequest {
  taskId: string;
  preferredSlot?: {
    start: string;              // ISO datetime
    end: string;
  };
  useAiSuggestion?: boolean;
  overrideConflicts?: boolean;
}

interface ScheduleTaskResponse {
  success: boolean;
  scheduledSlot?: {
    start: string;
    end: string;
    calendarEventId: string;
  };
  conflicts?: ConflictInfo[];
  suggestions?: ScheduleSlot[];
}

interface ConflictInfo {
  eventId: string;
  eventTitle: string;
  start: string;
  end: string;
  calendarName: string;
}

export const scheduleTask = onCall(
  { cors: true, enforceAppCheck: true },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const { taskId, preferredSlot, useAiSuggestion, overrideConflicts } = data;

    // 1. Fetch task details
    const task = await getTask(auth.uid, taskId);
    if (!task) throw new HttpsError('not-found', 'Task not found');

    // 2. Get user preferences and connected calendars
    const [preferences, calendars] = await Promise.all([
      getUserPreferences(auth.uid),
      getConnectedCalendars(auth.uid),
    ]);

    // 3. Determine time slot
    let targetSlot: TimeSlot;

    if (preferredSlot) {
      targetSlot = parseSlot(preferredSlot);
    } else if (useAiSuggestion) {
      targetSlot = await getAiSuggestedSlot(task, preferences, calendars);
    } else {
      targetSlot = await findNextAvailableSlot(task, preferences, calendars);
    }

    // 4. Check for conflicts
    const conflicts = await checkConflicts(auth.uid, targetSlot, calendars);

    if (conflicts.length > 0 && !overrideConflicts) {
      // Return conflicts and alternative suggestions
      const suggestions = await generateAlternatives(
        task,
        preferences,
        calendars,
        5 // number of suggestions
      );

      return {
        success: false,
        conflicts,
        suggestions,
      };
    }

    // 5. Create calendar event
    const eventResult = await createCalendarEvent(auth.uid, task, targetSlot);

    // 6. Create buffer events if configured
    const rule = await getMatchingRule(auth.uid, task);
    if (rule?.actions.bufferBefore > 0) {
      await createBufferEvent(auth.uid, targetSlot, 'before', rule.actions.bufferBefore);
    }
    if (rule?.actions.bufferAfter > 0) {
      await createBufferEvent(auth.uid, targetSlot, 'after', rule.actions.bufferAfter);
    }

    // 7. Update task with scheduling info
    await updateTaskScheduling(auth.uid, taskId, {
      isScheduled: true,
      scheduledStart: targetSlot.start,
      scheduledEnd: targetSlot.end,
      calendarEventId: eventResult.eventId,
      calendarId: eventResult.calendarId,
      scheduledAt: Timestamp.now(),
      scheduledBy: useAiSuggestion ? 'ai' : 'user',
    });

    // 8. Log sync action
    await logSyncAction(auth.uid, 'to_calendar', 'create', taskId, eventResult.eventId);

    return {
      success: true,
      scheduledSlot: {
        start: targetSlot.start.toISOString(),
        end: targetSlot.end.toISOString(),
        calendarEventId: eventResult.eventId,
      },
    };
  }
);

// ============================================================
// getSuggestions - Get AI-Powered Schedule Suggestions
// ============================================================

// Endpoint: POST /getSuggestions
// Auth: Required

interface GetSuggestionsRequest {
  taskId: string;
  dateRange?: {
    start: string;              // ISO date
    end: string;
  };
  maxSuggestions?: number;
}

interface GetSuggestionsResponse {
  suggestions: EnhancedScheduleSlot[];
  reasoning: string;
}

interface EnhancedScheduleSlot extends ScheduleSlot {
  conflicts: ConflictInfo[];
  bufferAvailable: boolean;
  matchesRules: string[];       // Names of matching rules
}

export const getSuggestions = onCall(
  { cors: true, enforceAppCheck: true },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const { taskId, dateRange, maxSuggestions = 5 } = data;

    // Fetch all required data
    const [task, preferences, calendars, rules, protectedSlots] = await Promise.all([
      getTask(auth.uid, taskId),
      getUserPreferences(auth.uid),
      getConnectedCalendars(auth.uid),
      getScheduleRules(auth.uid),
      getProtectedSlots(auth.uid),
    ]);

    // Get availability for date range
    const range = dateRange || getDefaultDateRange(task.dueDate);
    const availability = await fetchAvailability(auth.uid, calendars, range);

    // Use Gemini to generate intelligent suggestions
    const geminiPrompt = buildSchedulingPrompt(task, preferences, rules, availability);
    const aiSuggestions = await callGeminiForScheduling(geminiPrompt);

    // Enhance suggestions with conflict and rule information
    const enhancedSuggestions = await Promise.all(
      aiSuggestions.map(async (slot) => ({
        ...slot,
        conflicts: await checkConflicts(auth.uid, slot, calendars),
        bufferAvailable: checkBufferAvailability(slot, availability, rules),
        matchesRules: getMatchingRuleNames(slot, task, rules),
      }))
    );

    // Sort by score and filter out impossible slots
    const viableSuggestions = enhancedSuggestions
      .filter(s => s.conflicts.length === 0 || task.priority === 'urgent')
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return {
      suggestions: viableSuggestions,
      reasoning: aiSuggestions.reasoning,
    };
  }
);
```

#### 4.2.3 Sync Trigger Functions

```typescript
// ============================================================
// onTaskCompleted - Sync Task Completion to Calendar
// ============================================================

export const onTaskCompleted = onDocumentUpdated(
  'users/{userId}/tasks/{taskId}',
  async (event) => {
    const before = event.data?.before.data() as Task;
    const after = event.data?.after.data() as Task;
    const { userId, taskId } = event.params;

    // Check if task was just completed
    if (before.status !== 'completed' && after.status === 'completed') {
      // Remove associated calendar events
      if (after.scheduling?.calendarEventId) {
        await deleteCalendarEvent(
          userId,
          after.scheduling.calendarId!,
          after.scheduling.calendarEventId
        );

        // Also remove buffer events
        if (after.scheduling.prepEventId) {
          await deleteCalendarEvent(
            userId,
            after.scheduling.calendarId!,
            after.scheduling.prepEventId
          );
        }
        if (after.scheduling.windDownEventId) {
          await deleteCalendarEvent(
            userId,
            after.scheduling.calendarId!,
            after.scheduling.windDownEventId
          );
        }

        // Update task to clear scheduling info
        await clearTaskScheduling(userId, taskId);

        // Log the sync
        await logSyncAction(
          userId,
          'to_calendar',
          'delete',
          taskId,
          after.scheduling.calendarEventId
        );
      }
    }
  }
);

// ============================================================
// calendarWebhook - Handle Google Calendar Push Notifications
// ============================================================

export const calendarWebhook = onRequest(
  { cors: false },
  async (req, res) => {
    // Verify webhook authenticity
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceState = req.headers['x-goog-resource-state'] as string;
    const resourceId = req.headers['x-goog-resource-id'] as string;

    if (!channelId || !await validateWebhookChannel(channelId)) {
      return res.status(403).send('Invalid channel');
    }

    // Handle sync notification
    if (resourceState === 'sync') {
      // Initial sync notification - acknowledge and return
      return res.status(200).send('OK');
    }

    // Handle actual changes
    if (resourceState === 'exists' || resourceState === 'not_exists') {
      // Queue for async processing to return quickly
      await publishToPubSub('calendar-changes', {
        channelId,
        resourceId,
        resourceState,
        timestamp: Date.now(),
      });
    }

    return res.status(200).send('OK');
  }
);

// ============================================================
// processCalendarChange - Async Handler for Calendar Changes
// ============================================================

export const processCalendarChange = onMessagePublished(
  'calendar-changes',
  async (event) => {
    const { channelId, resourceId, resourceState } = event.data.message.json;

    // Get user and calendar info from channel mapping
    const channelInfo = await getChannelInfo(channelId);
    if (!channelInfo) return;

    const { userId, calendarId } = channelInfo;

    // Fetch recent changes from Google Calendar
    const oauth2Client = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get sync token for incremental sync
    const syncToken = await getSyncToken(userId, calendarId);

    const events = await calendar.events.list({
      calendarId,
      syncToken,
      maxResults: 100,
    });

    // Process each changed event
    for (const event of events.data.items || []) {
      // Check if this is a Brain Dumper managed event
      const taskId = extractTaskIdFromEvent(event);
      if (!taskId) continue;

      const task = await getTask(userId, taskId);
      if (!task) continue;

      if (event.status === 'cancelled') {
        // Event was deleted - flag task for review
        await flagTaskForReview(userId, taskId, 'Calendar event was deleted');
        await logSyncAction(userId, 'from_calendar', 'delete', taskId, event.id!);
      } else {
        // Event was modified - update task if needed
        const needsUpdate = checkEventTaskMismatch(event, task);
        if (needsUpdate) {
          await updateTaskFromEvent(userId, taskId, event);
          await logSyncAction(userId, 'from_calendar', 'update', taskId, event.id!);
        }
      }
    }

    // Store new sync token
    if (events.data.nextSyncToken) {
      await storeSyncToken(userId, calendarId, events.data.nextSyncToken);
    }
  }
);
```

### 4.3 API Error Codes

```typescript
enum CalendarErrorCode {
  // OAuth Errors
  OAUTH_INIT_FAILED = 'OAUTH_INIT_FAILED',
  OAUTH_CALLBACK_INVALID = 'OAUTH_CALLBACK_INVALID',
  OAUTH_TOKEN_EXPIRED = 'OAUTH_TOKEN_EXPIRED',
  OAUTH_REFRESH_FAILED = 'OAUTH_REFRESH_FAILED',
  OAUTH_REVOKED = 'OAUTH_REVOKED',

  // Calendar Errors
  CALENDAR_NOT_FOUND = 'CALENDAR_NOT_FOUND',
  CALENDAR_ACCESS_DENIED = 'CALENDAR_ACCESS_DENIED',
  CALENDAR_QUOTA_EXCEEDED = 'CALENDAR_QUOTA_EXCEEDED',
  CALENDAR_SYNC_FAILED = 'CALENDAR_SYNC_FAILED',

  // Scheduling Errors
  NO_AVAILABLE_SLOTS = 'NO_AVAILABLE_SLOTS',
  SLOT_CONFLICT = 'SLOT_CONFLICT',
  PAST_DUE_DATE = 'PAST_DUE_DATE',
  INVALID_DURATION = 'INVALID_DURATION',
  RULE_VIOLATION = 'RULE_VIOLATION',

  // Task Errors
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ALREADY_SCHEDULED = 'TASK_ALREADY_SCHEDULED',
  TASK_NOT_SCHEDULED = 'TASK_NOT_SCHEDULED',
}
```

---

## 5. Frontend Components

### 5.1 Component Specifications

#### 5.1.1 CalendarProvider (Context)

```typescript
// src/contexts/CalendarContext.tsx

interface CalendarContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Calendars
  calendars: ConnectedCalendar[];
  primaryCalendar: ConnectedCalendar | null;

  // Sync state
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: Date | null;

  // Actions
  connectCalendar: () => Promise<void>;
  disconnectCalendar: () => Promise<void>;
  toggleCalendar: (calendarId: string, enabled: boolean) => Promise<void>;
  setPrimaryCalendar: (calendarId: string) => Promise<void>;
  refreshCalendars: () => Promise<void>;

  // Scheduling
  scheduleTask: (taskId: string, options?: ScheduleOptions) => Promise<ScheduleResult>;
  unscheduleTask: (taskId: string) => Promise<void>;
  getSuggestions: (taskId: string) => Promise<ScheduleSlot[]>;
  resolveConflict: (taskId: string, resolution: ConflictResolution) => Promise<void>;
}

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(calendarReducer, initialState);

  // Subscribe to user's calendar integration status
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (doc) => {
        const data = doc.data();
        dispatch({
          type: 'SET_CONNECTION_STATUS',
          payload: data?.calendarIntegration
        });
      }
    );

    return unsubscribe;
  }, [user]);

  // Subscribe to connected calendars
  useEffect(() => {
    if (!user || !state.isConnected) return;

    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'calendars'),
      (snapshot) => {
        const calendars = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConnectedCalendar[];
        dispatch({ type: 'SET_CALENDARS', payload: calendars });
      }
    );

    return unsubscribe;
  }, [user, state.isConnected]);

  const connectCalendar = async () => {
    dispatch({ type: 'SET_CONNECTING', payload: true });

    try {
      const { authUrl } = await httpsCallable(functions, 'calendarOAuthInit')({
        redirectUri: `${window.location.origin}/oauth/callback`,
      });

      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  const scheduleTask = async (taskId: string, options?: ScheduleOptions) => {
    const result = await httpsCallable(functions, 'scheduleTask')({
      taskId,
      ...options,
    });

    return result.data as ScheduleResult;
  };

  // ... other methods

  return (
    <CalendarContext.Provider value={{ ...state, connectCalendar, scheduleTask, ... }}>
      {children}
    </CalendarContext.Provider>
  );
};
```

#### 5.1.2 CalendarConnection Component

```typescript
// src/components/settings/CalendarConnection.tsx

interface CalendarConnectionProps {
  className?: string;
}

export const CalendarConnection: React.FC<CalendarConnectionProps> = ({ className }) => {
  const {
    isConnected,
    isConnecting,
    calendars,
    connectCalendar,
    disconnectCalendar,
    toggleCalendar,
    setPrimaryCalendar,
  } = useCalendar();

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  if (!isConnected) {
    return (
      <div className={cn("p-6 border rounded-lg bg-gray-50", className)}>
        <div className="flex items-start gap-4">
          <CalendarIcon className="w-10 h-10 text-blue-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Connect Google Calendar</h3>
            <p className="text-gray-600 mt-1">
              Sync your tasks with Google Calendar to automatically block time
              and stay on top of your schedule.
            </p>
            <ul className="mt-3 text-sm text-gray-500 space-y-1">
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-green-500" />
                Read availability from work and personal calendars
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-green-500" />
                Automatically create time blocks for scheduled tasks
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-green-500" />
                Two-way sync keeps everything up to date
              </li>
            </ul>
          </div>
        </div>

        <Button
          onClick={connectCalendar}
          disabled={isConnecting}
          className="mt-4 w-full"
        >
          {isConnecting ? (
            <>
              <Spinner className="w-4 h-4 mr-2" />
              Connecting...
            </>
          ) : (
            <>
              <GoogleIcon className="w-4 h-4 mr-2" />
              Connect Google Calendar
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("p-6 border rounded-lg", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Connected Calendars</h3>
        <Badge variant="success">Connected</Badge>
      </div>

      <div className="space-y-3">
        {calendars.map((calendar) => (
          <CalendarItem
            key={calendar.calendarId}
            calendar={calendar}
            onToggle={(enabled) => toggleCalendar(calendar.calendarId, enabled)}
            onSetPrimary={() => setPrimaryCalendar(calendar.calendarId)}
          />
        ))}
      </div>

      <Separator className="my-4" />

      <Button
        variant="outline"
        onClick={() => setShowDisconnectConfirm(true)}
        className="text-red-600 hover:text-red-700"
      >
        Disconnect Calendar
      </Button>

      <DisconnectConfirmModal
        open={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={disconnectCalendar}
      />
    </div>
  );
};
```

#### 5.1.3 SchedulingPreferences Component

```typescript
// src/components/settings/SchedulingPreferences.tsx

export const SchedulingPreferences: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<SchedulingPreferences | null>(null);
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [protectedSlots, setProtectedSlots] = useState<ProtectedSlot[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences
  useEffect(() => {
    // ... fetch preferences, rules, protected slots
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Working Hours */}
      <section>
        <h3 className="font-semibold mb-3">Working Hours</h3>
        <div className="grid grid-cols-2 gap-4">
          <TimeInput
            label="Start Time"
            value={preferences?.workingHours.start}
            onChange={(v) => updatePreferences({ workingHours: { ...preferences?.workingHours, start: v }})}
          />
          <TimeInput
            label="End Time"
            value={preferences?.workingHours.end}
            onChange={(v) => updatePreferences({ workingHours: { ...preferences?.workingHours, end: v }})}
          />
        </div>
        <DaySelector
          label="Working Days"
          value={preferences?.workingDays}
          onChange={(days) => updatePreferences({ workingDays: days })}
          className="mt-3"
        />
      </section>

      {/* Task Type Rules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Task Type Rules</h3>
          <Button variant="outline" size="sm" onClick={addRule}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => (
            <TaskTypeRuleCard
              key={rule.id}
              rule={rule}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onDelete={() => deleteRule(rule.id)}
            />
          ))}

          {rules.length === 0 && (
            <EmptyState
              icon={<RulesIcon />}
              title="No rules configured"
              description="Add rules to automatically schedule tasks based on their type"
            />
          )}
        </div>
      </section>

      {/* Protected Time Slots */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Protected Time Slots</h3>
          <Button variant="outline" size="sm" onClick={addProtectedSlot}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Slot
          </Button>
        </div>

        <div className="space-y-3">
          {protectedSlots.map((slot) => (
            <ProtectedSlotCard
              key={slot.id}
              slot={slot}
              onUpdate={(updates) => updateProtectedSlot(slot.id, updates)}
              onDelete={() => deleteProtectedSlot(slot.id)}
            />
          ))}

          {/* Default ad-hoc call slot */}
          <Card className="border-dashed border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <PhoneIcon className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">Ad-hoc Call Slot (Recommended)</p>
                  <p className="text-sm text-gray-600">
                    Keep a 1-hour afternoon slot free for unexpected calls
                  </p>
                </div>
                <Switch
                  checked={hasAdhocSlot}
                  onCheckedChange={toggleAdhocSlot}
                  className="ml-auto"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
```

#### 5.1.4 TaskTypeRuleCard Component

```typescript
// src/components/settings/TaskTypeRuleCard.tsx

interface TaskTypeRuleCardProps {
  rule: ScheduleRule;
  onUpdate: (updates: Partial<ScheduleRule>) => void;
  onDelete: () => void;
}

export const TaskTypeRuleCard: React.FC<TaskTypeRuleCardProps> = ({
  rule,
  onUpdate,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={rule.enabled}
              onCheckedChange={(enabled) => onUpdate({ enabled })}
              onClick={(e) => e.stopPropagation()}
            />
            <div>
              <p className="font-medium">{rule.name}</p>
              <p className="text-sm text-gray-500">
                {rule.conditions.taskTypes.map(t => TASK_TYPE_LABELS[t]).join(', ')}
                {' -> '}
                {rule.actions.preferredTimeRange.start} - {rule.actions.preferredTimeRange.end}
              </p>
            </div>
          </div>
          <ChevronIcon className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-180")} />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 pt-0 border-t">
          <div className="grid grid-cols-2 gap-4">
            {/* Task Types */}
            <div>
              <Label>Task Types</Label>
              <TaskTypeMultiSelect
                value={rule.conditions.taskTypes}
                onChange={(types) => onUpdate({
                  conditions: { ...rule.conditions, taskTypes: types }
                })}
              />
            </div>

            {/* Preferred Time Range */}
            <div>
              <Label>Preferred Time</Label>
              <div className="flex gap-2">
                <TimeInput
                  value={rule.actions.preferredTimeRange.start}
                  onChange={(v) => onUpdate({
                    actions: {
                      ...rule.actions,
                      preferredTimeRange: { ...rule.actions.preferredTimeRange, start: v }
                    }
                  })}
                />
                <span className="self-center">to</span>
                <TimeInput
                  value={rule.actions.preferredTimeRange.end}
                  onChange={(v) => onUpdate({
                    actions: {
                      ...rule.actions,
                      preferredTimeRange: { ...rule.actions.preferredTimeRange, end: v }
                    }
                  })}
                />
              </div>
            </div>

            {/* Buffer Times */}
            <div>
              <Label>Prep Time (minutes)</Label>
              <NumberInput
                value={rule.actions.bufferBefore}
                onChange={(v) => onUpdate({
                  actions: { ...rule.actions, bufferBefore: v }
                })}
                min={0}
                max={60}
                step={5}
              />
            </div>

            <div>
              <Label>Wind-down Time (minutes)</Label>
              <NumberInput
                value={rule.actions.bufferAfter}
                onChange={(v) => onUpdate({
                  actions: { ...rule.actions, bufferAfter: v }
                })}
                min={0}
                max={60}
                step={5}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete Rule
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
```

#### 5.1.5 ScheduleSuggestionModal Component

```typescript
// src/components/scheduling/ScheduleSuggestionModal.tsx

interface ScheduleSuggestionModalProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  onSchedule: (slot: ScheduleSlot) => Promise<void>;
}

export const ScheduleSuggestionModal: React.FC<ScheduleSuggestionModalProps> = ({
  open,
  onClose,
  task,
  onSchedule,
}) => {
  const { getSuggestions } = useCalendar();
  const [suggestions, setSuggestions] = useState<EnhancedScheduleSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    if (open) {
      loadSuggestions();
    }
  }, [open, task.id]);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const result = await getSuggestions(task.id);
      setSuggestions(result.suggestions);
    } catch (error) {
      toast.error('Failed to load suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedSlot) return;

    setIsScheduling(true);
    try {
      await onSchedule(selectedSlot);
      toast.success('Task scheduled successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to schedule task');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule: {task.title}</DialogTitle>
          <DialogDescription>
            Choose a time slot for this {TASK_TYPE_LABELS[task.taskType]} task
            {task.dueDate && ` (due ${format(task.dueDate.toDate(), 'MMM d')})`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Spinner className="w-8 h-8" />
            <span className="ml-3 text-gray-500">Finding best times...</span>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {suggestions.map((slot, index) => (
              <SuggestionCard
                key={`${slot.start.toISOString()}-${index}`}
                slot={slot}
                isSelected={selectedSlot === slot}
                onSelect={() => setSelectedSlot(slot)}
                rank={index + 1}
              />
            ))}

            {suggestions.length === 0 && (
              <EmptyState
                icon={<CalendarXIcon />}
                title="No available slots"
                description="No slots available before the due date. Try extending the due date or manually choosing a time."
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedSlot || isScheduling}
          >
            {isScheduling ? 'Scheduling...' : 'Schedule Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SuggestionCard: React.FC<{
  slot: EnhancedScheduleSlot;
  isSelected: boolean;
  onSelect: () => void;
  rank: number;
}> = ({ slot, isSelected, onSelect, rank }) => {
  const startDate = slot.start instanceof Timestamp ? slot.start.toDate() : new Date(slot.start);
  const endDate = slot.end instanceof Timestamp ? slot.end.toDate() : new Date(slot.end);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-lg border text-left transition-all",
        isSelected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {rank === 1 && (
              <Badge variant="success" size="sm">Best Match</Badge>
            )}
            <span className="font-medium">
              {format(startDate, 'EEEE, MMM d')}
            </span>
          </div>
          <p className="text-lg font-semibold mt-1">
            {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
          </p>
          <p className="text-sm text-gray-500 mt-1">{slot.reason}</p>

          {slot.matchesRules.length > 0 && (
            <div className="flex gap-1 mt-2">
              {slot.matchesRules.map((rule) => (
                <Badge key={rule} variant="secondary" size="sm">
                  {rule}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="text-right">
          <ScoreBadge score={slot.score} />
        </div>
      </div>
    </button>
  );
};
```

#### 5.1.6 ConflictResolutionModal Component

```typescript
// src/components/scheduling/ConflictResolutionModal.tsx

interface ConflictResolutionModalProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  conflicts: ConflictInfo[];
  suggestions: ScheduleSlot[];
  onResolve: (resolution: ConflictResolution) => Promise<void>;
}

type ConflictResolution =
  | { type: 'reschedule'; newSlot: ScheduleSlot }
  | { type: 'override' }
  | { type: 'cancel' };

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  open,
  onClose,
  task,
  conflicts,
  suggestions,
  onResolve,
}) => {
  const [resolution, setResolution] = useState<ConflictResolution | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = async () => {
    if (!resolution) return;

    setIsResolving(true);
    try {
      await onResolve(resolution);
      toast.success(
        resolution.type === 'reschedule'
          ? 'Task rescheduled successfully'
          : 'Conflict resolved'
      );
      onClose();
    } catch (error) {
      toast.error('Failed to resolve conflict');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-amber-500" />
            Scheduling Conflict
          </DialogTitle>
          <DialogDescription>
            The requested time slot conflicts with existing events
          </DialogDescription>
        </DialogHeader>

        {/* Conflicting Events */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2">Conflicting Events</h4>
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <div key={conflict.eventId} className="flex items-center gap-2 text-sm">
                <CalendarIcon className="w-4 h-4 text-amber-600" />
                <span className="font-medium">{conflict.eventTitle}</span>
                <span className="text-gray-500">
                  ({format(new Date(conflict.start), 'h:mm a')} - {format(new Date(conflict.end), 'h:mm a')})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Options */}
        <div className="space-y-3">
          <h4 className="font-medium">Resolution Options</h4>

          {/* Suggested alternative slots */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Reschedule to an available slot:</p>
              {suggestions.slice(0, 3).map((slot, index) => (
                <button
                  key={index}
                  onClick={() => setResolution({ type: 'reschedule', newSlot: slot })}
                  className={cn(
                    "w-full p-3 rounded border text-left text-sm",
                    resolution?.type === 'reschedule' && resolution.newSlot === slot
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="font-medium">
                    {format(new Date(slot.start), 'EEE, MMM d')} at {format(new Date(slot.start), 'h:mm a')}
                  </span>
                  <span className="text-gray-500 ml-2">({slot.reason})</span>
                </button>
              ))}
            </div>
          )}

          {/* Override option (for urgent tasks) */}
          {task.priority === 'urgent' && (
            <button
              onClick={() => setResolution({ type: 'override' })}
              className={cn(
                "w-full p-3 rounded border text-left text-sm",
                resolution?.type === 'override'
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="font-medium text-red-700">Override conflict (Urgent task)</span>
              <p className="text-gray-500 mt-1">
                Schedule anyway and create overlapping event
              </p>
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!resolution || isResolving}
          >
            {isResolving ? 'Resolving...' : 'Apply Resolution'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### 5.2 Custom Hooks

```typescript
// src/hooks/useScheduling.ts

export function useScheduling(taskId: string) {
  const { scheduleTask, unscheduleTask, getSuggestions } = useCalendar();
  const [isScheduling, setIsScheduling] = useState(false);
  const [suggestions, setSuggestions] = useState<ScheduleSlot[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  const schedule = async (options?: ScheduleOptions) => {
    setIsScheduling(true);
    try {
      const result = await scheduleTask(taskId, options);

      if (!result.success && result.conflicts) {
        setConflicts(result.conflicts);
        setSuggestions(result.suggestions || []);
        return { success: false, needsResolution: true };
      }

      return { success: true, scheduledSlot: result.scheduledSlot };
    } finally {
      setIsScheduling(false);
    }
  };

  const loadSuggestions = async () => {
    const result = await getSuggestions(taskId);
    setSuggestions(result);
    return result;
  };

  return {
    schedule,
    unschedule: () => unscheduleTask(taskId),
    loadSuggestions,
    isScheduling,
    suggestions,
    conflicts,
  };
}

// src/hooks/useAvailability.ts

export function useAvailability(dateRange: DateRange) {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAvailability();
  }, [dateRange.start, dateRange.end]);

  const loadAvailability = async () => {
    setIsLoading(true);
    try {
      const result = await httpsCallable(functions, 'getAvailability')({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      });
      setAvailability(result.data as AvailabilitySlot[]);
    } finally {
      setIsLoading(false);
    }
  };

  return { availability, isLoading, refresh: loadAvailability };
}
```

---

## 6. Intelligent Scheduling Engine

### 6.1 Scheduling Algorithm Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCHEDULING ENGINE FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

Input: Task + User Preferences + Calendar Data
                    │
                    ▼
          ┌─────────────────┐
          │  1. Constraint  │
          │    Collection   │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  2. Availability│
          │     Analysis    │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  3. Rule-Based  │
          │    Filtering    │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  4. AI Scoring  │
          │    (Gemini)     │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  5. Conflict    │
          │   Resolution    │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  6. Buffer Time │
          │   Allocation    │
          └─────────────────┘
                    │
                    ▼
Output: Ranked Schedule Slots with Scores
```

### 6.2 Detailed Algorithm Implementation

```typescript
// src/functions/scheduling/scheduler.ts

interface SchedulingContext {
  task: Task;
  preferences: SchedulingPreferences;
  rules: ScheduleRule[];
  protectedSlots: ProtectedSlot[];
  calendars: ConnectedCalendar[];
  existingEvents: CalendarEvent[];
}

interface ScoredSlot {
  start: Date;
  end: Date;
  score: number;
  factors: ScoreFactor[];
  conflicts: ConflictInfo[];
  bufferStatus: {
    prepAvailable: boolean;
    windDownAvailable: boolean;
  };
}

interface ScoreFactor {
  name: string;
  weight: number;
  value: number;
  reason: string;
}

export class SchedulingEngine {
  private context: SchedulingContext;

  constructor(context: SchedulingContext) {
    this.context = context;
  }

  /**
   * Main scheduling method - returns ranked slots
   */
  async findBestSlots(maxResults: number = 5): Promise<ScoredSlot[]> {
    const { task, preferences } = this.context;

    // Step 1: Determine search window
    const searchWindow = this.calculateSearchWindow(task);

    // Step 2: Get all candidate slots
    const candidateSlots = this.generateCandidateSlots(
      searchWindow,
      task.estimatedDuration
    );

    // Step 3: Filter by hard constraints
    const viableSlots = this.filterByConstraints(candidateSlots);

    // Step 4: Score each slot
    const scoredSlots = await this.scoreSlots(viableSlots);

    // Step 5: Sort and return top results
    return scoredSlots
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Calculate the window of time to search for slots
   */
  private calculateSearchWindow(task: Task): { start: Date; end: Date } {
    const now = new Date();
    const start = startOfDay(addDays(now, 0)); // Start from today

    let end: Date;
    if (task.dueDate) {
      // Search until due date
      end = endOfDay(task.dueDate.toDate());
    } else {
      // Default to 2 weeks out
      end = endOfDay(addDays(now, 14));
    }

    return { start, end };
  }

  /**
   * Generate all possible time slots within the window
   */
  private generateCandidateSlots(
    window: { start: Date; end: Date },
    duration: number
  ): TimeSlot[] {
    const { preferences } = this.context;
    const slots: TimeSlot[] = [];

    let current = window.start;
    while (current < window.end) {
      // Check if this is a working day
      if (preferences.workingDays.includes(getDay(current))) {
        // Generate slots within working hours
        const dayStart = parse(
          preferences.workingHours.start,
          'HH:mm',
          current
        );
        const dayEnd = parse(
          preferences.workingHours.end,
          'HH:mm',
          current
        );

        let slotStart = dayStart;
        while (addMinutes(slotStart, duration) <= dayEnd) {
          slots.push({
            start: slotStart,
            end: addMinutes(slotStart, duration),
          });
          slotStart = addMinutes(slotStart, 15); // 15-minute granularity
        }
      }

      current = addDays(current, 1);
    }

    return slots;
  }

  /**
   * Filter slots by hard constraints
   */
  private filterByConstraints(slots: TimeSlot[]): TimeSlot[] {
    return slots.filter((slot) => {
      // Filter out past slots
      if (slot.start < new Date()) return false;

      // Filter out protected slots
      if (this.overlapsProtectedSlot(slot)) return false;

      // Filter out slots with hard conflicts
      if (this.hasHardConflict(slot)) return false;

      return true;
    });
  }

  /**
   * Check if slot overlaps with protected time
   */
  private overlapsProtectedSlot(slot: TimeSlot): boolean {
    const { protectedSlots, task } = this.context;

    for (const protected of protectedSlots) {
      if (!protected.enabled) continue;

      // Allow override for urgent tasks if configured
      if (protected.allowOverrideForUrgent && task.priority === 'urgent') {
        continue;
      }

      // Check if slot falls within protected time
      const protectedStart = parse(protected.recurrence.startTime, 'HH:mm', slot.start);
      const protectedEnd = parse(protected.recurrence.endTime, 'HH:mm', slot.start);

      if (
        protected.recurrence.daysOfWeek.includes(getDay(slot.start)) &&
        areIntervalsOverlapping(
          { start: slot.start, end: slot.end },
          { start: protectedStart, end: protectedEnd }
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for conflicts with existing calendar events
   */
  private hasHardConflict(slot: TimeSlot): boolean {
    const { existingEvents } = this.context;

    return existingEvents.some((event) =>
      areIntervalsOverlapping(
        { start: slot.start, end: slot.end },
        { start: new Date(event.start), end: new Date(event.end) }
      )
    );
  }

  /**
   * Score each slot based on multiple factors
   */
  private async scoreSlots(slots: TimeSlot[]): Promise<ScoredSlot[]> {
    const scoredSlots: ScoredSlot[] = [];

    for (const slot of slots) {
      const factors: ScoreFactor[] = [];

      // Factor 1: Task type time preference (weight: 30)
      factors.push(this.scoreTaskTypePreference(slot));

      // Factor 2: Proximity to due date (weight: 25)
      factors.push(this.scoreDueDateProximity(slot));

      // Factor 3: Buffer time availability (weight: 20)
      factors.push(this.scoreBufferAvailability(slot));

      // Factor 4: Time of day preference (weight: 15)
      factors.push(this.scoreTimeOfDay(slot));

      // Factor 5: Contiguous work blocks (weight: 10)
      factors.push(this.scoreContiguousBlocks(slot));

      // Calculate total score
      const totalScore = factors.reduce(
        (sum, f) => sum + (f.weight * f.value / 100),
        0
      );

      scoredSlots.push({
        ...slot,
        score: Math.round(totalScore),
        factors,
        conflicts: this.getConflicts(slot),
        bufferStatus: this.getBufferStatus(slot),
      });
    }

    return scoredSlots;
  }

  /**
   * Score based on task type rules
   */
  private scoreTaskTypePreference(slot: TimeSlot): ScoreFactor {
    const { task, rules } = this.context;

    // Find matching rules for this task type
    const matchingRules = rules.filter(
      (r) => r.enabled && r.conditions.taskTypes.includes(task.taskType)
    );

    if (matchingRules.length === 0) {
      return {
        name: 'Task Type Preference',
        weight: 30,
        value: 50, // Neutral
        reason: 'No specific rules for this task type',
      };
    }

    // Check if slot falls within preferred time range
    const slotHour = getHours(slot.start);

    for (const rule of matchingRules) {
      const preferredStart = parseInt(rule.actions.preferredTimeRange.start.split(':')[0]);
      const preferredEnd = parseInt(rule.actions.preferredTimeRange.end.split(':')[0]);

      if (slotHour >= preferredStart && slotHour < preferredEnd) {
        return {
          name: 'Task Type Preference',
          weight: 30,
          value: 100,
          reason: `Matches "${rule.name}" rule: ${task.taskType} scheduled in preferred time`,
        };
      }
    }

    return {
      name: 'Task Type Preference',
      weight: 30,
      value: 20,
      reason: 'Outside preferred time range for this task type',
    };
  }

  /**
   * Score based on due date proximity
   */
  private scoreDueDateProximity(slot: TimeSlot): ScoreFactor {
    const { task } = this.context;

    if (!task.dueDate) {
      return {
        name: 'Due Date Proximity',
        weight: 25,
        value: 50,
        reason: 'No due date specified',
      };
    }

    const dueDate = task.dueDate.toDate();
    const daysUntilDue = differenceInDays(dueDate, slot.start);

    if (daysUntilDue < 0) {
      return {
        name: 'Due Date Proximity',
        weight: 25,
        value: 0,
        reason: 'After due date',
      };
    }

    if (daysUntilDue === 0) {
      return {
        name: 'Due Date Proximity',
        weight: 25,
        value: 100,
        reason: 'Due today - highest priority',
      };
    }

    if (daysUntilDue <= 2) {
      return {
        name: 'Due Date Proximity',
        weight: 25,
        value: 80,
        reason: `Due in ${daysUntilDue} day(s) - high priority`,
      };
    }

    // Gradual decrease in score as slot gets further from due date
    const score = Math.max(20, 70 - (daysUntilDue * 5));

    return {
      name: 'Due Date Proximity',
      weight: 25,
      value: score,
      reason: `${daysUntilDue} days before due date`,
    };
  }

  /**
   * Score based on buffer time availability
   */
  private scoreBufferAvailability(slot: TimeSlot): ScoreFactor {
    const { task, rules, existingEvents } = this.context;

    const rule = rules.find(
      (r) => r.enabled && r.conditions.taskTypes.includes(task.taskType)
    );

    if (!rule || (rule.actions.bufferBefore === 0 && rule.actions.bufferAfter === 0)) {
      return {
        name: 'Buffer Availability',
        weight: 20,
        value: 100,
        reason: 'No buffer time required',
      };
    }

    let score = 100;
    const issues: string[] = [];

    // Check prep time availability
    if (rule.actions.bufferBefore > 0) {
      const prepStart = addMinutes(slot.start, -rule.actions.bufferBefore);
      const hasConflict = existingEvents.some((event) =>
        areIntervalsOverlapping(
          { start: prepStart, end: slot.start },
          { start: new Date(event.start), end: new Date(event.end) }
        )
      );

      if (hasConflict) {
        score -= 40;
        issues.push('prep time blocked');
      }
    }

    // Check wind-down time availability
    if (rule.actions.bufferAfter > 0) {
      const windDownEnd = addMinutes(slot.end, rule.actions.bufferAfter);
      const hasConflict = existingEvents.some((event) =>
        areIntervalsOverlapping(
          { start: slot.end, end: windDownEnd },
          { start: new Date(event.start), end: new Date(event.end) }
        )
      );

      if (hasConflict) {
        score -= 40;
        issues.push('wind-down time blocked');
      }
    }

    return {
      name: 'Buffer Availability',
      weight: 20,
      value: score,
      reason: issues.length > 0
        ? `Buffer issues: ${issues.join(', ')}`
        : 'Full buffer time available',
    };
  }

  /**
   * Score based on general time of day preferences
   */
  private scoreTimeOfDay(slot: TimeSlot): ScoreFactor {
    const hour = getHours(slot.start);

    // Morning slots (9-12) generally score higher for focus work
    if (hour >= 9 && hour < 12) {
      return {
        name: 'Time of Day',
        weight: 15,
        value: 90,
        reason: 'Morning slot - optimal for focused work',
      };
    }

    // Early afternoon (12-14) - post-lunch dip
    if (hour >= 12 && hour < 14) {
      return {
        name: 'Time of Day',
        weight: 15,
        value: 60,
        reason: 'Early afternoon - potential energy dip',
      };
    }

    // Mid-afternoon (14-16) - good for collaborative work
    if (hour >= 14 && hour < 16) {
      return {
        name: 'Time of Day',
        weight: 15,
        value: 75,
        reason: 'Mid-afternoon - good for meetings/calls',
      };
    }

    // Late afternoon (16-18) - wrap-up time
    return {
      name: 'Time of Day',
      weight: 15,
      value: 70,
      reason: 'Late afternoon slot',
    };
  }

  /**
   * Score based on creating contiguous work blocks
   */
  private scoreContiguousBlocks(slot: TimeSlot): ScoreFactor {
    const { existingEvents } = this.context;

    // Check for adjacent Brain Dumper tasks
    const adjacentTasks = existingEvents.filter((event) => {
      if (!event.extendedProperties?.private?.brainDumperId) return false;

      const eventEnd = new Date(event.end);
      const eventStart = new Date(event.start);

      // Check if this event ends right when our slot starts
      // or starts right when our slot ends
      return (
        Math.abs(eventEnd.getTime() - slot.start.getTime()) < 5 * 60 * 1000 ||
        Math.abs(eventStart.getTime() - slot.end.getTime()) < 5 * 60 * 1000
      );
    });

    if (adjacentTasks.length > 0) {
      return {
        name: 'Contiguous Blocks',
        weight: 10,
        value: 100,
        reason: 'Creates contiguous work block',
      };
    }

    return {
      name: 'Contiguous Blocks',
      weight: 10,
      value: 50,
      reason: 'Standalone slot',
    };
  }

  private getConflicts(slot: TimeSlot): ConflictInfo[] {
    const { existingEvents } = this.context;

    return existingEvents
      .filter((event) =>
        areIntervalsOverlapping(
          { start: slot.start, end: slot.end },
          { start: new Date(event.start), end: new Date(event.end) }
        )
      )
      .map((event) => ({
        eventId: event.id,
        eventTitle: event.summary,
        start: event.start,
        end: event.end,
        calendarName: event.calendarName,
      }));
  }

  private getBufferStatus(slot: TimeSlot): { prepAvailable: boolean; windDownAvailable: boolean } {
    // Implementation similar to scoreBufferAvailability
    // Returns boolean status for each buffer
    return { prepAvailable: true, windDownAvailable: true };
  }
}
```

### 6.3 Gemini Integration for AI-Enhanced Scheduling

```typescript
// src/functions/scheduling/gemini-scheduler.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface GeminiSchedulingInput {
  task: {
    title: string;
    description: string | null;
    taskType: TaskType;
    priority: string;
    estimatedDuration: number;
    dueDate: string | null;
  };
  availableSlots: Array<{
    start: string;
    end: string;
    dayOfWeek: string;
    timeOfDay: string;
  }>;
  userPreferences: {
    workingHours: string;
    taskTypeRules: Array<{
      taskType: string;
      preferredTime: string;
    }>;
  };
  recentPatterns: {
    typicalDeepWorkTime: string;
    typicalMeetingTime: string;
    productiveHours: string[];
  };
}

export async function getGeminiScheduleSuggestions(
  input: GeminiSchedulingInput
): Promise<{
  suggestions: Array<{
    slotIndex: number;
    score: number;
    reasoning: string;
  }>;
  overallReasoning: string;
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an intelligent scheduling assistant. Analyze the following task and available time slots to recommend the best scheduling options.

## Task Details
- Title: ${input.task.title}
- Description: ${input.task.description || 'None provided'}
- Type: ${input.task.taskType}
- Priority: ${input.task.priority}
- Duration: ${input.task.estimatedDuration} minutes
- Due Date: ${input.task.dueDate || 'No deadline'}

## Available Slots
${input.availableSlots.map((slot, i) =>
  `${i + 1}. ${slot.dayOfWeek} ${slot.start} - ${slot.end} (${slot.timeOfDay})`
).join('\n')}

## User Preferences
- Working Hours: ${input.userPreferences.workingHours}
- Task Type Rules:
${input.userPreferences.taskTypeRules.map(r =>
  `  - ${r.taskType}: prefer ${r.preferredTime}`
).join('\n')}

## User's Patterns (from historical data)
- Typical deep work time: ${input.recentPatterns.typicalDeepWorkTime}
- Typical meeting time: ${input.recentPatterns.typicalMeetingTime}
- Most productive hours: ${input.recentPatterns.productiveHours.join(', ')}

## Instructions
Analyze the task requirements, user preferences, and available slots. Return a JSON object with:
1. "suggestions": Array of up to 5 best slots, each with:
   - "slotIndex": The 1-based index of the slot from the available slots list
   - "score": A score from 0-100 indicating how well this slot fits
   - "reasoning": A brief explanation (1-2 sentences) of why this slot is recommended
2. "overallReasoning": A summary (2-3 sentences) of the scheduling strategy

Consider:
- Task type and appropriate time of day
- User's stated preferences and observed patterns
- Priority level (urgent tasks need sooner slots)
- Due date constraints
- Energy levels throughout the day
- Buffer needs for preparation or wind-down

Return ONLY valid JSON, no markdown formatting.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Parse JSON response
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to parse Gemini response:', response);
    throw new Error('Invalid AI response format');
  }
}
```

### 6.4 Default Task Type Rules

```typescript
// src/config/defaultSchedulingRules.ts

export const DEFAULT_TASK_TYPE_RULES: Omit<ScheduleRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Deep Work / Coding in Morning',
    enabled: true,
    priority: 100,
    conditions: {
      taskTypes: ['deep_work', 'creative'],
      priorities: ['low', 'medium', 'high', 'urgent'],
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    actions: {
      preferredTimeRange: { start: '09:00', end: '12:00' },
      bufferBefore: 5,
      bufferAfter: 10,
      minDuration: 60,
      maxDuration: 180,
      avoidBackToBack: false,
      preferContiguousBlocks: true,
      maxTasksPerDay: 2,
    },
  },
  {
    name: 'Calls in Afternoon',
    enabled: true,
    priority: 90,
    conditions: {
      taskTypes: ['call', 'meeting'],
      priorities: ['low', 'medium', 'high', 'urgent'],
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    actions: {
      preferredTimeRange: { start: '14:00', end: '17:00' },
      bufferBefore: 5,
      bufferAfter: 5,
      minDuration: 15,
      maxDuration: 60,
      avoidBackToBack: true,
      preferContiguousBlocks: false,
      maxTasksPerDay: 4,
    },
  },
  {
    name: 'Admin Tasks Post-Lunch',
    enabled: true,
    priority: 80,
    conditions: {
      taskTypes: ['admin', 'review'],
      priorities: ['low', 'medium', 'high', 'urgent'],
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    actions: {
      preferredTimeRange: { start: '13:00', end: '14:00' },
      bufferBefore: 0,
      bufferAfter: 0,
      minDuration: 15,
      maxDuration: 60,
      avoidBackToBack: false,
      preferContiguousBlocks: false,
      maxTasksPerDay: null,
    },
  },
  {
    name: 'Planning Sessions Early Morning',
    enabled: true,
    priority: 85,
    conditions: {
      taskTypes: ['planning'],
      priorities: ['low', 'medium', 'high', 'urgent'],
      daysOfWeek: [1], // Monday only
    },
    actions: {
      preferredTimeRange: { start: '09:00', end: '10:00' },
      bufferBefore: 0,
      bufferAfter: 15,
      minDuration: 30,
      maxDuration: 90,
      avoidBackToBack: true,
      preferContiguousBlocks: false,
      maxTasksPerDay: 1,
    },
  },
];

export const DEFAULT_PROTECTED_SLOT: Omit<ProtectedSlot, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Ad-hoc Call Slot',
  enabled: true,
  recurrence: {
    type: 'weekly',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '15:00',
    endTime: '16:00',
    timezone: 'America/New_York',
  },
  purpose: 'adhoc_calls',
  allowOverrideForUrgent: true,
};
```

---

## 7. Security Considerations

### 7.1 OAuth Token Security

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TOKEN SECURITY ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────┘

                         Token Flow

User Auth        Token Storage         Token Usage
    │                  │                    │
    ▼                  ▼                    ▼
┌────────┐      ┌─────────────┐      ┌─────────────┐
│ OAuth  │─────▶│   Secret    │─────▶│   Cloud     │
│ Flow   │      │   Manager   │      │  Functions  │
└────────┘      └─────────────┘      └─────────────┘
                      │
                      │ Encrypted at rest
                      │ Access via IAM only
                      │ Automatic rotation
                      │
                      ▼
              ┌─────────────┐
              │   NEVER     │
              │  Firestore  │
              │  (tokens)   │
              └─────────────┘
```

#### Implementation

```typescript
// src/functions/security/tokenManager.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretManager = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCLOUD_PROJECT;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

/**
 * Store OAuth tokens in Secret Manager
 * NEVER store tokens in Firestore or any client-accessible location
 */
export async function storeTokensSecurely(
  userId: string,
  tokens: OAuth2Credentials
): Promise<void> {
  const secretId = `oauth-tokens-${userId}`;
  const parent = `projects/${PROJECT_ID}`;

  const tokenData: StoredTokens = {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: Date.now() + (tokens.expiry_date || 3600 * 1000),
    scope: tokens.scope || '',
  };

  try {
    // Try to create secret (first time)
    await secretManager.createSecret({
      parent,
      secretId,
      secret: {
        replication: { automatic: {} },
        labels: { 'user-id': userId },
      },
    });
  } catch (error: any) {
    // Secret already exists, which is fine
    if (error.code !== 6) throw error;
  }

  // Add new version with latest tokens
  await secretManager.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: {
      data: Buffer.from(JSON.stringify(tokenData)),
    },
  });

  // Destroy old versions (keep only latest)
  await cleanupOldVersions(secretId);
}

/**
 * Retrieve tokens from Secret Manager
 */
export async function getStoredTokens(userId: string): Promise<StoredTokens | null> {
  const secretPath = `projects/${PROJECT_ID}/secrets/oauth-tokens-${userId}/versions/latest`;

  try {
    const [version] = await secretManager.accessSecretVersion({
      name: secretPath,
    });

    const payload = version.payload?.data?.toString();
    if (!payload) return null;

    return JSON.parse(payload) as StoredTokens;
  } catch (error: any) {
    if (error.code === 5) return null; // NOT_FOUND
    throw error;
  }
}

/**
 * Refresh expired access token
 */
export async function refreshTokenIfNeeded(userId: string): Promise<string> {
  const tokens = await getStoredTokens(userId);
  if (!tokens) throw new Error('No tokens found');

  // Check if token expires in next 5 minutes
  if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  // Refresh token
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: tokens.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  // Store updated tokens
  await storeTokensSecurely(userId, credentials);

  return credentials.access_token!;
}

/**
 * Revoke tokens and delete from Secret Manager
 */
export async function revokeTokens(userId: string): Promise<void> {
  const tokens = await getStoredTokens(userId);

  if (tokens) {
    // Revoke with Google
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    try {
      await oauth2Client.revokeToken(tokens.refreshToken);
    } catch (error) {
      console.error('Failed to revoke token with Google:', error);
    }
  }

  // Delete from Secret Manager
  const secretPath = `projects/${PROJECT_ID}/secrets/oauth-tokens-${userId}`;

  try {
    await secretManager.deleteSecret({ name: secretPath });
  } catch (error: any) {
    if (error.code !== 5) throw error; // Ignore NOT_FOUND
  }
}
```

### 7.2 Security Rules

```typescript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User document
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;

      // Connected calendars subcollection
      match /calendars/{calendarId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        // Only Cloud Functions can write (via admin SDK)
        allow write: if false;
      }

      // Tasks subcollection
      match /tasks/{taskId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Schedule rules subcollection
      match /scheduleRules/{ruleId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Protected slots subcollection
      match /protectedSlots/{slotId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Sync logs - read only for users
      match /calendarSyncLog/{logId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if false; // Only Cloud Functions
      }
    }
  }
}
```

### 7.3 API Security

```typescript
// src/functions/middleware/security.ts

import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/**
 * Verify request has valid Firebase Auth
 */
export function requireAuth(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
}

/**
 * Verify App Check token (protects against abuse)
 */
export function requireAppCheck(request: CallableRequest): void {
  if (!request.app) {
    throw new HttpsError(
      'failed-precondition',
      'App Check verification failed'
    );
  }
}

/**
 * Rate limiting per user
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  userId: string,
  maxRequests: number,
  windowMs: number
): void {
  const key = userId;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (record.count >= maxRequests) {
    throw new HttpsError(
      'resource-exhausted',
      `Rate limit exceeded. Try again in ${Math.ceil((record.resetAt - now) / 1000)} seconds`
    );
  }

  record.count++;
}

/**
 * Validate OAuth state parameter (CSRF protection)
 */
export async function validateOAuthState(state: string): Promise<string | null> {
  // State format: base64(userId:timestamp:signature)
  try {
    const decoded = Buffer.from(state, 'base64').toString();
    const [userId, timestamp, signature] = decoded.split(':');

    // Verify timestamp (10 minute expiry)
    const stateAge = Date.now() - parseInt(timestamp);
    if (stateAge > 10 * 60 * 1000) {
      return null;
    }

    // Verify signature
    const expectedSignature = createHmac('sha256', process.env.STATE_SECRET!)
      .update(`${userId}:${timestamp}`)
      .digest('hex')
      .slice(0, 16);

    if (signature !== expectedSignature) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}
```

### 7.4 Webhook Security

```typescript
// src/functions/webhooks/calendarWebhook.ts

/**
 * Verify Google Calendar webhook authenticity
 */
export async function validateWebhookChannel(channelId: string): Promise<boolean> {
  // Check if channel exists in our records
  const channelDoc = await db
    .collection('webhookChannels')
    .doc(channelId)
    .get();

  if (!channelDoc.exists) {
    console.warn(`Unknown webhook channel: ${channelId}`);
    return false;
  }

  const channel = channelDoc.data();

  // Verify channel hasn't expired
  if (channel.expiration < Date.now()) {
    console.warn(`Expired webhook channel: ${channelId}`);
    return false;
  }

  return true;
}

/**
 * Store webhook channel for validation
 */
export async function registerWebhookChannel(
  userId: string,
  calendarId: string,
  channelId: string,
  resourceId: string,
  expiration: number
): Promise<void> {
  await db.collection('webhookChannels').doc(channelId).set({
    userId,
    calendarId,
    resourceId,
    expiration,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goals:** Set up OAuth infrastructure and basic calendar connection

#### Week 1: OAuth Implementation
- [ ] Set up Google Cloud Console project
  - [ ] Enable Calendar API
  - [ ] Configure OAuth consent screen
  - [ ] Create OAuth 2.0 credentials
- [ ] Implement `calendarOAuthInit` Cloud Function
- [ ] Implement `calendarOAuthCallback` Cloud Function
- [ ] Set up Google Secret Manager for token storage
- [ ] Create token storage/retrieval utilities
- [ ] Implement token refresh logic

#### Week 2: Calendar Connection UI
- [ ] Create `CalendarProvider` context
- [ ] Build `CalendarConnection` component
- [ ] Build `CalendarSelector` component
- [ ] Implement OAuth flow in frontend
- [ ] Handle OAuth callback redirect
- [ ] Add connected calendar display
- [ ] Implement disconnect functionality

**Deliverable:** Users can connect/disconnect Google Calendar

---

### Phase 2: Read Integration (Weeks 3-4)

**Goals:** Read calendar data and display availability

#### Week 3: Calendar Data Fetching
- [ ] Implement `getAvailability` Cloud Function
- [ ] Implement free/busy query logic
- [ ] Create Firestore schema for connected calendars
- [ ] Set up calendar metadata storage
- [ ] Implement calendar list fetching

#### Week 4: Availability Display
- [ ] Create `useAvailability` hook
- [ ] Build `CalendarView` component (week view)
- [ ] Build `TimeBlock` component
- [ ] Add availability overlay to calendar view
- [ ] Show existing events (read-only)
- [ ] Implement calendar toggle (work/personal)

**Deliverable:** Users can see their calendar availability within Brain Dumper

---

### Phase 3: Write Integration (Weeks 5-6)

**Goals:** Create calendar events for scheduled tasks

#### Week 5: Event Creation
- [ ] Implement `scheduleTask` Cloud Function
- [ ] Create calendar event creation logic
- [ ] Add Brain Dumper metadata to events
- [ ] Update task schema with scheduling fields
- [ ] Implement basic conflict detection
- [ ] Create `ScheduleButton` component

#### Week 6: Scheduling UI
- [ ] Build `ScheduleSuggestionModal` component
- [ ] Create `useScheduling` hook
- [ ] Add schedule/unschedule actions to TaskCard
- [ ] Show scheduled time on TaskCard
- [ ] Implement manual time slot selection
- [ ] Add scheduling confirmation flow

**Deliverable:** Users can schedule tasks to their calendar

---

### Phase 4: Two-Way Sync (Weeks 7-8)

**Goals:** Implement bidirectional synchronization

#### Week 7: Task → Calendar Sync
- [ ] Implement `onTaskCompleted` Firestore trigger
- [ ] Implement `onTaskDeleted` Firestore trigger
- [ ] Handle task updates (reschedule)
- [ ] Create sync logging infrastructure
- [ ] Add retry logic for failed syncs

#### Week 8: Calendar → Task Sync
- [ ] Set up Google Calendar webhooks
- [ ] Implement `calendarWebhook` handler
- [ ] Implement `processCalendarChange` Pub/Sub handler
- [ ] Handle event deletion → flag task
- [ ] Handle event modification → update task
- [ ] Build `CalendarSyncStatus` component
- [ ] Create sync log viewer (settings page)

**Deliverable:** Full two-way synchronization working

---

### Phase 5: Intelligent Scheduling (Weeks 9-10)

**Goals:** Implement AI-powered scheduling engine

#### Week 9: Scheduling Engine Core
- [ ] Build `SchedulingEngine` class
- [ ] Implement constraint collection
- [ ] Implement availability analysis
- [ ] Create slot generation algorithm
- [ ] Implement scoring factors
- [ ] Add rule-based filtering

#### Week 10: AI Enhancement
- [ ] Integrate Gemini for scheduling suggestions
- [ ] Create scheduling prompt templates
- [ ] Implement `getSuggestions` Cloud Function
- [ ] Build suggestion ranking algorithm
- [ ] Add reasoning explanations to suggestions

**Deliverable:** AI-powered scheduling suggestions working

---

### Phase 6: Advanced Features (Weeks 11-12)

**Goals:** Task type rules, buffers, conflict resolution

#### Week 11: Rules & Preferences
- [ ] Create schedule rules Firestore schema
- [ ] Implement default task type rules
- [ ] Build `SchedulingPreferences` component
- [ ] Build `TaskTypeRuleCard` component
- [ ] Implement protected time slots
- [ ] Add ad-hoc call slot feature
- [ ] Build `ProtectedSlotCard` component

#### Week 12: Conflict Resolution
- [ ] Build `ConflictResolutionModal` component
- [ ] Implement conflict resolution strategies
- [ ] Add buffer time event creation
- [ ] Implement auto-reschedule logic
- [ ] Add "push to next day" functionality
- [ ] Create conflict notification system

**Deliverable:** Full feature set complete

---

### Phase 7: Polish & Testing (Weeks 13-14)

**Goals:** Quality assurance and performance optimization

#### Week 13: Testing
- [ ] Write unit tests for scheduling engine
- [ ] Write integration tests for OAuth flow
- [ ] Write integration tests for sync logic
- [ ] Create E2E tests for critical paths
- [ ] Load testing for scheduling API
- [ ] Security audit for token handling

#### Week 14: Polish
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Loading state refinements
- [ ] Accessibility audit
- [ ] Documentation updates
- [ ] Beta testing with select users

**Deliverable:** Production-ready feature

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// tests/unit/schedulingEngine.test.ts

describe('SchedulingEngine', () => {
  describe('findBestSlots', () => {
    it('should prefer morning slots for deep work tasks', async () => {
      const context = createMockContext({
        task: { taskType: 'deep_work', estimatedDuration: 60 },
        rules: [DEFAULT_TASK_TYPE_RULES[0]], // Deep work morning rule
      });

      const engine = new SchedulingEngine(context);
      const slots = await engine.findBestSlots(5);

      expect(slots[0].start.getHours()).toBeLessThan(12);
      expect(slots[0].factors.find(f => f.name === 'Task Type Preference')?.value).toBeGreaterThan(80);
    });

    it('should respect protected time slots', async () => {
      const context = createMockContext({
        task: { taskType: 'call', estimatedDuration: 30 },
        protectedSlots: [{
          enabled: true,
          recurrence: {
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '15:00',
            endTime: '16:00',
          },
          allowOverrideForUrgent: false,
        }],
      });

      const engine = new SchedulingEngine(context);
      const slots = await engine.findBestSlots(10);

      // No slot should overlap with 3-4pm on weekdays
      slots.forEach(slot => {
        const hour = slot.start.getHours();
        const day = slot.start.getDay();
        if ([1, 2, 3, 4, 5].includes(day)) {
          expect(hour === 15).toBe(false);
        }
      });
    });

    it('should score buffer availability correctly', async () => {
      const context = createMockContext({
        task: { taskType: 'meeting', estimatedDuration: 60 },
        rules: [{
          actions: { bufferBefore: 15, bufferAfter: 10 },
        }],
        existingEvents: [{
          // Event that blocks prep time for 9am slot
          start: '2024-01-15T08:30:00',
          end: '2024-01-15T08:50:00',
        }],
      });

      const engine = new SchedulingEngine(context);
      const slots = await engine.findBestSlots(10);

      const nineAmSlot = slots.find(s => s.start.getHours() === 9);
      expect(nineAmSlot?.bufferStatus.prepAvailable).toBe(false);
    });
  });

  describe('conflict detection', () => {
    it('should detect overlapping events', () => {
      // Test implementation
    });

    it('should allow urgent tasks to override protected slots', () => {
      // Test implementation
    });
  });
});
```

### 9.2 Integration Tests

```typescript
// tests/integration/calendarSync.test.ts

describe('Calendar Sync', () => {
  let testUser: TestUser;
  let mockCalendarApi: MockCalendarApi;

  beforeEach(async () => {
    testUser = await createTestUser();
    mockCalendarApi = new MockCalendarApi();
  });

  describe('Task → Calendar sync', () => {
    it('should create calendar event when task is scheduled', async () => {
      const task = await createTestTask(testUser.uid, {
        title: 'Test Task',
        taskType: 'deep_work',
        estimatedDuration: 60,
      });

      const result = await scheduleTask(testUser.uid, task.id, {
        preferredSlot: {
          start: '2024-01-15T09:00:00',
          end: '2024-01-15T10:00:00',
        },
      });

      expect(result.success).toBe(true);
      expect(mockCalendarApi.createdEvents).toHaveLength(1);
      expect(mockCalendarApi.createdEvents[0].summary).toContain('Test Task');
    });

    it('should delete calendar event when task is completed', async () => {
      const { task, eventId } = await scheduleTestTask(testUser.uid);

      // Complete the task
      await updateTask(testUser.uid, task.id, { status: 'completed' });

      // Wait for Firestore trigger
      await waitForSync();

      expect(mockCalendarApi.deletedEvents).toContain(eventId);
    });
  });

  describe('Calendar → Task sync', () => {
    it('should flag task when calendar event is deleted', async () => {
      const { task, eventId } = await scheduleTestTask(testUser.uid);

      // Simulate calendar event deletion via webhook
      await simulateWebhook({
        eventId,
        resourceState: 'not_exists',
      });

      // Check task was flagged
      const updatedTask = await getTask(testUser.uid, task.id);
      expect(updatedTask.conflicts.flaggedForReview).toBe(true);
      expect(updatedTask.conflicts.conflictReason).toContain('deleted');
    });
  });
});
```

### 9.3 E2E Tests

```typescript
// tests/e2e/scheduling.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Task Scheduling Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await connectTestCalendar(page);
  });

  test('user can schedule a task using AI suggestions', async ({ page }) => {
    // Create a new task
    await page.fill('[data-testid="task-input"]', 'Review quarterly report');
    await page.click('[data-testid="submit-task"]');

    // Open scheduling modal
    await page.click('[data-testid="schedule-button"]');

    // Wait for suggestions to load
    await expect(page.locator('[data-testid="suggestion-card"]')).toHaveCount(5);

    // Select first suggestion
    await page.click('[data-testid="suggestion-card"]:first-child');
    await page.click('[data-testid="confirm-schedule"]');

    // Verify task shows scheduled time
    await expect(page.locator('[data-testid="scheduled-time"]')).toBeVisible();

    // Verify calendar shows new event
    await page.click('[data-testid="calendar-tab"]');
    await expect(page.locator('[data-testid="calendar-event"]')).toContainText('Review quarterly report');
  });

  test('user can resolve scheduling conflicts', async ({ page }) => {
    // Create conflicting event in calendar first
    await createCalendarEvent(page, {
      title: 'Existing Meeting',
      start: '2024-01-15T09:00',
      end: '2024-01-15T10:00',
    });

    // Try to schedule task at same time
    await page.click('[data-testid="task-card"]');
    await page.click('[data-testid="schedule-button"]');
    await page.fill('[data-testid="time-picker"]', '09:00');
    await page.click('[data-testid="confirm-schedule"]');

    // Conflict modal should appear
    await expect(page.locator('[data-testid="conflict-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="conflict-event"]')).toContainText('Existing Meeting');

    // Select alternative slot
    await page.click('[data-testid="alternative-slot"]:first-child');
    await page.click('[data-testid="resolve-conflict"]');

    // Task should be scheduled at alternative time
    await expect(page.locator('[data-testid="scheduled-time"]')).not.toContainText('9:00 AM');
  });
});
```

---

## 10. Appendix

### 10.1 Google Calendar API Scopes

| Scope | Purpose | Required |
|-------|---------|----------|
| `calendar.readonly` | Read calendar list and events | Yes |
| `calendar.events` | Create, update, delete events | Yes |
| `calendar.settings.readonly` | Read user timezone | Optional |

### 10.2 Environment Variables

```bash
# .env.local (Frontend)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx

# .env (Cloud Functions)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GEMINI_API_KEY=xxx
STATE_SECRET=xxx  # For OAuth state signing
WEBHOOK_SECRET=xxx  # For webhook validation
```

### 10.3 Error Handling Patterns

```typescript
// Consistent error response format
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Frontend error handling
function handleSchedulingError(error: ApiError): void {
  switch (error.code) {
    case 'NO_AVAILABLE_SLOTS':
      toast.error('No available time slots before the due date. Try extending the deadline.');
      break;
    case 'OAUTH_TOKEN_EXPIRED':
      // Trigger re-authentication
      reconnectCalendar();
      break;
    case 'CALENDAR_QUOTA_EXCEEDED':
      toast.error('Too many calendar requests. Please try again in a few minutes.');
      break;
    default:
      toast.error('Something went wrong. Please try again.');
      console.error('Scheduling error:', error);
  }
}
```

### 10.4 Performance Considerations

1. **Caching Strategy**
   - Cache calendar list for 5 minutes
   - Cache free/busy data for 2 minutes
   - Use Firestore listeners for real-time task updates

2. **Batch Operations**
   - Batch multiple task schedules into single API call
   - Use Pub/Sub for async webhook processing
   - Implement exponential backoff for retries

3. **Pagination**
   - Limit initial calendar event fetch to 100 events
   - Implement cursor-based pagination for sync logs
   - Use date-bounded queries for availability

### 10.5 Monitoring & Observability

```typescript
// Logging structure
interface SchedulingLog {
  userId: string;
  action: 'schedule' | 'unschedule' | 'reschedule' | 'conflict';
  taskId: string;
  taskType: TaskType;
  duration: number;
  success: boolean;
  latencyMs: number;
  aiUsed: boolean;
  conflictsEncountered: number;
  error?: string;
}

// Metrics to track
// - Scheduling success rate
// - Average time to find slot
// - Conflict resolution rate
// - AI suggestion acceptance rate
// - Sync latency (task → calendar)
// - Webhook processing time
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-17 | Claude | Initial specification |

---

*End of Technical Specification*
