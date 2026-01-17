# Brain Dumper - Multi-Agent Implementation Plan

**Version:** 1.0.0
**Date:** January 17, 2026
**Goal:** Add Google Calendar Integration & Intelligent Scheduling with maximum parallel efficiency

---

## Executive Summary

This plan organizes the implementation into **5 phases** with **parallel agent workstreams** to maximize development velocity. Each phase has clear dependencies, and work within phases runs concurrently where possible.

### Key Principles

1. **Test-First Development** - All new code has tests before/during implementation
2. **Parallel Workstreams** - Independent modules developed simultaneously
3. **Shared Foundation First** - Common infrastructure built before feature work
4. **Integration Points** - Clear handoff between workstreams

---

## Phase Overview

| Phase | Duration | Focus | Parallel Agents |
|-------|----------|-------|-----------------|
| **Phase 0** | Week 1 | Foundation & Test Setup | 2 agents |
| **Phase 1** | Weeks 2-3 | OAuth & Calendar Connection | 3 agents |
| **Phase 2** | Weeks 4-5 | Read Integration & Availability | 3 agents |
| **Phase 3** | Weeks 6-7 | Write Integration & Scheduling | 4 agents |
| **Phase 4** | Weeks 8-9 | Two-Way Sync & Intelligence | 3 agents |
| **Phase 5** | Week 10 | UI Polish & Final Testing | 2 agents |

**Total: 10 weeks** (vs 14 weeks sequential)

---

## Phase 0: Foundation & Test Setup (Week 1)

> **Goal:** Establish test infrastructure and shared types/utilities before feature development

### Agent 0A: Test Infrastructure Setup

**Scope:** Configure Vitest, create test utilities, set up mocking

```
Files to Create:
├── vitest.config.ts
├── src/test/
│   ├── setup.ts                    # Global test setup
│   ├── mocks/
│   │   ├── firebase.ts             # Mock Firestore, Auth
│   │   ├── googleCalendar.ts       # Mock Calendar API
│   │   └── gemini.ts               # Mock Gemini responses
│   └── utils/
│       ├── testUser.ts             # Create test users
│       ├── testTask.ts             # Create test tasks
│       └── waitForAsync.ts         # Async test helpers
├── functions/vitest.config.ts      # Functions test config
└── functions/src/test/
    └── setup.ts
```

**Tasks:**
- [ ] Install Vitest + testing-library/react + msw
- [ ] Configure Vitest for React + TypeScript
- [ ] Create Firebase mock utilities
- [ ] Create Google Calendar API mock
- [ ] Set up MSW for API mocking
- [ ] Configure test coverage reporting
- [ ] Add test scripts to package.json
- [ ] Create sample tests for existing services

**Deliverable:** `npm run test` works with mocked dependencies

---

### Agent 0B: Shared Types & Utilities

**Scope:** Extend type definitions, create shared utilities for calendar features

```
Files to Create/Modify:
├── src/types/
│   ├── index.ts                    # Extend existing
│   ├── calendar.ts                 # Calendar-specific types
│   └── scheduling.ts               # Scheduling-specific types
├── src/lib/
│   ├── dateUtils.ts                # Date/time utilities
│   ├── calendarUtils.ts            # Calendar helper functions
│   └── validationSchemas.ts        # Zod schemas for validation
└── functions/src/types/
    └── index.ts                    # Shared types for functions
```

**New Types to Define:**

```typescript
// src/types/calendar.ts
interface ConnectedCalendar {
  id: string;
  name: string;
  type: 'work' | 'personal';
  color: string;
  primary: boolean;
  accessRole: 'reader' | 'writer' | 'owner';
  enabled: boolean;
  syncToken?: string;
}

interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  brainDumperTaskId?: string;  // Link to our task
}

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  calendarId?: string;
  eventId?: string;
}

interface AvailabilityWindow {
  date: Date;
  slots: TimeSlot[];
  totalFreeMinutes: number;
}
```

```typescript
// src/types/scheduling.ts
interface SchedulingRule {
  id: string;
  taskType: TaskType;
  preferredTimeRange: {
    start: string;  // "09:00"
    end: string;    // "12:00"
  };
  preferredDays: number[];  // 0-6 (Sun-Sat)
  defaultDuration: number;  // minutes
  bufferBefore: number;
  bufferAfter: number;
  enabled: boolean;
}

interface ScheduledTask extends Task {
  calendarEventId?: string;
  calendarId?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  bufferBeforeEventId?: string;
  bufferAfterEventId?: string;
  syncStatus: 'pending' | 'synced' | 'error' | 'orphaned';
  lastSyncAt?: Date;
}

interface SchedulingSuggestion {
  slot: TimeSlot;
  score: number;
  reasoning: string;
  factors: ScoringFactor[];
  conflicts: Conflict[];
}

interface ScoringFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

interface Conflict {
  type: 'overlap' | 'buffer' | 'rule_violation' | 'protected_slot';
  description: string;
  severity: 'warning' | 'error';
  resolution?: string;
}
```

**Tasks:**
- [ ] Create calendar.ts with all calendar types
- [ ] Create scheduling.ts with all scheduling types
- [ ] Extend Task interface in index.ts
- [ ] Create dateUtils.ts (timezone handling, slot generation)
- [ ] Create calendarUtils.ts (event formatting, overlap detection)
- [ ] Create Zod validation schemas
- [ ] Write unit tests for utility functions

**Deliverable:** All shared types and utilities ready for feature agents

---

### Phase 0 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                      PHASE 0 (Week 1)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐     ┌─────────────────────┐       │
│   │  Agent 0A           │     │  Agent 0B           │       │
│   │  Test Infrastructure│     │  Shared Types       │       │
│   │                     │     │                     │       │
│   │  • Vitest setup     │     │  • Type definitions │       │
│   │  • Mock utilities   │     │  • Date utilities   │       │
│   │  • Test helpers     │     │  • Validation       │       │
│   └──────────┬──────────┘     └──────────┬──────────┘       │
│              │                            │                  │
│              └────────────┬───────────────┘                  │
│                           ▼                                  │
│              ┌─────────────────────┐                        │
│              │  PHASE 0 COMPLETE   │                        │
│              │  ─────────────────  │                        │
│              │  Tests + Types Ready│                        │
│              └─────────────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: OAuth & Calendar Connection (Weeks 2-3)

> **Goal:** Users can connect/disconnect Google Calendar via OAuth
> **Depends on:** Phase 0 complete

### Agent 1A: OAuth Cloud Functions

**Scope:** Backend OAuth flow implementation

```
Files to Create:
├── functions/src/
│   ├── oauth/
│   │   ├── init.ts                 # calendarOAuthInit function
│   │   ├── callback.ts             # calendarOAuthCallback function
│   │   ├── refresh.ts              # Token refresh logic
│   │   ├── revoke.ts               # Token revocation
│   │   └── tokenStorage.ts         # Secret Manager integration
│   └── index.ts                    # Export all functions
```

**Tasks:**
- [ ] Set up Google Cloud Console (Calendar API, OAuth consent)
- [ ] Create `calendarOAuthInit` Cloud Function
  - Generate state token
  - Build OAuth URL with scopes
  - Return redirect URL
- [ ] Create `calendarOAuthCallback` Cloud Function
  - Exchange code for tokens
  - Store tokens in Secret Manager
  - Save calendar metadata to Firestore
- [ ] Implement token refresh logic
- [ ] Implement token revocation
- [ ] Create token storage utilities (Secret Manager)
- [ ] Write integration tests with mocked Google APIs
- [ ] Document required GCP permissions

**Deliverable:** OAuth endpoints deployed and tested

---

### Agent 1B: Calendar Provider Context

**Scope:** Frontend state management for calendar integration

```
Files to Create:
├── src/context/
│   └── CalendarContext.tsx         # CalendarProvider
├── src/hooks/
│   ├── useCalendar.ts              # Main hook
│   └── useCalendarConnection.ts    # Connection status hook
└── src/services/
    └── calendar.ts                 # Calendar API client
```

**CalendarContext State:**

```typescript
interface CalendarContextType {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Connected calendars
  calendars: ConnectedCalendar[];
  selectedCalendars: string[];  // IDs of enabled calendars

  // Actions
  initiateConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleCalendar: (calendarId: string) => void;
  refreshCalendars: () => Promise<void>;
}
```

**Tasks:**
- [ ] Create CalendarContext with full state
- [ ] Implement OAuth flow initiation (open popup/redirect)
- [ ] Handle OAuth callback (extract code, call backend)
- [ ] Create useCalendar hook for components
- [ ] Create useCalendarConnection for status
- [ ] Implement calendar list fetching
- [ ] Handle disconnect flow
- [ ] Persist selected calendars preference
- [ ] Write unit tests for context

**Deliverable:** CalendarProvider ready for UI components

---

### Agent 1C: Calendar Connection UI

**Scope:** Settings UI for connecting calendars

```
Files to Create:
├── src/components/settings/
│   ├── CalendarConnection.tsx      # Main connection component
│   ├── CalendarSelector.tsx        # Calendar toggle list
│   ├── ConnectionStatus.tsx        # Status indicator
│   └── OAuthButton.tsx             # Connect with Google button
```

**Component Specifications:**

```
CalendarConnection
├── Not Connected State
│   └── OAuthButton ("Connect Google Calendar")
│
├── Connecting State
│   └── Loading spinner + "Connecting..."
│
└── Connected State
    ├── ConnectionStatus (green dot + "Connected")
    ├── CalendarSelector
    │   ├── Calendar item (checkbox + name + color)
    │   ├── Calendar item ...
    │   └── Calendar item ...
    └── Disconnect button
```

**Tasks:**
- [ ] Create OAuthButton with Google branding
- [ ] Create CalendarConnection container
- [ ] Create CalendarSelector with toggles
- [ ] Create ConnectionStatus indicator
- [ ] Add to SettingsView
- [ ] Handle OAuth popup flow
- [ ] Handle OAuth redirect flow (mobile fallback)
- [ ] Add loading and error states
- [ ] Write component tests

**Deliverable:** Users can connect Google Calendar from settings

---

### Phase 1 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1 (Weeks 2-3)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐                                   │
│   │  Agent 1A           │                                   │
│   │  OAuth Functions    │◄──────────┐                       │
│   │                     │           │                       │
│   │  • Init endpoint    │           │                       │
│   │  • Callback handler │           │                       │
│   │  • Token storage    │           │                       │
│   └──────────┬──────────┘           │                       │
│              │                      │                       │
│              │              ┌───────┴───────┐               │
│              │              │  Agent 1B     │               │
│              │              │  Calendar     │               │
│              └─────────────►│  Context      │               │
│                             │               │               │
│                             │  • Provider   │               │
│                             │  • Hooks      │               │
│                             │  • API client │               │
│                             └───────┬───────┘               │
│                                     │                       │
│                                     │                       │
│                             ┌───────┴───────┐               │
│                             │  Agent 1C     │               │
│                             │  Connection UI│               │
│                             │               │               │
│                             │  • Settings   │               │
│                             │  • Selector   │               │
│                             │  • OAuth flow │               │
│                             └───────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Parallel Execution:**
- 1A and 1B can start simultaneously (Week 2)
- 1C starts mid-Week 2 once 1B has basic structure
- All complete by end of Week 3

---

## Phase 2: Read Integration & Availability (Weeks 4-5)

> **Goal:** Display calendar availability within Brain Dumper
> **Depends on:** Phase 1 complete (OAuth working)

### Agent 2A: Availability Cloud Functions

**Scope:** Backend functions for fetching and processing availability

```
Files to Create:
├── functions/src/
│   ├── calendar/
│   │   ├── fetchEvents.ts          # Get events for date range
│   │   ├── freeBusy.ts             # Free/busy query
│   │   └── availability.ts         # getAvailability function
│   └── utils/
│       └── calendarClient.ts       # Google Calendar API wrapper
```

**Tasks:**
- [ ] Create Google Calendar API client wrapper
- [ ] Implement `getCalendarEvents` function
- [ ] Implement `getFreeBusy` function (multi-calendar)
- [ ] Create `getAvailability` Cloud Function
  - Accept date range + calendar IDs
  - Query free/busy for all calendars
  - Merge and return availability windows
- [ ] Handle pagination for large event sets
- [ ] Implement caching (reduce API calls)
- [ ] Write integration tests

**Deliverable:** Availability API ready for frontend

---

### Agent 2B: Availability Hooks & Service

**Scope:** Frontend data fetching and state for availability

```
Files to Create:
├── src/services/
│   └── availability.ts             # Availability service
├── src/hooks/
│   ├── useAvailability.ts          # Fetch availability
│   └── useCalendarEvents.ts        # Fetch events
```

**useAvailability Hook:**

```typescript
interface UseAvailabilityOptions {
  startDate: Date;
  endDate: Date;
  calendarIds?: string[];
}

interface UseAvailabilityResult {
  availability: AvailabilityWindow[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**Tasks:**
- [ ] Create availability service (API calls)
- [ ] Implement useAvailability hook
- [ ] Implement useCalendarEvents hook
- [ ] Add caching with React Query or SWR
- [ ] Handle loading and error states
- [ ] Create availability data transformers
- [ ] Write unit tests for hooks

**Deliverable:** Availability data accessible in components

---

### Agent 2C: Calendar View Component

**Scope:** Calendar visualization component for viewing availability

```
Files to Create:
├── src/components/calendar/
│   ├── CalendarView.tsx            # Main calendar component
│   ├── WeekView.tsx                # Week grid
│   ├── DayColumn.tsx               # Single day column
│   ├── TimeSlot.tsx                # Individual time slot
│   ├── EventBlock.tsx              # Calendar event display
│   ├── AvailabilityOverlay.tsx     # Free/busy indicator
│   └── CalendarHeader.tsx          # Date navigation
```

**Component Specifications:**

```
CalendarView
├── CalendarHeader
│   ├── Date navigation (< Today >)
│   ├── View toggle (Day | Week)
│   └── Calendar filter dropdown
│
└── WeekView (7 columns)
    └── DayColumn
        ├── Date header
        └── Time grid (24 hours)
            ├── TimeSlot (00:00)
            │   └── AvailabilityOverlay (free/busy color)
            ├── EventBlock (existing event)
            ├── TimeSlot (01:00)
            └── ... (hourly slots)
```

**Tasks:**
- [ ] Create CalendarView container
- [ ] Create WeekView with 7-day grid
- [ ] Create DayColumn with time slots
- [ ] Create TimeSlot component
- [ ] Create EventBlock for existing events
- [ ] Create AvailabilityOverlay (green=free, gray=busy)
- [ ] Create CalendarHeader with navigation
- [ ] Add responsive layout (mobile: 1 day)
- [ ] Integrate with useAvailability hook
- [ ] Add to app routes (/calendar)
- [ ] Write component tests

**Deliverable:** Calendar view showing availability

---

### Phase 2 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 2 (Weeks 4-5)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐     ┌─────────────────────┐       │
│   │  Agent 2A           │     │  Agent 2B           │       │
│   │  Availability API   │────►│  Hooks & Service    │       │
│   │                     │     │                     │       │
│   │  • Free/busy query  │     │  • useAvailability  │       │
│   │  • Events fetch     │     │  • Data transforms  │       │
│   │  • Caching          │     │  • React Query      │       │
│   └─────────────────────┘     └──────────┬──────────┘       │
│                                          │                   │
│                                          │                   │
│                               ┌──────────┴──────────┐       │
│                               │  Agent 2C           │       │
│                               │  Calendar View UI   │       │
│                               │                     │       │
│                               │  • Week/Day view    │       │
│                               │  • Time slots       │       │
│                               │  • Event display    │       │
│                               └─────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Parallel Execution:**
- 2A and 2B start simultaneously (Week 4)
- 2C starts mid-Week 4 with mock data, integrates real data Week 5

---

## Phase 3: Write Integration & Scheduling (Weeks 6-7)

> **Goal:** Schedule tasks to calendar with intelligent suggestions
> **Depends on:** Phase 2 complete (can read availability)

### Agent 3A: Schedule Task Cloud Function

**Scope:** Backend function to create calendar events from tasks

```
Files to Create:
├── functions/src/
│   ├── scheduling/
│   │   ├── scheduleTask.ts         # Main scheduling function
│   │   ├── createEvent.ts          # Calendar event creation
│   │   ├── updateEvent.ts          # Event modification
│   │   ├── deleteEvent.ts          # Event deletion
│   │   └── eventBuilder.ts         # Build event payload
```

**Tasks:**
- [ ] Create event builder (task → calendar event)
- [ ] Implement `scheduleTask` Cloud Function
  - Accept task ID + time slot
  - Create calendar event with Brain Dumper metadata
  - Update task with calendar event ID
  - Create buffer events if configured
- [ ] Implement event update logic
- [ ] Implement event deletion logic
- [ ] Handle scheduling errors gracefully
- [ ] Write integration tests

**Deliverable:** Tasks can be scheduled to calendar

---

### Agent 3B: Scheduling Engine Core

**Scope:** Intelligent slot finding and scoring algorithm

```
Files to Create:
├── src/services/
│   └── schedulingEngine.ts         # SchedulingEngine class
├── functions/src/
│   └── scheduling/
│       ├── engine.ts               # Server-side engine
│       └── getSuggestions.ts       # Suggestions endpoint
```

**SchedulingEngine Class:**

```typescript
class SchedulingEngine {
  constructor(context: SchedulingContext) {}

  async findBestSlots(count: number): Promise<SchedulingSuggestion[]> {}

  private async gatherConstraints(): Promise<Constraint[]> {}
  private async analyzeAvailability(): Promise<AvailabilityWindow[]> {}
  private generateCandidateSlots(): TimeSlot[] {}
  private scoreSlot(slot: TimeSlot): ScoringFactor[] {}
  private applyRules(slots: TimeSlot[]): TimeSlot[] {}
}
```

**Scoring Factors:**
1. Task type preference (morning/afternoon/evening)
2. Due date proximity (prefer earlier for urgent)
3. Buffer availability (prep/wind-down time)
4. Time of day match (user's historical preferences)
5. Contiguous free time (prefer larger blocks)

**Tasks:**
- [ ] Create SchedulingEngine class
- [ ] Implement constraint gathering
- [ ] Implement candidate slot generation
- [ ] Implement scoring algorithm
- [ ] Implement rule-based filtering
- [ ] Add default scheduling rules
- [ ] Create `getSuggestions` Cloud Function
- [ ] Write comprehensive unit tests

**Deliverable:** Engine suggests optimal time slots

---

### Agent 3C: useScheduling Hook

**Scope:** Frontend hook for scheduling workflows

```
Files to Create:
├── src/hooks/
│   └── useScheduling.ts            # Main scheduling hook
├── src/services/
│   └── scheduling.ts               # Scheduling API client
```

**useScheduling Hook:**

```typescript
interface UseSchedulingResult {
  // Suggestions
  suggestions: SchedulingSuggestion[];
  isLoadingSuggestions: boolean;
  getSuggestions: (taskId: string) => Promise<void>;

  // Scheduling actions
  scheduleTask: (taskId: string, slot: TimeSlot) => Promise<void>;
  unscheduleTask: (taskId: string) => Promise<void>;
  rescheduleTask: (taskId: string, newSlot: TimeSlot) => Promise<void>;

  // State
  isScheduling: boolean;
  error: Error | null;
}
```

**Tasks:**
- [ ] Create scheduling service (API calls)
- [ ] Implement useScheduling hook
- [ ] Add optimistic updates
- [ ] Handle scheduling errors
- [ ] Create task scheduling mutations
- [ ] Write unit tests

**Deliverable:** Scheduling actions available to UI

---

### Agent 3D: Scheduling UI Components

**Scope:** UI for scheduling tasks

```
Files to Create:
├── src/components/scheduling/
│   ├── ScheduleButton.tsx          # Button on TaskCard
│   ├── ScheduleSuggestionModal.tsx # Modal with suggestions
│   ├── SuggestionCard.tsx          # Single suggestion display
│   ├── TimeSlotPicker.tsx          # Manual slot selection
│   ├── ScheduledBadge.tsx          # Shows scheduled time
│   └── ConflictWarning.tsx         # Conflict indicator
```

**Component Specifications:**

```
ScheduleButton (on TaskCard)
├── Not scheduled → "Schedule" button
└── Scheduled → ScheduledBadge + "Reschedule" option

ScheduleSuggestionModal
├── Task summary
├── AI Suggestions (top 3-5)
│   └── SuggestionCard
│       ├── Time slot display
│       ├── Score indicator
│       ├── Reasoning text
│       └── "Select" button
├── Manual selection
│   └── TimeSlotPicker (calendar mini-view)
└── Action buttons
    ├── "Schedule" (primary)
    └── "Cancel"
```

**Tasks:**
- [ ] Create ScheduleButton component
- [ ] Create ScheduleSuggestionModal
- [ ] Create SuggestionCard with scoring display
- [ ] Create TimeSlotPicker for manual selection
- [ ] Create ScheduledBadge
- [ ] Create ConflictWarning component
- [ ] Integrate into TaskCard
- [ ] Add keyboard navigation
- [ ] Write component tests

**Deliverable:** Full scheduling UI workflow

---

### Phase 3 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 3 (Weeks 6-7)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐     ┌─────────────────┐               │
│   │  Agent 3A       │     │  Agent 3B       │               │
│   │  Schedule API   │     │  Engine Core    │               │
│   │                 │     │                 │               │
│   │  • Create event │     │  • Scoring      │               │
│   │  • Update/delete│     │  • Constraints  │               │
│   │  • Buffers      │     │  • Suggestions  │               │
│   └────────┬────────┘     └────────┬────────┘               │
│            │                       │                         │
│            └───────────┬───────────┘                         │
│                        ▼                                     │
│            ┌─────────────────────┐                          │
│            │  Agent 3C           │                          │
│            │  useScheduling Hook │                          │
│            └──────────┬──────────┘                          │
│                       │                                      │
│                       ▼                                      │
│            ┌─────────────────────┐                          │
│            │  Agent 3D           │                          │
│            │  Scheduling UI      │                          │
│            │                     │                          │
│            │  • Modal            │                          │
│            │  • Suggestions      │                          │
│            │  • Time picker      │                          │
│            └─────────────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Parallel Execution:**
- 3A, 3B start simultaneously (Week 6)
- 3C starts end of Week 6 once APIs stabilize
- 3D starts Week 7, completes integration

---

## Phase 4: Two-Way Sync & Intelligence (Weeks 8-9)

> **Goal:** Bidirectional sync and AI-enhanced scheduling
> **Depends on:** Phase 3 complete (can write to calendar)

### Agent 4A: Task → Calendar Sync Triggers

**Scope:** Firestore triggers to sync task changes to calendar

```
Files to Create:
├── functions/src/
│   └── sync/
│       ├── onTaskCompleted.ts      # Task completed trigger
│       ├── onTaskDeleted.ts        # Task deleted trigger
│       ├── onTaskUpdated.ts        # Task rescheduled trigger
│       └── syncLogger.ts           # Sync audit logging
```

**Tasks:**
- [ ] Create `onTaskCompleted` Firestore trigger
  - Delete calendar event when task completed
  - Delete buffer events
  - Log sync action
- [ ] Create `onTaskDeleted` Firestore trigger
  - Delete calendar event when task deleted
- [ ] Create `onTaskUpdated` trigger
  - Detect reschedule (scheduledStart changed)
  - Update calendar event times
- [ ] Implement sync logging
- [ ] Add retry logic for failed syncs
- [ ] Write integration tests

**Deliverable:** Task changes automatically sync to calendar

---

### Agent 4B: Calendar → Task Sync (Webhooks)

**Scope:** Google Calendar webhooks to sync calendar changes to tasks

```
Files to Create:
├── functions/src/
│   └── webhooks/
│       ├── calendarWebhook.ts      # Webhook receiver
│       ├── processChange.ts        # Process calendar changes
│       └── watchManager.ts         # Manage webhook subscriptions
```

**Tasks:**
- [ ] Implement calendar webhook subscription
- [ ] Create `calendarWebhook` receiver function
- [ ] Handle event deletion → flag task as "orphaned"
- [ ] Handle event modification → update task
- [ ] Handle event move → update task schedule
- [ ] Implement webhook renewal (expiry handling)
- [ ] Create Pub/Sub for async processing
- [ ] Write integration tests

**Deliverable:** Calendar changes reflected in tasks

---

### Agent 4C: Scheduling Rules & Preferences UI

**Scope:** UI for configuring scheduling rules

```
Files to Create:
├── src/components/settings/
│   ├── SchedulingPreferences.tsx   # Main preferences panel
│   ├── TaskTypeRuleCard.tsx        # Single rule editor
│   ├── ProtectedSlotCard.tsx       # Protected time editor
│   ├── BufferSettings.tsx          # Default buffer config
│   └── AdHocSlotToggle.tsx         # 1-hour call slot toggle
├── src/services/
│   └── schedulingRules.ts          # Rules CRUD service
```

**Default Rules to Implement:**

| Task Type | Preferred Time | Duration | Buffers |
|-----------|---------------|----------|---------|
| Deep work | 09:00-12:00 | 2 hours | 0 / 10 min |
| Coding | 09:00-12:00 | 2 hours | 0 / 10 min |
| Call | 14:00-17:00 | 30 min | 15 / 15 min |
| Meeting | 10:00-16:00 | 1 hour | 10 / 5 min |
| Personal | Flexible | 1 hour | 0 / 0 min |

**Tasks:**
- [ ] Create SchedulingPreferences container
- [ ] Create TaskTypeRuleCard (edit rule)
- [ ] Create ProtectedSlotCard (protected times)
- [ ] Create BufferSettings component
- [ ] Implement ad-hoc call slot toggle
- [ ] Create rules CRUD service
- [ ] Integrate into Settings view
- [ ] Write component tests

**Deliverable:** Users can configure scheduling rules

---

### Phase 4 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 4 (Weeks 8-9)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐     ┌─────────────────────┐       │
│   │  Agent 4A           │     │  Agent 4B           │       │
│   │  Task → Cal Sync    │     │  Cal → Task Sync    │       │
│   │                     │     │                     │       │
│   │  • Firestore        │     │  • Webhooks         │       │
│   │    triggers         │     │  • Watch manager    │       │
│   │  • Event cleanup    │     │  • Change process   │       │
│   └─────────────────────┘     └─────────────────────┘       │
│            │                           │                     │
│            └───────────┬───────────────┘                     │
│                        │                                     │
│                        │  (Independent: can run parallel)    │
│                        │                                     │
│            ┌───────────┴───────────┐                        │
│            │  Agent 4C             │                        │
│            │  Rules & Preferences  │                        │
│            │                       │                        │
│            │  • Task type rules    │                        │
│            │  • Protected slots    │                        │
│            │  • Buffer settings    │                        │
│            └───────────────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Parallel Execution:**
- All three agents work independently
- 4A, 4B, 4C start simultaneously Week 8
- Integration testing Week 9

---

## Phase 5: UI Polish & Final Testing (Week 10)

> **Goal:** Polish, integration testing, and UI refinements
> **Depends on:** All previous phases complete

### Agent 5A: Integration Testing & Bug Fixes

**Scope:** End-to-end testing and bug resolution

```
Files to Create:
├── tests/
│   ├── e2e/
│   │   ├── oauth.spec.ts           # OAuth flow tests
│   │   ├── scheduling.spec.ts      # Full scheduling flow
│   │   ├── sync.spec.ts            # Two-way sync tests
│   │   └── rules.spec.ts           # Rules configuration
│   └── integration/
│       ├── calendarSync.test.ts
│       ├── schedulingEngine.test.ts
│       └── webhooks.test.ts
```

**Tasks:**
- [ ] Write E2E tests for critical paths
- [ ] Write integration tests for sync logic
- [ ] Perform security audit (token handling)
- [ ] Load testing for scheduling API
- [ ] Fix all P0/P1 bugs from previous phases
- [ ] Performance profiling and optimization
- [ ] Accessibility audit
- [ ] Cross-browser testing

**Deliverable:** All tests passing, bugs fixed

---

### Agent 5B: UI Polish & Documentation

**Scope:** Final UI refinements and documentation

```
Files to Create/Update:
├── src/components/
│   └── (various refinements)
├── README.md                       # Updated setup instructions
├── docs/
│   ├── CALENDAR_SETUP.md           # Calendar integration guide
│   ├── SCHEDULING_RULES.md         # Rules documentation
│   └── TROUBLESHOOTING.md          # Common issues
```

**Tasks:**
- [ ] Loading state refinements
- [ ] Error message improvements
- [ ] Empty state designs
- [ ] Animation polish
- [ ] Mobile responsiveness fixes
- [ ] Update README with new features
- [ ] Create Calendar setup guide
- [ ] Create troubleshooting guide
- [ ] Update changelog

**Deliverable:** Production-ready feature

---

### Phase 5 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 5 (Week 10)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐     ┌─────────────────────┐       │
│   │  Agent 5A           │     │  Agent 5B           │       │
│   │  Testing & Bugs     │     │  Polish & Docs      │       │
│   │                     │     │                     │       │
│   │  • E2E tests        │     │  • UI refinements   │       │
│   │  • Integration      │     │  • Documentation    │       │
│   │  • Bug fixes        │     │  • Accessibility    │       │
│   │  • Security audit   │     │  • Changelog        │       │
│   └─────────────────────┘     └─────────────────────┘       │
│            │                           │                     │
│            └───────────┬───────────────┘                     │
│                        ▼                                     │
│            ┌─────────────────────┐                          │
│            │  RELEASE READY      │                          │
│            └─────────────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: Agent Allocation by Week

| Week | Agents | Focus |
|------|--------|-------|
| 1 | 0A, 0B | Test infrastructure + shared types |
| 2 | 1A, 1B, 1C | OAuth (backend, context, UI) |
| 3 | 1A, 1B, 1C | OAuth completion + integration |
| 4 | 2A, 2B, 2C | Availability (API, hooks, calendar view) |
| 5 | 2A, 2B, 2C | Availability completion |
| 6 | 3A, 3B, 3C, 3D | Scheduling (API, engine, hooks, UI) |
| 7 | 3A, 3B, 3C, 3D | Scheduling completion |
| 8 | 4A, 4B, 4C | Sync + rules (triggers, webhooks, UI) |
| 9 | 4A, 4B, 4C | Sync completion + integration |
| 10 | 5A, 5B | Testing, polish, documentation |

**Total Agent-Weeks:** 27 agent-weeks across 10 calendar weeks
**Max Parallel Agents:** 4 (Phase 3)

---

## Test Coverage Requirements

| Module | Unit Tests | Integration Tests | E2E Tests |
|--------|------------|-------------------|-----------|
| OAuth functions | ✓ | ✓ | ✓ |
| Calendar context | ✓ | - | - |
| Availability API | ✓ | ✓ | - |
| Scheduling engine | ✓ | ✓ | - |
| Sync triggers | ✓ | ✓ | ✓ |
| Webhooks | ✓ | ✓ | - |
| UI components | ✓ | - | ✓ |

**Coverage Target:** 80% for services, 60% for components

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OAuth complexity | Start Week 2, plenty of buffer |
| Google API rate limits | Implement caching, batch requests |
| Webhook reliability | Retry logic, sync verification |
| Scheduling accuracy | Comprehensive test suite, user feedback |
| Token security | Secret Manager, never store in Firestore |

---

## How to Run Agents

Each agent can be executed with a prompt like:

```
Execute Phase X Agent Y:
- Read IMPLEMENTATION-PLAN.md for context
- Read BRAIN-DUMPER-FEATURES-SPEC.md for detailed specs
- Complete all tasks listed for Agent XY
- Write tests for all new code
- Update this plan with completion status
```

**Agent execution order per phase:**
1. Start all agents in phase simultaneously
2. Agents with dependencies wait for blockers
3. Phase gate: all agents complete before next phase

---

## Appendix: File Creation Summary

**Total New Files:** ~50 files

```
src/
├── context/
│   └── CalendarContext.tsx
├── hooks/
│   ├── useAvailability.ts
│   ├── useCalendar.ts
│   ├── useCalendarConnection.ts
│   ├── useCalendarEvents.ts
│   └── useScheduling.ts
├── services/
│   ├── availability.ts
│   ├── calendar.ts
│   ├── scheduling.ts
│   └── schedulingEngine.ts
├── components/
│   ├── calendar/
│   │   ├── CalendarView.tsx
│   │   ├── WeekView.tsx
│   │   ├── DayColumn.tsx
│   │   ├── TimeSlot.tsx
│   │   ├── EventBlock.tsx
│   │   ├── AvailabilityOverlay.tsx
│   │   └── CalendarHeader.tsx
│   ├── scheduling/
│   │   ├── ScheduleButton.tsx
│   │   ├── ScheduleSuggestionModal.tsx
│   │   ├── SuggestionCard.tsx
│   │   ├── TimeSlotPicker.tsx
│   │   ├── ScheduledBadge.tsx
│   │   └── ConflictWarning.tsx
│   └── settings/
│       ├── CalendarConnection.tsx
│       ├── CalendarSelector.tsx
│       ├── ConnectionStatus.tsx
│       ├── OAuthButton.tsx
│       ├── SchedulingPreferences.tsx
│       ├── TaskTypeRuleCard.tsx
│       ├── ProtectedSlotCard.tsx
│       ├── BufferSettings.tsx
│       └── AdHocSlotToggle.tsx
├── types/
│   ├── calendar.ts
│   └── scheduling.ts
├── lib/
│   ├── dateUtils.ts
│   ├── calendarUtils.ts
│   └── validationSchemas.ts
└── test/
    ├── setup.ts
    ├── mocks/
    └── utils/

functions/src/
├── oauth/
│   ├── init.ts
│   ├── callback.ts
│   ├── refresh.ts
│   ├── revoke.ts
│   └── tokenStorage.ts
├── calendar/
│   ├── fetchEvents.ts
│   ├── freeBusy.ts
│   └── availability.ts
├── scheduling/
│   ├── scheduleTask.ts
│   ├── createEvent.ts
│   ├── updateEvent.ts
│   ├── deleteEvent.ts
│   ├── eventBuilder.ts
│   ├── engine.ts
│   └── getSuggestions.ts
├── sync/
│   ├── onTaskCompleted.ts
│   ├── onTaskDeleted.ts
│   ├── onTaskUpdated.ts
│   └── syncLogger.ts
├── webhooks/
│   ├── calendarWebhook.ts
│   ├── processChange.ts
│   └── watchManager.ts
└── utils/
    └── calendarClient.ts
```
