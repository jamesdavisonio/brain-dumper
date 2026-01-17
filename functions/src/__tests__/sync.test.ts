/**
 * Sync functions tests
 * Tests for Task <-> Calendar synchronization
 * @module __tests__/sync.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Store mocks in a way that can be accessed after hoisting
const mocks = {
  firestoreUpdate: vi.fn().mockResolvedValue(undefined),
  firestoreDoc: vi.fn(),
  firestoreCollection: vi.fn(),
  firestore: vi.fn(),
  getAuthenticatedClient: vi.fn(),
  calendarEventsInsert: vi.fn(),
  calendarEventsUpdate: vi.fn(),
  calendarEventsDelete: vi.fn(),
  calendarClient: null as any,
};

// Initialize mock structure
mocks.firestoreDoc.mockImplementation(() => ({
  update: mocks.firestoreUpdate,
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));
mocks.firestoreCollection.mockImplementation(() => ({
  doc: mocks.firestoreDoc,
}));
mocks.firestore.mockImplementation(() => ({
  collection: mocks.firestoreCollection,
}));
mocks.calendarClient = {
  events: {
    insert: mocks.calendarEventsInsert,
    update: mocks.calendarEventsUpdate,
    delete: mocks.calendarEventsDelete,
  },
};

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: vi.fn(),
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          update: mocks.firestoreUpdate,
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
        }),
      }),
    }),
  },
  initializeApp: vi.fn(),
  firestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        update: mocks.firestoreUpdate,
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }),
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        update: mocks.firestoreUpdate,
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }),
  }),
}));

// Mock OAuth token storage
vi.mock('../oauth/tokenStorage', () => ({
  getAuthenticatedClient: (...args: any[]) => mocks.getAuthenticatedClient(...args),
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    calendar: () => mocks.calendarClient,
    auth: {
      OAuth2: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import {
  shouldSyncTask,
  datesAreDifferent,
  toDate,
  updateSyncMetadata,
  getCalendarClient,
} from '../sync/syncUtils';

import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  deleteCalendarEventDirect,
  TaskData,
} from '../sync/calendarSync';

// ============================================================
// Test Data Factories
// ============================================================

function createMockTask(overrides: Partial<TaskData> = {}): TaskData {
  return {
    id: 'task-123',
    userId: 'user-123',
    title: 'Test Task',
    description: 'Test description',
    scheduledStart: new Date('2024-01-15T09:00:00Z'),
    scheduledEnd: new Date('2024-01-15T10:00:00Z'),
    calendarId: 'primary',
    calendarEventId: undefined,
    completed: false,
    archived: false,
    taskType: 'coding',
    priority: 'medium',
    ...overrides,
  };
}

// ============================================================
// syncUtils Tests
// ============================================================

describe('syncUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldSyncTask', () => {
    it('should return true for scheduled tasks with calendarId', () => {
      const task = {
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        calendarId: 'cal-1',
      };
      expect(shouldSyncTask(task)).toBe(true);
    });

    it('should return false for tasks without scheduledStart', () => {
      const task = {
        calendarId: 'cal-1',
      };
      expect(shouldSyncTask(task)).toBe(false);
    });

    it('should return false for tasks without calendarId', () => {
      const task = {
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
      };
      expect(shouldSyncTask(task)).toBe(false);
    });

    it('should return false for empty task', () => {
      const task = {};
      expect(shouldSyncTask(task)).toBe(false);
    });

    it('should return false for task with only title', () => {
      const task = { title: 'Test' };
      expect(shouldSyncTask(task)).toBe(false);
    });

    it('should return true when scheduledStart is string', () => {
      const task = {
        scheduledStart: '2024-01-15T09:00:00Z',
        calendarId: 'cal-1',
      };
      expect(shouldSyncTask(task)).toBe(true);
    });
  });

  describe('datesAreDifferent', () => {
    it('should return false for two identical Dates', () => {
      const date1 = new Date('2024-01-15T09:00:00Z');
      const date2 = new Date('2024-01-15T09:00:00Z');
      expect(datesAreDifferent(date1, date2)).toBe(false);
    });

    it('should return true for two different Dates', () => {
      const date1 = new Date('2024-01-15T09:00:00Z');
      const date2 = new Date('2024-01-15T10:00:00Z');
      expect(datesAreDifferent(date1, date2)).toBe(true);
    });

    it('should return false for two null values', () => {
      expect(datesAreDifferent(null, null)).toBe(false);
    });

    it('should return false for two undefined values', () => {
      expect(datesAreDifferent(undefined, undefined)).toBe(false);
    });

    it('should return true when one is null and other is a Date', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      expect(datesAreDifferent(null, date)).toBe(true);
      expect(datesAreDifferent(date, null)).toBe(true);
    });

    it('should handle ISO string dates', () => {
      const str1 = '2024-01-15T09:00:00Z';
      const str2 = '2024-01-15T09:00:00Z';
      expect(datesAreDifferent(str1, str2)).toBe(false);
    });

    it('should return true for different ISO string dates', () => {
      const str1 = '2024-01-15T09:00:00Z';
      const str2 = '2024-01-15T10:00:00Z';
      expect(datesAreDifferent(str1, str2)).toBe(true);
    });

    it('should handle Firestore Timestamp-like objects', () => {
      const timestamp1 = { toDate: () => new Date('2024-01-15T09:00:00Z') };
      const timestamp2 = { toDate: () => new Date('2024-01-15T09:00:00Z') };
      expect(datesAreDifferent(timestamp1, timestamp2)).toBe(false);
    });

    it('should compare Date and Timestamp correctly', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      const timestamp = { toDate: () => new Date('2024-01-15T09:00:00Z') };
      expect(datesAreDifferent(date, timestamp)).toBe(false);
    });
  });

  describe('toDate', () => {
    it('should return undefined for null', () => {
      expect(toDate(null)).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      expect(toDate(undefined)).toBeUndefined();
    });

    it('should return same Date object for Date input', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      expect(toDate(date)).toBe(date);
    });

    it('should parse ISO string to Date', () => {
      const str = '2024-01-15T09:00:00Z';
      const result = toDate(str);
      expect(result).toBeInstanceOf(Date);
      // toISOString() adds milliseconds, so compare timestamps instead
      expect(result?.getTime()).toBe(new Date(str).getTime());
    });

    it('should convert Firestore Timestamp-like object', () => {
      const expected = new Date('2024-01-15T09:00:00Z');
      const timestamp = { toDate: () => expected };
      expect(toDate(timestamp)).toBe(expected);
    });
  });

  describe('updateSyncMetadata', () => {
    it('should call Firestore update with correct data', async () => {
      const taskId = 'task-123';
      const metadata = {
        calendarEventId: 'event-456',
        syncStatus: 'synced' as const,
      };

      await updateSyncMetadata(taskId, metadata);

      expect(mocks.firestoreUpdate).toHaveBeenCalled();
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.calendarEventId).toBe('event-456');
      expect(updateArg.syncMetadata.syncStatus).toBe('synced');
      expect(updateArg.syncMetadata.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('should include error message when provided', async () => {
      const taskId = 'task-123';
      const metadata = {
        syncStatus: 'error' as const,
        syncError: 'Failed to sync',
      };

      await updateSyncMetadata(taskId, metadata);

      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncError).toBe('Failed to sync');
    });
  });

  describe('getCalendarClient', () => {
    it('should return null when auth client is not available', async () => {
      mocks.getAuthenticatedClient.mockResolvedValue(null);

      const result = await getCalendarClient('user-123');

      expect(result).toBeNull();
    });

    it('should return calendar client when auth is available', async () => {
      mocks.getAuthenticatedClient.mockResolvedValue({});

      const result = await getCalendarClient('user-123');

      expect(result).toBe(mocks.calendarClient);
    });

    it('should return null on auth error', async () => {
      mocks.getAuthenticatedClient.mockRejectedValue(new Error('Auth failed'));

      const result = await getCalendarClient('user-123');

      expect(result).toBeNull();
    });
  });
});

// ============================================================
// calendarSync Tests
// ============================================================

describe('calendarSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedClient.mockResolvedValue({});
  });

  describe('createCalendarEvent', () => {
    it('should create event and return event ID', async () => {
      const task = createMockTask();
      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: 'event-123' },
      });

      const result = await createCalendarEvent(task);

      expect(result).toBe('event-123');
      expect(mocks.calendarEventsInsert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: expect.objectContaining({
          summary: expect.stringContaining('Test Task'),
        }),
      });
    });

    it('should update sync metadata on success', async () => {
      const task = createMockTask();
      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: 'event-123' },
      });

      await createCalendarEvent(task);

      expect(mocks.firestoreUpdate).toHaveBeenCalled();
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.calendarEventId).toBe('event-123');
      expect(updateArg.syncMetadata.syncStatus).toBe('synced');
    });

    it('should return null when calendar client is unavailable', async () => {
      mocks.getAuthenticatedClient.mockResolvedValue(null);
      const task = createMockTask();

      const result = await createCalendarEvent(task);

      expect(result).toBeNull();
      expect(mocks.calendarEventsInsert).not.toHaveBeenCalled();
    });

    it('should return null when task has no scheduledStart', async () => {
      const task = createMockTask({ scheduledStart: undefined });

      const result = await createCalendarEvent(task);

      expect(result).toBeNull();
    });

    it('should return null when task has no calendarId', async () => {
      const task = createMockTask({ calendarId: undefined });

      const result = await createCalendarEvent(task);

      expect(result).toBeNull();
    });

    it('should handle API error and update metadata', async () => {
      const task = createMockTask();
      mocks.calendarEventsInsert.mockRejectedValue(new Error('API Error'));

      const result = await createCalendarEvent(task);

      expect(result).toBeNull();
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncStatus).toBe('error');
      expect(updateArg.syncMetadata.syncError).toBe('API Error');
    });

    it('should use default duration when scheduledEnd is missing', async () => {
      const task = createMockTask({ scheduledEnd: undefined });
      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: 'event-123' },
      });

      await createCalendarEvent(task);

      expect(mocks.calendarEventsInsert).toHaveBeenCalled();
    });

    it('should handle string dates in task', async () => {
      const task = createMockTask({
        scheduledStart: '2024-01-15T09:00:00Z' as any,
        scheduledEnd: '2024-01-15T10:00:00Z' as any,
      });
      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: 'event-123' },
      });

      const result = await createCalendarEvent(task);

      expect(result).toBe('event-123');
    });
  });

  describe('updateCalendarEvent', () => {
    it('should update event successfully', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockResolvedValue({ data: {} });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsUpdate).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-123',
        requestBody: expect.any(Object),
      });
    });

    it('should update sync metadata on success', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockResolvedValue({ data: {} });

      await updateCalendarEvent(task);

      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncStatus).toBe('synced');
    });

    it('should delete event when task is completed', async () => {
      const task = createMockTask({
        calendarEventId: 'event-123',
        completed: true,
      });
      mocks.calendarEventsDelete.mockResolvedValue({});

      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalled();
      expect(mocks.calendarEventsUpdate).not.toHaveBeenCalled();
    });

    it('should delete event when task is archived', async () => {
      const task = createMockTask({
        calendarEventId: 'event-123',
        archived: true,
      });
      mocks.calendarEventsDelete.mockResolvedValue({});

      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalled();
    });

    it('should return false when calendar client is unavailable', async () => {
      mocks.getAuthenticatedClient.mockResolvedValue(null);
      const task = createMockTask({ calendarEventId: 'event-123' });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });

    it('should return false when task has no calendarEventId', async () => {
      const task = createMockTask();

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });

    it('should return false when task has no calendarId', async () => {
      const task = createMockTask({
        calendarEventId: 'event-123',
        calendarId: undefined,
      });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });

    it('should handle 404 error gracefully', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockRejectedValue({ code: 404 });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.calendarEventId).toBeNull();
    });

    it('should handle 404 with response.status', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockRejectedValue({ response: { status: 404 } });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
    });

    it('should handle other API errors', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockRejectedValue(new Error('API Error'));

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncStatus).toBe('error');
    });
  });

  describe('deleteCalendarEvent', () => {
    it('should delete event successfully', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsDelete.mockResolvedValue({});

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-123',
      });
    });

    it('should update sync metadata on success', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsDelete.mockResolvedValue({});

      await deleteCalendarEvent(task);

      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.calendarEventId).toBeNull();
      expect(updateArg.syncMetadata.syncStatus).toBe('synced');
    });

    it('should return true when task has no calendarEventId', async () => {
      const task = createMockTask();

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).not.toHaveBeenCalled();
    });

    it('should return true when task has no calendarId', async () => {
      const task = createMockTask({
        calendarEventId: 'event-123',
        calendarId: undefined,
      });

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).not.toHaveBeenCalled();
    });

    it('should return false when calendar client is unavailable', async () => {
      mocks.getAuthenticatedClient.mockResolvedValue(null);
      const task = createMockTask({ calendarEventId: 'event-123' });

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(false);
    });

    it('should handle 404 error gracefully (event already deleted)', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsDelete.mockRejectedValue({ code: 404 });

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(true);
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.calendarEventId).toBeNull();
      expect(updateArg.syncMetadata.syncStatus).toBe('synced');
    });

    it('should handle 404 with response.status', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsDelete.mockRejectedValue({ response: { status: 404 } });

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(true);
    });

    it('should handle other API errors', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsDelete.mockRejectedValue(new Error('API Error'));

      const result = await deleteCalendarEvent(task);

      expect(result).toBe(false);
      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncStatus).toBe('error');
    });
  });

  describe('deleteCalendarEventDirect', () => {
    it('should delete event without updating task metadata', async () => {
      mocks.calendarEventsDelete.mockResolvedValue({});

      const result = await deleteCalendarEventDirect(
        mocks.calendarClient as any,
        'primary',
        'event-123'
      );

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-123',
      });
    });

    it('should handle 404 gracefully', async () => {
      mocks.calendarEventsDelete.mockRejectedValue({ code: 404 });

      const result = await deleteCalendarEventDirect(
        mocks.calendarClient as any,
        'primary',
        'event-123'
      );

      expect(result).toBe(true);
    });

    it('should handle other errors', async () => {
      mocks.calendarEventsDelete.mockRejectedValue(new Error('API Error'));

      const result = await deleteCalendarEventDirect(
        mocks.calendarClient as any,
        'primary',
        'event-123'
      );

      expect(result).toBe(false);
    });
  });
});

// ============================================================
// Trigger Logic Tests
// ============================================================

describe('Trigger Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedClient.mockResolvedValue({});
  });

  describe('Task Creation Scenarios', () => {
    it('should sync task that is created with schedule', async () => {
      const taskData = {
        userId: 'user-123',
        title: 'Test Task',
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        scheduledEnd: new Date('2024-01-15T10:00:00Z'),
        calendarId: 'primary',
        completed: false,
        archived: false,
        taskType: 'coding',
        priority: 'medium' as const,
      };

      const shouldSync = shouldSyncTask(taskData);
      expect(shouldSync).toBe(true);
    });

    it('should not sync task created without schedule', async () => {
      const taskData = {
        userId: 'user-123',
        title: 'Test Task',
        completed: false,
        archived: false,
        priority: 'medium',
      };

      const shouldSync = shouldSyncTask(taskData);
      expect(shouldSync).toBe(false);
    });
  });

  describe('Task Update Scenarios', () => {
    it('should detect schedule change', () => {
      const before = {
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        scheduledEnd: new Date('2024-01-15T10:00:00Z'),
      };
      const after = {
        scheduledStart: new Date('2024-01-15T11:00:00Z'),
        scheduledEnd: new Date('2024-01-15T12:00:00Z'),
      };

      expect(datesAreDifferent(before.scheduledStart, after.scheduledStart)).toBe(true);
      expect(datesAreDifferent(before.scheduledEnd, after.scheduledEnd)).toBe(true);
    });

    it('should detect no schedule change', () => {
      const before = {
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        scheduledEnd: new Date('2024-01-15T10:00:00Z'),
      };
      const after = {
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        scheduledEnd: new Date('2024-01-15T10:00:00Z'),
      };

      expect(datesAreDifferent(before.scheduledStart, after.scheduledStart)).toBe(false);
      expect(datesAreDifferent(before.scheduledEnd, after.scheduledEnd)).toBe(false);
    });

    it('should detect task becoming scheduled', () => {
      const before = { title: 'Test' };
      const after = {
        title: 'Test',
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        calendarId: 'primary',
      };

      expect(shouldSyncTask(before)).toBe(false);
      expect(shouldSyncTask(after)).toBe(true);
    });

    it('should detect task becoming unscheduled', () => {
      const before = {
        title: 'Test',
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        calendarId: 'primary',
      };
      const after = { title: 'Test' };

      expect(shouldSyncTask(before)).toBe(true);
      expect(shouldSyncTask(after)).toBe(false);
    });
  });

  describe('Task Completion/Archive Scenarios', () => {
    it('should handle task completion', async () => {
      const task = createMockTask({
        calendarEventId: 'event-123',
        completed: true,
      });
      mocks.calendarEventsDelete.mockResolvedValue({});

      // When a task is completed, updateCalendarEvent should delete the event
      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalled();
    });

    it('should handle task archival', async () => {
      const task = createMockTask({
        calendarEventId: 'event-123',
        archived: true,
      });
      mocks.calendarEventsDelete.mockResolvedValue({});

      const result = await updateCalendarEvent(task);

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalled();
    });
  });

  describe('Task Deletion Scenarios', () => {
    it('should delete calendar event when task is deleted', async () => {
      mocks.calendarEventsDelete.mockResolvedValue({});

      const result = await deleteCalendarEventDirect(
        mocks.calendarClient as any,
        'primary',
        'event-123'
      );

      expect(result).toBe(true);
      expect(mocks.calendarEventsDelete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-123',
      });
    });
  });
});

// ============================================================
// Edge Cases and Error Handling
// ============================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedClient.mockResolvedValue({});
  });

  describe('Timestamp Conversion', () => {
    it('should handle Firestore Timestamp objects', () => {
      const timestamp = {
        toDate: () => new Date('2024-01-15T09:00:00Z'),
      };

      const result = toDate(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-15T09:00:00.000Z');
    });

    it('should handle mixed date formats in comparison', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      const str = '2024-01-15T09:00:00Z';
      const timestamp = { toDate: () => new Date('2024-01-15T09:00:00Z') };

      expect(datesAreDifferent(date, str)).toBe(false);
      expect(datesAreDifferent(date, timestamp)).toBe(false);
      expect(datesAreDifferent(str, timestamp)).toBe(false);
    });
  });

  describe('Missing Data Handling', () => {
    it('should handle task with missing optional fields', async () => {
      const task: TaskData = {
        id: 'task-123',
        userId: 'user-123',
        title: 'Test Task',
        scheduledStart: new Date('2024-01-15T09:00:00Z'),
        scheduledEnd: new Date('2024-01-15T10:00:00Z'),
        calendarId: 'primary',
        completed: false,
        archived: false,
        taskType: 'other',
        priority: 'medium',
      };

      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: 'event-123' },
      });

      const result = await createCalendarEvent(task);

      expect(result).toBe('event-123');
    });

    it('should handle empty string calendarEventId', async () => {
      const task = createMockTask({ calendarEventId: '' });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });
  });

  describe('API Error Handling', () => {
    it('should handle network errors', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockRejectedValue(new Error('Network error'));

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });

    it('should handle rate limit errors', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockRejectedValue({
        code: 429,
        message: 'Rate limit exceeded',
      });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });

    it('should handle auth errors', async () => {
      const task = createMockTask({ calendarEventId: 'event-123' });
      mocks.calendarEventsUpdate.mockRejectedValue({
        code: 401,
        message: 'Unauthorized',
      });

      const result = await updateCalendarEvent(task);

      expect(result).toBe(false);
    });
  });

  describe('Sync Status Transitions', () => {
    it('should transition from pending to synced on success', async () => {
      const task = createMockTask();
      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: 'event-123' },
      });

      await createCalendarEvent(task);

      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncStatus).toBe('synced');
    });

    it('should transition to error on failure', async () => {
      const task = createMockTask();
      mocks.calendarEventsInsert.mockRejectedValue(new Error('Failed'));

      await createCalendarEvent(task);

      const updateArg = mocks.firestoreUpdate.mock.calls[0][0];
      expect(updateArg.syncMetadata.syncStatus).toBe('error');
    });
  });
});

// ============================================================
// Integration-like Tests
// ============================================================

describe('Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedClient.mockResolvedValue({});
  });

  it('should handle full lifecycle: create -> update -> delete', async () => {
    // 1. Create
    const task = createMockTask();
    mocks.calendarEventsInsert.mockResolvedValue({
      data: { id: 'event-123' },
    });

    const eventId = await createCalendarEvent(task);
    expect(eventId).toBe('event-123');

    // 2. Update
    const updatedTask = {
      ...task,
      calendarEventId: 'event-123',
      title: 'Updated Task',
    };
    mocks.calendarEventsUpdate.mockResolvedValue({ data: {} });

    const updateResult = await updateCalendarEvent(updatedTask);
    expect(updateResult).toBe(true);

    // 3. Delete
    mocks.calendarEventsDelete.mockResolvedValue({});

    const deleteResult = await deleteCalendarEvent(updatedTask);
    expect(deleteResult).toBe(true);
  });

  it('should handle schedule -> unschedule -> reschedule cycle', async () => {
    // 1. Initial scheduled task
    const task = createMockTask();
    expect(shouldSyncTask(task)).toBe(true);

    mocks.calendarEventsInsert.mockResolvedValue({
      data: { id: 'event-123' },
    });
    await createCalendarEvent(task);

    // 2. Unschedule (remove scheduledStart)
    const unscheduledTask = {
      ...task,
      scheduledStart: undefined,
      calendarId: undefined,
      calendarEventId: 'event-123',
    };
    expect(shouldSyncTask(unscheduledTask)).toBe(false);

    // 3. Reschedule
    const rescheduledTask = {
      ...task,
      scheduledStart: new Date('2024-01-16T09:00:00Z'),
      scheduledEnd: new Date('2024-01-16T10:00:00Z'),
    };
    expect(shouldSyncTask(rescheduledTask)).toBe(true);
  });

  it('should handle complete -> uncomplete cycle', async () => {
    // 1. Active task with event
    const activeTask = createMockTask({ calendarEventId: 'event-123' });
    mocks.calendarEventsUpdate.mockResolvedValue({ data: {} });

    const updateResult1 = await updateCalendarEvent(activeTask);
    expect(updateResult1).toBe(true);
    expect(mocks.calendarEventsUpdate).toHaveBeenCalled();

    vi.clearAllMocks();

    // 2. Complete task (should delete event)
    const completedTask = { ...activeTask, completed: true };
    mocks.calendarEventsDelete.mockResolvedValue({});

    const updateResult2 = await updateCalendarEvent(completedTask);
    expect(updateResult2).toBe(true);
    expect(mocks.calendarEventsDelete).toHaveBeenCalled();
  });

  it('should handle calendar change (move event to different calendar)', async () => {
    // When calendar changes, the event should be deleted from old calendar
    // and created in new calendar
    const task = createMockTask({
      calendarEventId: 'event-123',
      calendarId: 'calendar-1',
    });

    // Delete from old calendar
    mocks.calendarEventsDelete.mockResolvedValue({});
    const deleteResult = await deleteCalendarEvent(task);
    expect(deleteResult).toBe(true);

    vi.clearAllMocks();

    // Create in new calendar
    const movedTask = { ...task, calendarId: 'calendar-2', calendarEventId: undefined };
    mocks.calendarEventsInsert.mockResolvedValue({
      data: { id: 'event-456' },
    });
    const createResult = await createCalendarEvent(movedTask);
    expect(createResult).toBe('event-456');
  });
});

// ============================================================
// Priority-specific Tests
// ============================================================

describe('Priority Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedClient.mockResolvedValue({});
  });

  it('should create event for high priority task', async () => {
    const task = createMockTask({ priority: 'high' });
    mocks.calendarEventsInsert.mockResolvedValue({
      data: { id: 'event-high' },
    });

    const result = await createCalendarEvent(task);

    expect(result).toBe('event-high');
    const requestBody = mocks.calendarEventsInsert.mock.calls[0][0].requestBody;
    expect(requestBody.colorId).toBe('11'); // Red for high priority
  });

  it('should create event for medium priority task', async () => {
    const task = createMockTask({ priority: 'medium' });
    mocks.calendarEventsInsert.mockResolvedValue({
      data: { id: 'event-medium' },
    });

    const result = await createCalendarEvent(task);

    expect(result).toBe('event-medium');
    const requestBody = mocks.calendarEventsInsert.mock.calls[0][0].requestBody;
    expect(requestBody.colorId).toBe('5'); // Yellow for medium priority
  });

  it('should create event for low priority task', async () => {
    const task = createMockTask({ priority: 'low' });
    mocks.calendarEventsInsert.mockResolvedValue({
      data: { id: 'event-low' },
    });

    const result = await createCalendarEvent(task);

    expect(result).toBe('event-low');
    const requestBody = mocks.calendarEventsInsert.mock.calls[0][0].requestBody;
    expect(requestBody.colorId).toBe('9'); // Blue for low priority
  });
});

// ============================================================
// Task Type Tests
// ============================================================

describe('Task Type Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedClient.mockResolvedValue({});
  });

  const taskTypes = ['deep_work', 'coding', 'call', 'meeting', 'personal', 'admin', 'health', 'other'];

  taskTypes.forEach((taskType) => {
    it(`should create event for ${taskType} task type`, async () => {
      const task = createMockTask({ taskType });
      mocks.calendarEventsInsert.mockResolvedValue({
        data: { id: `event-${taskType}` },
      });

      const result = await createCalendarEvent(task);

      expect(result).toBe(`event-${taskType}`);
      const requestBody = mocks.calendarEventsInsert.mock.calls[0][0].requestBody;
      expect(requestBody.summary).toContain(`[${taskType}]`);
    });
  });
});
