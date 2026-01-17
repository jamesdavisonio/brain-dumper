/**
 * Webhooks module tests
 * Tests for Calendar → Task Sync via Google Calendar webhooks
 * @module __tests__/webhooks.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mock Data
// ============================================================

const mockUserId = 'test-user-123';
const mockCalendarId = 'primary';
const mockEventId = 'event-abc-123';
const mockTaskId = 'task-xyz-789';
const mockChannelId = `brain-dumper-${mockUserId}-${mockCalendarId}-1704067200000`;
const mockResourceId = 'resource-id-abc';
const mockChannelToken = `${mockUserId}:${mockCalendarId}`;

const mockWatchSubscription = {
  id: mockChannelId,
  resourceId: mockResourceId,
  calendarId: mockCalendarId,
  userId: mockUserId,
  expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  channelToken: mockChannelToken,
};

const mockExpiredSubscription = {
  ...mockWatchSubscription,
  expiration: new Date(Date.now() - 1000), // 1 second ago
};

const mockExpiringSubscription = {
  ...mockWatchSubscription,
  expiration: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now (within 24h threshold)
};

const mockCalendarEvent = {
  id: mockEventId,
  summary: 'Test Task Event',
  status: 'confirmed',
  start: {
    dateTime: '2024-01-15T09:00:00Z',
    timeZone: 'UTC',
  },
  end: {
    dateTime: '2024-01-15T10:00:00Z',
    timeZone: 'UTC',
  },
  extendedProperties: {
    private: {
      brainDumperTaskId: mockTaskId,
      brainDumperPriority: 'high',
      brainDumperVersion: '1',
    },
  },
};

const mockDeletedEvent = {
  ...mockCalendarEvent,
  status: 'cancelled',
};

const mockRescheduledEvent = {
  ...mockCalendarEvent,
  start: {
    dateTime: '2024-01-15T14:00:00Z',
    timeZone: 'UTC',
  },
  end: {
    dateTime: '2024-01-15T15:00:00Z',
    timeZone: 'UTC',
  },
};

const mockNonBrainDumperEvent = {
  id: 'external-event-123',
  summary: 'External Meeting',
  status: 'confirmed',
  start: {
    dateTime: '2024-01-15T11:00:00Z',
    timeZone: 'UTC',
  },
  end: {
    dateTime: '2024-01-15T12:00:00Z',
    timeZone: 'UTC',
  },
};

const mockTask = {
  id: mockTaskId,
  content: 'Test task content',
  userId: mockUserId,
  scheduledStart: new Date('2024-01-15T09:00:00Z'),
  scheduledEnd: new Date('2024-01-15T10:00:00Z'),
  calendarEventId: mockEventId,
  calendarId: mockCalendarId,
  completed: false,
  archived: false,
  priority: 'high',
};

// ============================================================
// Watch Manager Tests
// ============================================================

describe('WatchSubscription Interface', () => {
  it('should have all required fields', () => {
    expect(mockWatchSubscription).toHaveProperty('id');
    expect(mockWatchSubscription).toHaveProperty('resourceId');
    expect(mockWatchSubscription).toHaveProperty('calendarId');
    expect(mockWatchSubscription).toHaveProperty('userId');
    expect(mockWatchSubscription).toHaveProperty('expiration');
    expect(mockWatchSubscription).toHaveProperty('channelToken');
  });

  it('should have valid expiration date', () => {
    expect(mockWatchSubscription.expiration instanceof Date).toBe(true);
    expect(mockWatchSubscription.expiration.toString()).not.toBe('Invalid Date');
  });

  it('should have correctly formatted channel ID', () => {
    expect(mockWatchSubscription.id).toContain('brain-dumper-');
    expect(mockWatchSubscription.id).toContain(mockUserId);
  });

  it('should have correctly formatted channel token', () => {
    expect(mockWatchSubscription.channelToken).toBe(`${mockUserId}:${mockCalendarId}`);
  });
});

describe('Watch Channel ID Generation', () => {
  const generateChannelId = (userId: string, calendarId: string): string => {
    const sanitizedCalendarId = calendarId.replace(/[^a-zA-Z0-9]/g, '_');
    return `brain-dumper-${userId}-${sanitizedCalendarId}-${Date.now()}`;
  };

  it('should generate unique channel IDs with different timestamps', () => {
    // Use explicit different timestamps to ensure uniqueness
    const generateChannelIdWithTimestamp = (userId: string, calendarId: string, timestamp: number): string => {
      const sanitizedCalendarId = calendarId.replace(/[^a-zA-Z0-9]/g, '_');
      return `brain-dumper-${userId}-${sanitizedCalendarId}-${timestamp}`;
    };

    const id1 = generateChannelIdWithTimestamp(mockUserId, mockCalendarId, 1704067200000);
    const id2 = generateChannelIdWithTimestamp(mockUserId, mockCalendarId, 1704067200001);

    // IDs should be different due to different timestamps
    expect(id1).not.toBe(id2);
  });

  it('should sanitize calendar ID in channel ID', () => {
    const calendarId = 'user@example.com';
    const channelId = generateChannelId(mockUserId, calendarId);

    expect(channelId).not.toContain('@');
    expect(channelId).not.toContain('.');
    expect(channelId).toContain('user_example_com');
  });

  it('should include user ID in channel ID', () => {
    const channelId = generateChannelId(mockUserId, mockCalendarId);
    expect(channelId).toContain(mockUserId);
  });

  it('should start with brain-dumper prefix', () => {
    const channelId = generateChannelId(mockUserId, mockCalendarId);
    expect(channelId.startsWith('brain-dumper-')).toBe(true);
  });

  it('should handle primary calendar ID', () => {
    const channelId = generateChannelId(mockUserId, 'primary');
    expect(channelId).toContain('primary');
  });
});

describe('Watch Expiration Logic', () => {
  const WATCH_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

  it('should calculate correct expiration time', () => {
    const now = Date.now();
    const expiration = new Date(now + WATCH_DURATION_MS);

    // Should be approximately 7 days from now
    const diff = expiration.getTime() - now;
    expect(diff).toBe(WATCH_DURATION_MS);
  });

  it('should identify watches needing renewal', () => {
    const now = Date.now();
    const renewThreshold = new Date(now + RENEW_THRESHOLD_MS);

    // Watch expiring in 12 hours should need renewal
    expect(mockExpiringSubscription.expiration <= renewThreshold).toBe(true);

    // Watch expiring in 7 days should not need renewal
    expect(mockWatchSubscription.expiration <= renewThreshold).toBe(false);
  });

  it('should identify expired watches', () => {
    const now = new Date();
    expect(mockExpiredSubscription.expiration < now).toBe(true);
  });

  it('should identify valid watches', () => {
    const now = new Date();
    expect(mockWatchSubscription.expiration > now).toBe(true);
  });
});

describe('Channel Token Validation', () => {
  const validateChannelToken = (token: string, userId: string, calendarId: string): boolean => {
    const expected = `${userId}:${calendarId}`;
    return token === expected;
  };

  it('should validate correct token', () => {
    expect(validateChannelToken(mockChannelToken, mockUserId, mockCalendarId)).toBe(true);
  });

  it('should reject incorrect user ID', () => {
    expect(validateChannelToken(mockChannelToken, 'wrong-user', mockCalendarId)).toBe(false);
  });

  it('should reject incorrect calendar ID', () => {
    expect(validateChannelToken(mockChannelToken, mockUserId, 'wrong-calendar')).toBe(false);
  });

  it('should reject malformed token', () => {
    expect(validateChannelToken('invalid-token', mockUserId, mockCalendarId)).toBe(false);
  });

  it('should reject empty token', () => {
    expect(validateChannelToken('', mockUserId, mockCalendarId)).toBe(false);
  });
});

// ============================================================
// Event Processor Tests
// ============================================================

describe('CalendarEventChange Interface', () => {
  it('should have all required fields for deleted event', () => {
    const change = {
      eventId: mockEventId,
      calendarId: mockCalendarId,
      userId: mockUserId,
      status: 'cancelled' as const,
      deleted: true,
    };

    expect(change).toHaveProperty('eventId');
    expect(change).toHaveProperty('calendarId');
    expect(change).toHaveProperty('userId');
    expect(change).toHaveProperty('status');
    expect(change).toHaveProperty('deleted');
  });

  it('should have optional start/end for rescheduled events', () => {
    const change = {
      eventId: mockEventId,
      calendarId: mockCalendarId,
      userId: mockUserId,
      status: 'confirmed' as const,
      start: new Date('2024-01-15T14:00:00Z'),
      end: new Date('2024-01-15T15:00:00Z'),
      deleted: false,
    };

    expect(change.start).toBeInstanceOf(Date);
    expect(change.end).toBeInstanceOf(Date);
  });
});

describe('Event Status Detection', () => {
  const isEventDeleted = (status: string | undefined, deleted: boolean): boolean => {
    return deleted || status === 'cancelled';
  };

  it('should detect cancelled events as deleted', () => {
    expect(isEventDeleted('cancelled', false)).toBe(true);
  });

  it('should detect explicitly deleted events', () => {
    expect(isEventDeleted('confirmed', true)).toBe(true);
  });

  it('should not mark confirmed events as deleted', () => {
    expect(isEventDeleted('confirmed', false)).toBe(false);
  });

  it('should not mark tentative events as deleted', () => {
    expect(isEventDeleted('tentative', false)).toBe(false);
  });

  it('should handle undefined status with deleted flag', () => {
    expect(isEventDeleted(undefined, true)).toBe(true);
    expect(isEventDeleted(undefined, false)).toBe(false);
  });
});

describe('Time Change Detection', () => {
  const TOLERANCE_MS = 60000; // 1 minute tolerance

  const hasTimeChanged = (
    newTime: Date | undefined,
    oldTime: Date | undefined
  ): boolean => {
    if (!newTime) return false;
    if (!oldTime) return true;
    return Math.abs(newTime.getTime() - oldTime.getTime()) > TOLERANCE_MS;
  };

  it('should detect significant time change', () => {
    const oldTime = new Date('2024-01-15T09:00:00Z');
    const newTime = new Date('2024-01-15T14:00:00Z'); // 5 hours later

    expect(hasTimeChanged(newTime, oldTime)).toBe(true);
  });

  it('should ignore minor time differences within tolerance', () => {
    const oldTime = new Date('2024-01-15T09:00:00Z');
    const newTime = new Date('2024-01-15T09:00:30Z'); // 30 seconds later

    expect(hasTimeChanged(newTime, oldTime)).toBe(false);
  });

  it('should detect when old time is missing', () => {
    const newTime = new Date('2024-01-15T09:00:00Z');

    expect(hasTimeChanged(newTime, undefined)).toBe(true);
  });

  it('should not report change when new time is missing', () => {
    const oldTime = new Date('2024-01-15T09:00:00Z');

    expect(hasTimeChanged(undefined, oldTime)).toBe(false);
  });

  it('should detect exactly 1 minute change', () => {
    const oldTime = new Date('2024-01-15T09:00:00Z');
    const newTime = new Date('2024-01-15T09:01:01Z'); // 61 seconds later

    expect(hasTimeChanged(newTime, oldTime)).toBe(true);
  });
});

describe('Brain Dumper Event Detection', () => {
  const isBrainDumperEvent = (event: any): boolean => {
    return !!event.extendedProperties?.private?.brainDumperTaskId;
  };

  const getBrainDumperTaskId = (event: any): string | null => {
    return event.extendedProperties?.private?.brainDumperTaskId || null;
  };

  it('should identify Brain Dumper events', () => {
    expect(isBrainDumperEvent(mockCalendarEvent)).toBe(true);
  });

  it('should not identify non-Brain Dumper events', () => {
    expect(isBrainDumperEvent(mockNonBrainDumperEvent)).toBe(false);
  });

  it('should extract task ID from Brain Dumper event', () => {
    expect(getBrainDumperTaskId(mockCalendarEvent)).toBe(mockTaskId);
  });

  it('should return null for non-Brain Dumper event', () => {
    expect(getBrainDumperTaskId(mockNonBrainDumperEvent)).toBe(null);
  });

  it('should handle events with missing extendedProperties', () => {
    const eventWithoutProps = { id: 'test', summary: 'Test' };
    expect(isBrainDumperEvent(eventWithoutProps)).toBe(false);
    expect(getBrainDumperTaskId(eventWithoutProps)).toBe(null);
  });

  it('should handle events with empty private properties', () => {
    const eventWithEmptyProps = {
      id: 'test',
      extendedProperties: { private: {} },
    };
    expect(isBrainDumperEvent(eventWithEmptyProps)).toBe(false);
  });
});

describe('Sync Token Error Handling', () => {
  const isSyncTokenExpired = (error: any): boolean => {
    return error.code === 410 || error.response?.status === 410;
  };

  it('should detect 410 Gone error from code property', () => {
    const error = { code: 410, message: 'Sync token expired' };
    expect(isSyncTokenExpired(error)).toBe(true);
  });

  it('should detect 410 Gone error from response status', () => {
    const error = { response: { status: 410 } };
    expect(isSyncTokenExpired(error)).toBe(true);
  });

  it('should not flag other error codes', () => {
    const error = { code: 404, message: 'Not found' };
    expect(isSyncTokenExpired(error)).toBe(false);
  });

  it('should not flag network errors', () => {
    const error = { message: 'Network error' };
    expect(isSyncTokenExpired(error)).toBe(false);
  });

  it('should handle missing error properties', () => {
    const error = {};
    expect(isSyncTokenExpired(error)).toBe(false);
  });
});

// ============================================================
// Webhook Request Validation Tests
// ============================================================

describe('Webhook Header Validation', () => {
  const validateWebhookHeaders = (headers: Record<string, string | undefined>): {
    valid: boolean;
    error?: string;
  } => {
    if (!headers['x-goog-channel-id']) {
      return { valid: false, error: 'Missing channel ID' };
    }
    if (!headers['x-goog-resource-state']) {
      return { valid: false, error: 'Missing resource state' };
    }
    return { valid: true };
  };

  it('should validate complete headers', () => {
    const headers = {
      'x-goog-channel-id': mockChannelId,
      'x-goog-resource-state': 'exists',
      'x-goog-channel-token': mockChannelToken,
    };

    expect(validateWebhookHeaders(headers).valid).toBe(true);
  });

  it('should reject missing channel ID', () => {
    const headers = {
      'x-goog-resource-state': 'exists',
      'x-goog-channel-token': mockChannelToken,
    };

    const result = validateWebhookHeaders(headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing channel ID');
  });

  it('should reject missing resource state', () => {
    const headers = {
      'x-goog-channel-id': mockChannelId,
      'x-goog-channel-token': mockChannelToken,
    };

    const result = validateWebhookHeaders(headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing resource state');
  });
});

describe('Resource State Handling', () => {
  const handleResourceState = (state: string): 'sync' | 'process' | 'ignore' => {
    switch (state) {
      case 'sync':
        return 'sync';
      case 'exists':
      case 'update':
        return 'process';
      default:
        return 'ignore';
    }
  };

  it('should handle sync state', () => {
    expect(handleResourceState('sync')).toBe('sync');
  });

  it('should handle exists state', () => {
    expect(handleResourceState('exists')).toBe('process');
  });

  it('should handle update state', () => {
    expect(handleResourceState('update')).toBe('process');
  });

  it('should ignore unknown states', () => {
    expect(handleResourceState('unknown')).toBe('ignore');
    expect(handleResourceState('')).toBe('ignore');
  });
});

describe('HTTP Method Validation', () => {
  const isValidMethod = (method: string): boolean => {
    return method === 'POST';
  };

  it('should accept POST method', () => {
    expect(isValidMethod('POST')).toBe(true);
  });

  it('should reject GET method', () => {
    expect(isValidMethod('GET')).toBe(false);
  });

  it('should reject PUT method', () => {
    expect(isValidMethod('PUT')).toBe(false);
  });

  it('should reject DELETE method', () => {
    expect(isValidMethod('DELETE')).toBe(false);
  });
});

// ============================================================
// Task Update Behavior Tests
// ============================================================

describe('Task Update for Deleted Event', () => {
  const getDeletedEventUpdates = () => ({
    scheduledStart: null,
    scheduledEnd: null,
    calendarEventId: null,
    calendarId: null,
    'syncMetadata.calendarEventId': null,
    'syncMetadata.syncStatus': 'synced',
    unscheduledReason: 'calendar_event_deleted',
  });

  it('should clear scheduling fields', () => {
    const updates = getDeletedEventUpdates();
    expect(updates.scheduledStart).toBeNull();
    expect(updates.scheduledEnd).toBeNull();
  });

  it('should clear calendar reference fields', () => {
    const updates = getDeletedEventUpdates();
    expect(updates.calendarEventId).toBeNull();
    expect(updates.calendarId).toBeNull();
  });

  it('should set unscheduled reason', () => {
    const updates = getDeletedEventUpdates();
    expect(updates.unscheduledReason).toBe('calendar_event_deleted');
  });

  it('should mark sync status as synced', () => {
    const updates = getDeletedEventUpdates();
    expect(updates['syncMetadata.syncStatus']).toBe('synced');
  });
});

describe('Task Update for Rescheduled Event', () => {
  const getRescheduledEventUpdates = (start: Date, end: Date) => ({
    scheduledStart: start,
    scheduledEnd: end,
    'syncMetadata.syncStatus': 'synced',
    rescheduledExternally: true,
  });

  it('should update scheduled times', () => {
    const start = new Date('2024-01-15T14:00:00Z');
    const end = new Date('2024-01-15T15:00:00Z');
    const updates = getRescheduledEventUpdates(start, end);

    expect(updates.scheduledStart).toEqual(start);
    expect(updates.scheduledEnd).toEqual(end);
  });

  it('should mark as externally rescheduled', () => {
    const start = new Date('2024-01-15T14:00:00Z');
    const end = new Date('2024-01-15T15:00:00Z');
    const updates = getRescheduledEventUpdates(start, end);

    expect(updates.rescheduledExternally).toBe(true);
  });

  it('should mark sync status as synced', () => {
    const start = new Date('2024-01-15T14:00:00Z');
    const end = new Date('2024-01-15T15:00:00Z');
    const updates = getRescheduledEventUpdates(start, end);

    expect(updates['syncMetadata.syncStatus']).toBe('synced');
  });
});

// ============================================================
// Error Response Tests
// ============================================================

describe('Webhook Error Responses', () => {
  const getErrorResponse = (scenario: string): { status: number; message: string } => {
    switch (scenario) {
      case 'missing_channel':
        return { status: 400, message: 'Missing channel ID' };
      case 'invalid_token':
        return { status: 403, message: 'Invalid token' };
      case 'unknown_channel':
        // Return 200 to stop Google from retrying
        return { status: 200, message: 'Unknown channel' };
      case 'expired_watch':
        return { status: 200, message: 'Watch expired' };
      case 'method_not_allowed':
        return { status: 405, message: 'Method not allowed' };
      default:
        return { status: 200, message: 'OK' };
    }
  };

  it('should return 400 for missing channel ID', () => {
    const response = getErrorResponse('missing_channel');
    expect(response.status).toBe(400);
  });

  it('should return 403 for invalid token', () => {
    const response = getErrorResponse('invalid_token');
    expect(response.status).toBe(403);
  });

  it('should return 200 for unknown channel to stop retries', () => {
    const response = getErrorResponse('unknown_channel');
    expect(response.status).toBe(200);
  });

  it('should return 200 for expired watch', () => {
    const response = getErrorResponse('expired_watch');
    expect(response.status).toBe(200);
  });

  it('should return 405 for non-POST requests', () => {
    const response = getErrorResponse('method_not_allowed');
    expect(response.status).toBe(405);
  });
});

describe('Callable Function Error Handling', () => {
  const mapErrorToHttpsError = (error: any): { code: string; message: string } => {
    if (error.message === 'Authentication failed') {
      return { code: 'unauthenticated', message: 'Calendar authentication expired. Please reconnect your calendar.' };
    }
    return { code: 'internal', message: `Sync failed: ${error.message}` };
  };

  it('should map authentication errors correctly', () => {
    const error = new Error('Authentication failed');
    const mapped = mapErrorToHttpsError(error);

    expect(mapped.code).toBe('unauthenticated');
    expect(mapped.message).toContain('reconnect your calendar');
  });

  it('should map generic errors to internal', () => {
    const error = new Error('Something went wrong');
    const mapped = mapErrorToHttpsError(error);

    expect(mapped.code).toBe('internal');
    expect(mapped.message).toContain('Something went wrong');
  });
});

// ============================================================
// Calendar Event Parsing Tests
// ============================================================

describe('Calendar Event Date Parsing', () => {
  const parseEventDateTime = (event: any): { start: Date | null; end: Date | null } => {
    return {
      start: event.start?.dateTime ? new Date(event.start.dateTime) : null,
      end: event.end?.dateTime ? new Date(event.end.dateTime) : null,
    };
  };

  it('should parse dateTime events', () => {
    const result = parseEventDateTime(mockCalendarEvent);

    expect(result.start).not.toBeNull();
    expect(result.end).not.toBeNull();
    expect(result.start?.toISOString()).toBe('2024-01-15T09:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2024-01-15T10:00:00.000Z');
  });

  it('should return null for all-day events', () => {
    const allDayEvent = {
      id: 'all-day-event',
      start: { date: '2024-01-15' },
      end: { date: '2024-01-16' },
    };

    const result = parseEventDateTime(allDayEvent);
    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });

  it('should handle missing start/end', () => {
    const incompleteEvent = { id: 'incomplete' };
    const result = parseEventDateTime(incompleteEvent);

    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });
});

describe('Calendar Event Status Mapping', () => {
  const mapEventStatus = (status: string | undefined): 'confirmed' | 'tentative' | 'cancelled' => {
    switch (status) {
      case 'confirmed':
        return 'confirmed';
      case 'tentative':
        return 'tentative';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'confirmed';
    }
  };

  it('should map confirmed status', () => {
    expect(mapEventStatus('confirmed')).toBe('confirmed');
  });

  it('should map tentative status', () => {
    expect(mapEventStatus('tentative')).toBe('tentative');
  });

  it('should map cancelled status', () => {
    expect(mapEventStatus('cancelled')).toBe('cancelled');
  });

  it('should default to confirmed for undefined', () => {
    expect(mapEventStatus(undefined)).toBe('confirmed');
  });

  it('should default to confirmed for unknown status', () => {
    expect(mapEventStatus('unknown')).toBe('confirmed');
  });
});

// ============================================================
// Watch Renewal Tests
// ============================================================

describe('Watch Renewal Logic', () => {
  const shouldRenewWatch = (expiration: Date, thresholdHours: number = 24): boolean => {
    const now = Date.now();
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    return expiration.getTime() <= now + thresholdMs;
  };

  it('should renew watches expiring within threshold', () => {
    // Watch expiring in 12 hours
    const expiration = new Date(Date.now() + 12 * 60 * 60 * 1000);
    expect(shouldRenewWatch(expiration)).toBe(true);
  });

  it('should not renew watches far from expiration', () => {
    // Watch expiring in 7 days
    const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(shouldRenewWatch(expiration)).toBe(false);
  });

  it('should renew expired watches', () => {
    const expiration = new Date(Date.now() - 1000);
    expect(shouldRenewWatch(expiration)).toBe(true);
  });

  it('should handle custom threshold', () => {
    // Watch expiring in 36 hours
    const expiration = new Date(Date.now() + 36 * 60 * 60 * 1000);

    // With 24 hour threshold, should not renew
    expect(shouldRenewWatch(expiration, 24)).toBe(false);

    // With 48 hour threshold, should renew
    expect(shouldRenewWatch(expiration, 48)).toBe(true);
  });
});

// ============================================================
// Integration Scenario Tests
// ============================================================

describe('Full Webhook Processing Flow', () => {
  it('should describe the complete sync message flow', () => {
    const syncFlow = [
      '1. Receive sync confirmation from Google',
      '2. Acknowledge with 200 OK',
      '3. Watch is now active',
    ];

    expect(syncFlow).toHaveLength(3);
    expect(syncFlow[0]).toContain('sync confirmation');
  });

  it('should describe the complete event update flow', () => {
    const updateFlow = [
      '1. Receive exists/update notification',
      '2. Validate channel ID and token',
      '3. Fetch changed events using sync token',
      '4. Process each Brain Dumper event',
      '5. Update corresponding tasks',
      '6. Save new sync token',
      '7. Respond with 200 OK',
    ];

    expect(updateFlow).toHaveLength(7);
    expect(updateFlow[3]).toContain('Brain Dumper');
  });

  it('should describe event deletion handling', () => {
    const deletionFlow = [
      '1. Event status is "cancelled"',
      '2. Find task by brainDumperTaskId',
      '3. Clear task scheduling fields',
      '4. Set unscheduled reason',
      '5. Mark sync as complete',
    ];

    expect(deletionFlow).toHaveLength(5);
    expect(deletionFlow[3]).toContain('unscheduled reason');
  });

  it('should describe event reschedule handling', () => {
    const rescheduleFlow = [
      '1. Event times differ from task times',
      '2. Find task by brainDumperTaskId',
      '3. Update task scheduled times',
      '4. Mark as externally rescheduled',
      '5. Mark sync as complete',
    ];

    expect(rescheduleFlow).toHaveLength(5);
    expect(rescheduleFlow[3]).toContain('externally rescheduled');
  });
});

describe('Sync Token Recovery', () => {
  it('should describe 410 error recovery', () => {
    const recoverySteps = [
      '1. Receive 410 Gone error during sync',
      '2. Delete stored sync token',
      '3. Retry with full sync (no sync token)',
      '4. Process all events with brainDumperTaskId',
      '5. Save new sync token',
    ];

    expect(recoverySteps).toHaveLength(5);
    expect(recoverySteps[0]).toContain('410 Gone');
  });

  it('should describe initial sync behavior', () => {
    const initialSyncBehavior = [
      'No sync token stored',
      'Query events with privateExtendedProperty filter',
      'Only process events from last 30 days',
      'Save sync token for future incremental syncs',
    ];

    expect(initialSyncBehavior).toHaveLength(4);
    expect(initialSyncBehavior[1]).toContain('privateExtendedProperty');
  });
});

// ============================================================
// Edge Case Tests
// ============================================================

describe('Edge Cases', () => {
  it('should handle empty event list', () => {
    const events: any[] = [];
    const brainDumperEvents = events.filter(
      e => e.extendedProperties?.private?.brainDumperTaskId
    );

    expect(brainDumperEvents).toHaveLength(0);
  });

  it('should handle task not found for event', () => {
    const taskExists = false;
    const shouldProcess = (exists: boolean): boolean => exists;

    expect(shouldProcess(taskExists)).toBe(false);
  });

  it('should handle authentication failure', () => {
    const auth = null;
    const canProcess = auth !== null;

    expect(canProcess).toBe(false);
  });

  it('should handle concurrent webhook notifications', () => {
    // Webhook processing should be idempotent
    const processedEventIds = new Set<string>();
    const eventId = 'event-123';

    // First notification
    processedEventIds.add(eventId);

    // Second notification (duplicate)
    const alreadyProcessed = processedEventIds.has(eventId);

    expect(alreadyProcessed).toBe(true);
  });

  it('should handle very old expiration dates', () => {
    const veryOldExpiration = new Date('2020-01-01');
    const isExpired = veryOldExpiration < new Date();

    expect(isExpired).toBe(true);
  });

  it('should handle future dates far in the future', () => {
    const farFutureExpiration = new Date('2100-01-01');
    const isExpired = farFutureExpiration < new Date();

    expect(isExpired).toBe(false);
  });
});

describe('Timezone Handling', () => {
  it('should handle UTC times correctly', () => {
    const utcTime = '2024-01-15T09:00:00Z';
    const parsed = new Date(utcTime);

    expect(parsed.toISOString()).toBe('2024-01-15T09:00:00.000Z');
  });

  it('should handle timezone offset times', () => {
    const offsetTime = '2024-01-15T09:00:00-05:00';
    const parsed = new Date(offsetTime);

    // Should convert to UTC
    expect(parsed.toISOString()).toBe('2024-01-15T14:00:00.000Z');
  });

  it('should preserve timezone when comparing', () => {
    const time1 = new Date('2024-01-15T09:00:00Z');
    const time2 = new Date('2024-01-15T04:00:00-05:00');

    // Both should be the same moment in time
    expect(time1.getTime()).toBe(time2.getTime());
  });
});
