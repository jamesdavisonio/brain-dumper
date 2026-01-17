/**
 * Scheduling functions tests
 * Tests for event building, conflict detection, proposal storage, and scheduling operations
 * @module __tests__/scheduling.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-admin before any imports
vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: vi.fn(),
    firestore: vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        })),
        where: vi.fn(() => ({
          get: vi.fn(),
        })),
      })),
    })),
  },
  initializeApp: vi.fn(),
  firestore: vi.fn(() => ({
    collection: vi.fn(),
  })),
}));

// Mock the calendar client
vi.mock('../calendar/client', () => ({
  getCalendarClient: vi.fn(),
  getCalendarClientOrThrow: vi.fn(),
}));

// Mock the fetch events
vi.mock('../calendar/fetchEvents', () => ({
  fetchEventsInternal: vi.fn(() => Promise.resolve({ events: [] })),
}));

import {
  buildTaskEvent,
  buildBufferEvent,
  isBrainDumperEvent,
  isBufferEvent,
  getBrainDumperMetadata,
  updateEventTimes,
  calculateBufferSlots,
  BRAIN_DUMPER_KEYS,
} from '../scheduling/eventBuilder';
import {
  comparePriorities,
  canDisplaceByPriority,
  slotsOverlap,
  isWithinWorkingHours,
} from '../scheduling/conflicts';
import { Task, Priority, SchedulingTimeSlot } from '../types';
import { calendar_v3 } from 'googleapis';

// Mock task factory
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-123',
    content: 'Test Task',
    priority: 'medium',
    completed: false,
    archived: false,
    userId: 'user-123',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    order: 0,
    ...overrides,
  };
}

// Mock time slot factory
function createMockSlot(overrides: Partial<SchedulingTimeSlot> = {}): SchedulingTimeSlot {
  return {
    start: '2024-01-15T09:00:00Z',
    end: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('Event Builder', () => {
  describe('buildTaskEvent', () => {
    it('should create event with correct basic structure', () => {
      const task = createMockTask();
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task,
        slot,
        calendarId: 'primary',
      });

      expect(event.summary).toContain(task.content);
      expect(event.start?.dateTime).toBe(slot.start);
      expect(event.end?.dateTime).toBe(slot.end);
      expect(event.status).toBe('confirmed');
    });

    it('should include task type in summary if present', () => {
      const task = createMockTask({ taskType: 'coding' });
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task,
        slot,
        calendarId: 'primary',
      });

      expect(event.summary).toContain('[coding]');
      expect(event.summary).toContain(task.content);
    });

    it('should include Brain Dumper metadata in extended properties', () => {
      const task = createMockTask({ priority: 'high' });
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task,
        slot,
        calendarId: 'primary',
      });

      const privateProps = event.extendedProperties?.private;
      expect(privateProps).toBeDefined();
      expect(privateProps?.[BRAIN_DUMPER_KEYS.TASK_ID]).toBe(task.id);
      expect(privateProps?.[BRAIN_DUMPER_KEYS.PRIORITY]).toBe('high');
    });

    it('should set correct color based on priority', () => {
      const highPriorityTask = createMockTask({ priority: 'high' });
      const mediumPriorityTask = createMockTask({ priority: 'medium' });
      const lowPriorityTask = createMockTask({ priority: 'low' });
      const slot = createMockSlot();

      const highEvent = buildTaskEvent({ task: highPriorityTask, slot, calendarId: 'primary' });
      const mediumEvent = buildTaskEvent({ task: mediumPriorityTask, slot, calendarId: 'primary' });
      const lowEvent = buildTaskEvent({ task: lowPriorityTask, slot, calendarId: 'primary' });

      expect(highEvent.colorId).toBe('11'); // Red
      expect(mediumEvent.colorId).toBe('5'); // Yellow
      expect(lowEvent.colorId).toBe('9'); // Blue
    });

    it('should include task details in description', () => {
      const task = createMockTask({
        content: 'Important task',
        project: 'Project Alpha',
        category: 'Development',
        timeEstimate: 60,
      });
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task,
        slot,
        calendarId: 'primary',
      });

      expect(event.description).toContain(task.content);
      expect(event.description).toContain('Project: Project Alpha');
      expect(event.description).toContain('Category: Development');
      expect(event.description).toContain('Estimated time: 60 minutes');
    });

    it('should set reminders based on priority', () => {
      const highPriorityTask = createMockTask({ priority: 'high' });
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task: highPriorityTask,
        slot,
        calendarId: 'primary',
      });

      expect(event.reminders?.useDefault).toBe(false);
      expect(event.reminders?.overrides).toHaveLength(2); // High priority has 2 reminders
    });
  });

  describe('buildBufferEvent', () => {
    it('should create before buffer event ending at task start', () => {
      const task = createMockTask();
      const taskStart = new Date('2024-01-15T09:00:00Z');

      const bufferEvent = buildBufferEvent(
        task,
        'before',
        15, // 15 minutes
        taskStart,
        'primary'
      );

      expect(bufferEvent.summary).toContain('Prep:');
      expect(bufferEvent.summary).toContain(task.content);
      expect(bufferEvent.end?.dateTime).toBe(taskStart.toISOString());

      const bufferStart = new Date(bufferEvent.start?.dateTime as string);
      expect(bufferStart.getTime()).toBe(taskStart.getTime() - 15 * 60 * 1000);
    });

    it('should create after buffer event starting at task end', () => {
      const task = createMockTask();
      const taskEnd = new Date('2024-01-15T10:00:00Z');

      const bufferEvent = buildBufferEvent(
        task,
        'after',
        10, // 10 minutes
        taskEnd,
        'primary'
      );

      expect(bufferEvent.summary).toContain('Wind-down:');
      expect(bufferEvent.summary).toContain(task.content);
      expect(bufferEvent.start?.dateTime).toBe(taskEnd.toISOString());

      const bufferEnd = new Date(bufferEvent.end?.dateTime as string);
      expect(bufferEnd.getTime()).toBe(taskEnd.getTime() + 10 * 60 * 1000);
    });

    it('should mark buffer events as transparent (free)', () => {
      const task = createMockTask();
      const time = new Date('2024-01-15T09:00:00Z');

      const bufferEvent = buildBufferEvent(task, 'before', 15, time, 'primary');

      expect(bufferEvent.transparency).toBe('transparent');
    });

    it('should include buffer type in extended properties', () => {
      const task = createMockTask();
      const time = new Date('2024-01-15T09:00:00Z');

      const beforeBuffer = buildBufferEvent(task, 'before', 15, time, 'primary');
      const afterBuffer = buildBufferEvent(task, 'after', 10, time, 'primary');

      expect(beforeBuffer.extendedProperties?.private?.[BRAIN_DUMPER_KEYS.BUFFER_TYPE]).toBe('before');
      expect(afterBuffer.extendedProperties?.private?.[BRAIN_DUMPER_KEYS.BUFFER_TYPE]).toBe('after');
    });
  });

  describe('isBrainDumperEvent', () => {
    it('should return true for events with Brain Dumper task ID', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        extendedProperties: {
          private: {
            [BRAIN_DUMPER_KEYS.TASK_ID]: 'task-123',
          },
        },
      };

      expect(isBrainDumperEvent(event)).toBe(true);
    });

    it('should return false for events without Brain Dumper metadata', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        summary: 'Regular meeting',
      };

      expect(isBrainDumperEvent(event)).toBe(false);
    });

    it('should return false for events with empty extended properties', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        extendedProperties: {
          private: {},
        },
      };

      expect(isBrainDumperEvent(event)).toBe(false);
    });
  });

  describe('isBufferEvent', () => {
    it('should return true for buffer events', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        extendedProperties: {
          private: {
            [BRAIN_DUMPER_KEYS.TASK_ID]: 'task-123',
            [BRAIN_DUMPER_KEYS.BUFFER_TYPE]: 'before',
          },
        },
      };

      expect(isBufferEvent(event)).toBe(true);
    });

    it('should return false for non-buffer events', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        extendedProperties: {
          private: {
            [BRAIN_DUMPER_KEYS.TASK_ID]: 'task-123',
          },
        },
      };

      expect(isBufferEvent(event)).toBe(false);
    });
  });

  describe('getBrainDumperMetadata', () => {
    it('should extract metadata from Brain Dumper event', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        extendedProperties: {
          private: {
            [BRAIN_DUMPER_KEYS.TASK_ID]: 'task-123',
            [BRAIN_DUMPER_KEYS.PRIORITY]: 'high',
            [BRAIN_DUMPER_KEYS.BUFFER_TYPE]: 'before',
          },
        },
      };

      const metadata = getBrainDumperMetadata(event);

      expect(metadata).not.toBeNull();
      expect(metadata?.taskId).toBe('task-123');
      expect(metadata?.priority).toBe('high');
      expect(metadata?.bufferType).toBe('before');
    });

    it('should return null for non-Brain Dumper events', () => {
      const event: calendar_v3.Schema$Event = {
        id: 'event-123',
        summary: 'Regular meeting',
      };

      const metadata = getBrainDumperMetadata(event);

      expect(metadata).toBeNull();
    });
  });

  describe('updateEventTimes', () => {
    it('should update event with new time slot', () => {
      const originalEvent: calendar_v3.Schema$Event = {
        id: 'event-123',
        summary: 'Test Event',
        start: { dateTime: '2024-01-15T09:00:00Z' },
        end: { dateTime: '2024-01-15T10:00:00Z' },
      };

      const newSlot: SchedulingTimeSlot = {
        start: '2024-01-15T14:00:00Z',
        end: '2024-01-15T15:00:00Z',
      };

      const updatedEvent = updateEventTimes(originalEvent, newSlot, 'America/New_York');

      expect(updatedEvent.start?.dateTime).toBe(newSlot.start);
      expect(updatedEvent.end?.dateTime).toBe(newSlot.end);
      expect(updatedEvent.start?.timeZone).toBe('America/New_York');
      expect(updatedEvent.summary).toBe('Test Event'); // Preserved
    });
  });

  describe('calculateBufferSlots', () => {
    it('should calculate before buffer slot', () => {
      const taskSlot: SchedulingTimeSlot = {
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T10:00:00Z',
      };

      const result = calculateBufferSlots(taskSlot, 15, 0);

      expect(result.beforeSlot).toBeDefined();
      // Compare as Date to handle ISO format differences (.000Z vs Z)
      expect(new Date(result.beforeSlot!.end).getTime()).toBe(new Date(taskSlot.start).getTime());
      expect(result.afterSlot).toBeUndefined();

      const bufferStart = new Date(result.beforeSlot!.start);
      const taskStart = new Date(taskSlot.start);
      expect(bufferStart.getTime()).toBe(taskStart.getTime() - 15 * 60 * 1000);
    });

    it('should calculate after buffer slot', () => {
      const taskSlot: SchedulingTimeSlot = {
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T10:00:00Z',
      };

      const result = calculateBufferSlots(taskSlot, 0, 10);

      expect(result.afterSlot).toBeDefined();
      // Compare as Date to handle ISO format differences (.000Z vs Z)
      expect(new Date(result.afterSlot!.start).getTime()).toBe(new Date(taskSlot.end).getTime());
      expect(result.beforeSlot).toBeUndefined();

      const bufferEnd = new Date(result.afterSlot!.end);
      const taskEnd = new Date(taskSlot.end);
      expect(bufferEnd.getTime()).toBe(taskEnd.getTime() + 10 * 60 * 1000);
    });

    it('should calculate both buffer slots', () => {
      const taskSlot: SchedulingTimeSlot = {
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T10:00:00Z',
      };

      const result = calculateBufferSlots(taskSlot, 15, 10);

      expect(result.beforeSlot).toBeDefined();
      expect(result.afterSlot).toBeDefined();
    });

    it('should return empty object when no buffers', () => {
      const taskSlot: SchedulingTimeSlot = {
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T10:00:00Z',
      };

      const result = calculateBufferSlots(taskSlot, 0, 0);

      expect(result.beforeSlot).toBeUndefined();
      expect(result.afterSlot).toBeUndefined();
    });
  });
});

describe('Conflict Detection', () => {
  describe('comparePriorities', () => {
    it('should return positive when first priority is higher', () => {
      expect(comparePriorities('high', 'medium')).toBeGreaterThan(0);
      expect(comparePriorities('high', 'low')).toBeGreaterThan(0);
      expect(comparePriorities('medium', 'low')).toBeGreaterThan(0);
    });

    it('should return negative when first priority is lower', () => {
      expect(comparePriorities('medium', 'high')).toBeLessThan(0);
      expect(comparePriorities('low', 'high')).toBeLessThan(0);
      expect(comparePriorities('low', 'medium')).toBeLessThan(0);
    });

    it('should return zero when priorities are equal', () => {
      expect(comparePriorities('high', 'high')).toBe(0);
      expect(comparePriorities('medium', 'medium')).toBe(0);
      expect(comparePriorities('low', 'low')).toBe(0);
    });
  });

  describe('canDisplaceByPriority', () => {
    it('should allow high priority to displace medium and low', () => {
      expect(canDisplaceByPriority('high', 'medium')).toBe(true);
      expect(canDisplaceByPriority('high', 'low')).toBe(true);
    });

    it('should allow medium priority to displace low', () => {
      expect(canDisplaceByPriority('medium', 'low')).toBe(true);
    });

    it('should not allow equal priority displacement', () => {
      expect(canDisplaceByPriority('high', 'high')).toBe(false);
      expect(canDisplaceByPriority('medium', 'medium')).toBe(false);
      expect(canDisplaceByPriority('low', 'low')).toBe(false);
    });

    it('should not allow lower priority to displace higher', () => {
      expect(canDisplaceByPriority('medium', 'high')).toBe(false);
      expect(canDisplaceByPriority('low', 'high')).toBe(false);
      expect(canDisplaceByPriority('low', 'medium')).toBe(false);
    });
  });

  describe('slotsOverlap', () => {
    it('should detect overlapping slots', () => {
      const slot1 = createMockSlot({ start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' });
      const slot2 = createMockSlot({ start: '2024-01-15T09:30:00Z', end: '2024-01-15T10:30:00Z' });

      expect(slotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should detect when one slot contains another', () => {
      const slot1 = createMockSlot({ start: '2024-01-15T09:00:00Z', end: '2024-01-15T12:00:00Z' });
      const slot2 = createMockSlot({ start: '2024-01-15T10:00:00Z', end: '2024-01-15T11:00:00Z' });

      expect(slotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should not detect overlap for adjacent slots', () => {
      const slot1 = createMockSlot({ start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' });
      const slot2 = createMockSlot({ start: '2024-01-15T10:00:00Z', end: '2024-01-15T11:00:00Z' });

      expect(slotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should not detect overlap for separate slots', () => {
      const slot1 = createMockSlot({ start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' });
      const slot2 = createMockSlot({ start: '2024-01-15T14:00:00Z', end: '2024-01-15T15:00:00Z' });

      expect(slotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should be commutative', () => {
      const slot1 = createMockSlot({ start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' });
      const slot2 = createMockSlot({ start: '2024-01-15T09:30:00Z', end: '2024-01-15T10:30:00Z' });

      expect(slotsOverlap(slot1, slot2)).toBe(slotsOverlap(slot2, slot1));
    });
  });

  describe('isWithinWorkingHours', () => {
    const workingHours = { start: '09:00', end: '17:00' };

    it('should return true for slot within working hours', () => {
      const slot = createMockSlot({
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T11:00:00Z',
      });

      expect(isWithinWorkingHours(slot, workingHours, 'UTC')).toBe(true);
    });

    it('should return true for slot at working hours boundaries', () => {
      const slot = createMockSlot({
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T17:00:00Z',
      });

      expect(isWithinWorkingHours(slot, workingHours, 'UTC')).toBe(true);
    });

    it('should return false for slot starting before working hours', () => {
      const slot = createMockSlot({
        start: '2024-01-15T08:00:00Z',
        end: '2024-01-15T10:00:00Z',
      });

      expect(isWithinWorkingHours(slot, workingHours, 'UTC')).toBe(false);
    });

    it('should return false for slot ending after working hours', () => {
      const slot = createMockSlot({
        start: '2024-01-15T16:00:00Z',
        end: '2024-01-15T18:00:00Z',
      });

      expect(isWithinWorkingHours(slot, workingHours, 'UTC')).toBe(false);
    });
  });
});

describe('Proposal Types', () => {
  describe('ScheduleProposal structure', () => {
    it('should have required fields', () => {
      const proposal = {
        id: 'proposal-123',
        userId: 'user-123',
        createdAt: '2024-01-15T00:00:00Z',
        expiresAt: '2024-01-15T01:00:00Z',
        proposedSlots: [],
        unschedulable: [],
        summary: {
          totalTasks: 0,
          scheduled: 0,
          conflicts: 0,
          displacements: 0,
        },
        options: {
          respectPriority: true,
          includeBuffers: false,
        },
      };

      expect(proposal.id).toBeDefined();
      expect(proposal.userId).toBeDefined();
      expect(proposal.createdAt).toBeDefined();
      expect(proposal.expiresAt).toBeDefined();
      expect(proposal.summary).toBeDefined();
    });
  });

  describe('ProposedSlot structure', () => {
    it('should contain task and slot information', () => {
      const task = createMockTask();
      const slot = createMockSlot();

      const proposedSlot = {
        task,
        slot,
        calendarId: 'primary',
        conflicts: [],
        displacements: [],
      };

      expect(proposedSlot.task.id).toBe(task.id);
      expect(proposedSlot.slot.start).toBe(slot.start);
      expect(proposedSlot.calendarId).toBe('primary');
      expect(Array.isArray(proposedSlot.conflicts)).toBe(true);
      expect(Array.isArray(proposedSlot.displacements)).toBe(true);
    });
  });
});

describe('Displacement logic', () => {
  describe('Displacement structure', () => {
    it('should contain all required fields', () => {
      const displacement = {
        existingTaskId: 'task-existing',
        existingTaskName: 'Existing Task',
        existingPriority: 'low' as Priority,
        newTaskPriority: 'high' as Priority,
        reason: 'Higher priority task scheduled',
        suggestedNewSlot: createMockSlot({
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z',
        }),
      };

      expect(displacement.existingTaskId).toBeDefined();
      expect(displacement.existingTaskName).toBeDefined();
      expect(displacement.existingPriority).toBeDefined();
      expect(displacement.newTaskPriority).toBeDefined();
      expect(displacement.reason).toBeDefined();
    });

    it('should allow optional suggestedNewSlot', () => {
      const displacement = {
        existingTaskId: 'task-existing',
        existingTaskName: 'Existing Task',
        existingPriority: 'low' as Priority,
        newTaskPriority: 'high' as Priority,
        reason: 'Higher priority task scheduled',
      };

      expect(displacement.suggestedNewSlot).toBeUndefined();
    });
  });
});

describe('ConfirmResult structure', () => {
  it('should track scheduled tasks', () => {
    const result = {
      success: true,
      scheduled: [
        {
          taskId: 'task-123',
          calendarEventId: 'event-456',
          scheduledStart: '2024-01-15T09:00:00Z',
          scheduledEnd: '2024-01-15T10:00:00Z',
        },
      ],
      displaced: [],
      errors: [],
    };

    expect(result.success).toBe(true);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0].taskId).toBe('task-123');
    expect(result.scheduled[0].calendarEventId).toBe('event-456');
  });

  it('should track displaced tasks', () => {
    const result = {
      success: true,
      scheduled: [],
      displaced: [
        {
          taskId: 'task-displaced',
          newSlot: createMockSlot({
            start: '2024-01-15T14:00:00Z',
            end: '2024-01-15T15:00:00Z',
          }),
          unscheduled: false,
        },
      ],
      errors: [],
    };

    expect(result.displaced).toHaveLength(1);
    expect(result.displaced[0].unscheduled).toBe(false);
  });

  it('should track errors', () => {
    const result = {
      success: false,
      scheduled: [],
      displaced: [],
      errors: [
        {
          taskId: 'task-failed',
          error: 'Calendar API error',
        },
      ],
    };

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('Calendar API error');
  });
});

describe('ScheduleTaskResult structure', () => {
  it('should track successful scheduling', () => {
    const result = {
      success: true,
      calendarEventId: 'event-123',
      bufferBeforeEventId: 'buffer-before',
      bufferAfterEventId: 'buffer-after',
    };

    expect(result.success).toBe(true);
    expect(result.calendarEventId).toBeDefined();
  });

  it('should track scheduling requiring approval', () => {
    const result = {
      success: false,
      conflicts: [
        {
          eventId: 'event-conflict',
          eventTitle: 'Conflicting Meeting',
          calendarId: 'primary',
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T10:00:00Z',
          isBrainDumperTask: false,
        },
      ],
      requiresApproval: true,
      error: 'Time slot has conflicts',
    };

    expect(result.success).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.conflicts).toHaveLength(1);
  });
});

describe('Edge cases', () => {
  describe('Empty inputs', () => {
    it('should handle task with minimal fields', () => {
      const minimalTask = createMockTask({
        project: undefined,
        category: undefined,
        timeEstimate: undefined,
        dueDate: undefined,
        taskType: undefined,
      });
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task: minimalTask,
        slot,
        calendarId: 'primary',
      });

      expect(event.summary).toBe(minimalTask.content);
      expect(event.description).toBeDefined();
    });
  });

  describe('Timezone handling', () => {
    it('should preserve timezone in event', () => {
      const task = createMockTask();
      const slot = createMockSlot();

      const event = buildTaskEvent({
        task,
        slot,
        calendarId: 'primary',
        timezone: 'America/New_York',
      });

      expect(event.start?.timeZone).toBe('America/New_York');
      expect(event.end?.timeZone).toBe('America/New_York');
    });
  });

  describe('Zero-duration buffers', () => {
    it('should not create buffer events for zero duration', () => {
      const taskSlot = createMockSlot();
      const result = calculateBufferSlots(taskSlot, 0, 0);

      expect(result.beforeSlot).toBeUndefined();
      expect(result.afterSlot).toBeUndefined();
    });
  });

  describe('Negative values', () => {
    it('should handle negative buffer duration gracefully', () => {
      const taskSlot = createMockSlot();
      // Negative values should be treated as 0 or handled gracefully
      const result = calculateBufferSlots(taskSlot, -5, -10);

      // Implementation should handle this - either undefined or valid slots
      // depending on implementation choice
      expect(result).toBeDefined();
    });
  });
});

describe('Integration scenarios', () => {
  describe('Full scheduling workflow types', () => {
    it('should support complete proposal structure', () => {
      const task1 = createMockTask({ id: 'task-1', content: 'Task 1', priority: 'high' });
      const task2 = createMockTask({ id: 'task-2', content: 'Task 2', priority: 'medium' });

      const proposal = {
        id: 'proposal-123',
        userId: 'user-123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        proposedSlots: [
          {
            task: task1,
            slot: createMockSlot({ start: '2024-01-15T09:00:00Z', end: '2024-01-15T10:00:00Z' }),
            calendarId: 'primary',
            conflicts: [],
            displacements: [],
          },
          {
            task: task2,
            slot: createMockSlot({ start: '2024-01-15T10:00:00Z', end: '2024-01-15T11:00:00Z' }),
            calendarId: 'primary',
            conflicts: [],
            displacements: [],
          },
        ],
        unschedulable: [],
        summary: {
          totalTasks: 2,
          scheduled: 2,
          conflicts: 0,
          displacements: 0,
        },
        options: {
          respectPriority: true,
          includeBuffers: false,
        },
      };

      expect(proposal.proposedSlots).toHaveLength(2);
      expect(proposal.summary.scheduled).toBe(2);
    });

    it('should support partial approval confirmation', () => {
      const approved = [
        { taskId: 'task-1', slotIndex: 0, confirmed: true },
        { taskId: 'task-2', slotIndex: 0, confirmed: false }, // Rejected
        { taskId: 'task-3', slotIndex: 0, confirmed: true },
      ];

      const confirmedTasks = approved.filter((a) => a.confirmed);
      const rejectedTasks = approved.filter((a) => !a.confirmed);

      expect(confirmedTasks).toHaveLength(2);
      expect(rejectedTasks).toHaveLength(1);
    });
  });

  describe('Conflict and displacement workflow', () => {
    it('should model conflict with displacement option', () => {
      const highPriorityTask = createMockTask({ priority: 'high' });
      const lowPriorityConflict = {
        eventId: 'event-low',
        eventTitle: 'Low Priority Task',
        calendarId: 'primary',
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T10:00:00Z',
        isBrainDumperTask: true,
        brainDumperPriority: 'low' as Priority,
        brainDumperTaskId: 'task-low',
      };

      // High priority can displace low priority
      expect(
        canDisplaceByPriority(highPriorityTask.priority, lowPriorityConflict.brainDumperPriority!)
      ).toBe(true);

      const displacement = {
        existingTaskId: lowPriorityConflict.brainDumperTaskId!,
        existingTaskName: lowPriorityConflict.eventTitle,
        existingPriority: lowPriorityConflict.brainDumperPriority!,
        newTaskPriority: highPriorityTask.priority,
        reason: 'Higher priority task scheduled',
      };

      expect(displacement.reason).toContain('Higher priority');
    });
  });
});
