/**
 * Tests for the scheduling engine
 * @module __tests__/engine
 */

import { describe, it, expect } from 'vitest';
import {
  SchedulingEngine,
  SchedulingContext,
  createSchedulingEngine,
} from '../scheduling/engine';
import {
  scoreTaskTypePreference,
  scoreDueDateProximity,
  scorePriorityAlignment,
  scoreTimeOfDay,
  calculateTotalScore,
} from '../scheduling/scoring';
import {
  getEffectiveRules,
  slotSatisfiesRules,
  inferTaskType,
  DEFAULT_TASK_TYPE_RULES,
} from '../scheduling/rules';
import {
  isProtectedTime,
  canOverrideProtected,
  getProtectedTimes,
} from '../scheduling/protected';
import {
  scheduleBatch,
  validateBatchOptions,
  estimateBatchDuration,
  checkAvailabilitySufficiency,
} from '../scheduling/batch';
import type {
  Task,
  SchedulingRule,
  ProtectedSlot,
  UserSchedulingPreferences,
  ScheduledTask,
} from '../types';
import type { TimeSlot, SchedulingAvailabilityWindow } from '../scheduling/engine';

// ============================================================
// Test Helpers
// ============================================================

/**
 * Create a mock task
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    content: 'Test task',
    priority: 'medium',
    completed: false,
    archived: false,
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 0,
    ...overrides,
  };
}

/**
 * Create a mock time slot
 */
function createMockSlot(
  startHour: number,
  endHour: number,
  date: Date = new Date()
): TimeSlot {
  const start = new Date(date);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);

  return { start, end, available: true };
}

/**
 * Create a mock availability window
 */
function createMockAvailability(
  date: Date,
  slots: TimeSlot[]
): SchedulingAvailabilityWindow {
  const totalFreeMinutes = slots.reduce((sum, slot) => {
    if (!slot.available) return sum;
    return sum + (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
  }, 0);

  return {
    date,
    slots,
    totalFreeMinutes,
    totalBusyMinutes: 480 - totalFreeMinutes, // 8 hours - free time
  };
}

/**
 * Create mock scheduling preferences
 */
function createMockPreferences(
  overrides: Partial<UserSchedulingPreferences> = {}
): UserSchedulingPreferences {
  return {
    defaultCalendarId: 'primary',
    workingHours: { start: '09:00', end: '17:00' },
    workingDays: [1, 2, 3, 4, 5],
    timezone: 'UTC',
    autoScheduleEnabled: true,
    preferContiguousBlocks: true,
    ...overrides,
  };
}

/**
 * Create a mock scheduling rule
 */
function createMockRule(overrides: Partial<SchedulingRule> = {}): SchedulingRule {
  return {
    id: 'rule-1',
    userId: 'user-1',
    taskType: 'other',
    enabled: true,
    preferredTimeRange: { start: '09:00', end: '17:00' },
    preferredDays: [1, 2, 3, 4, 5],
    defaultDuration: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock protected slot
 */
function createMockProtectedSlot(
  overrides: Partial<ProtectedSlot> = {}
): ProtectedSlot {
  return {
    id: 'protected-1',
    userId: 'user-1',
    name: 'Protected Time',
    enabled: true,
    recurrence: {
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '12:00',
      endTime: '13:00',
    },
    allowOverrideForUrgent: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================
// Scoring Tests
// ============================================================

describe('Scoring Functions', () => {
  describe('scoreTaskTypePreference', () => {
    it('should score 100 for slot in preferred time range', () => {
      // Use a specific Monday to ensure it's a preferred day
      const monday = new Date('2025-01-06'); // A Monday
      const slot = createMockSlot(9, 11, monday); // 9am-11am
      const rules: SchedulingRule[] = [
        createMockRule({
          taskType: 'deep_work',
          preferredTimeRange: { start: '09:00', end: '12:00' },
          preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
        }),
      ];

      const result = scoreTaskTypePreference(slot, 'deep_work', rules);
      expect(result.value).toBe(100);
      expect(result.name).toBe('taskTypePreference');
    });

    it('should score lower for slot outside preferred range', () => {
      const slot = createMockSlot(15, 17); // 3pm-5pm
      const rules: SchedulingRule[] = [
        createMockRule({
          taskType: 'deep_work',
          preferredTimeRange: { start: '09:00', end: '12:00' },
        }),
      ];

      const result = scoreTaskTypePreference(slot, 'deep_work', rules);
      expect(result.value).toBeLessThan(100);
    });

    it('should return neutral score when no task type specified', () => {
      const slot = createMockSlot(9, 11);
      const result = scoreTaskTypePreference(slot, undefined, []);
      expect(result.value).toBe(50);
    });
  });

  describe('scoreDueDateProximity', () => {
    it('should score high for slot on due date', () => {
      const today = new Date();
      const slot = createMockSlot(9, 11, today);
      const dueDate = new Date(today);

      const result = scoreDueDateProximity(slot, dueDate, 'medium');
      expect(result.value).toBe(95);
    });

    it('should score low for slot after due date', () => {
      const today = new Date();
      const slot = createMockSlot(9, 11, today);
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() - 1); // Yesterday

      const result = scoreDueDateProximity(slot, dueDate, 'medium');
      expect(result.value).toBe(10);
    });

    it('should boost score for high priority tasks', () => {
      const today = new Date();
      const slot = createMockSlot(9, 11, today);
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 3);

      const highPriResult = scoreDueDateProximity(slot, dueDate, 'high');
      const mediumPriResult = scoreDueDateProximity(slot, dueDate, 'medium');

      expect(highPriResult.value).toBeGreaterThan(mediumPriResult.value);
    });
  });

  describe('scorePriorityAlignment', () => {
    it('should prefer morning slots for high priority tasks', () => {
      const morningSlot = createMockSlot(9, 11); // 9am-11am
      const afternoonSlot = createMockSlot(14, 16); // 2pm-4pm

      const morningResult = scorePriorityAlignment(morningSlot, 'high');
      const afternoonResult = scorePriorityAlignment(afternoonSlot, 'high');

      expect(morningResult.value).toBeGreaterThan(afternoonResult.value);
    });

    it('should prefer non-prime time for low priority tasks', () => {
      const morningSlot = createMockSlot(9, 11);
      const afternoonSlot = createMockSlot(15, 17);

      const morningResult = scorePriorityAlignment(morningSlot, 'low');
      const afternoonResult = scorePriorityAlignment(afternoonSlot, 'low');

      expect(afternoonResult.value).toBeGreaterThan(morningResult.value);
    });
  });

  describe('scoreTimeOfDay', () => {
    it('should score 100 when slot matches preference', () => {
      const morningSlot = createMockSlot(9, 11);
      const result = scoreTimeOfDay(morningSlot, 'morning');
      expect(result.value).toBe(100);
    });

    it('should score lower for adjacent time periods', () => {
      const morningSlot = createMockSlot(9, 11);
      const result = scoreTimeOfDay(morningSlot, 'afternoon');
      expect(result.value).toBe(60);
    });

    it('should return neutral score with no preference', () => {
      const slot = createMockSlot(9, 11);
      const result = scoreTimeOfDay(slot, null);
      expect(result.value).toBe(70);
    });
  });

  describe('calculateTotalScore', () => {
    it('should calculate weighted average correctly', () => {
      const factors = [
        { name: 'a', weight: 50, value: 100, description: 'A' },
        { name: 'b', weight: 50, value: 50, description: 'B' },
      ];

      const score = calculateTotalScore(factors);
      expect(score).toBe(75); // (100*50 + 50*50) / 100
    });

    it('should return 0 for empty factors', () => {
      expect(calculateTotalScore([])).toBe(0);
    });
  });
});

// ============================================================
// Rules Tests
// ============================================================

describe('Rules Engine', () => {
  describe('getEffectiveRules', () => {
    it('should use default rules when no user rules exist', () => {
      const task = createMockTask({ taskType: 'deep_work' });
      const rules = getEffectiveRules(task, []);

      expect(rules.taskType).toBe('deep_work');
      expect(rules.preferredTimeRange).toEqual(
        DEFAULT_TASK_TYPE_RULES.deep_work.preferredTimeRange
      );
    });

    it('should override defaults with user rules', () => {
      const task = createMockTask({ taskType: 'deep_work' });
      const userRule = createMockRule({
        taskType: 'deep_work',
        preferredTimeRange: { start: '07:00', end: '10:00' },
      });

      const rules = getEffectiveRules(task, [userRule]);
      expect(rules.preferredTimeRange).toEqual({ start: '07:00', end: '10:00' });
    });

    it('should use task-specific overrides', () => {
      const task = createMockTask({
        taskType: 'deep_work',
        timeEstimate: 90,
        bufferBefore: 15,
      });

      const rules = getEffectiveRules(task, []);
      expect(rules.defaultDuration).toBe(90);
      expect(rules.bufferBefore).toBe(15);
    });
  });

  describe('slotSatisfiesRules', () => {
    it('should pass for slot within all constraints', () => {
      const slot = createMockSlot(9, 11);
      const rule = createMockRule({
        preferredTimeRange: { start: '09:00', end: '17:00' },
        preferredDays: [0, 1, 2, 3, 4, 5, 6],
        defaultDuration: 60,
      });

      const result = slotSatisfiesRules(slot, rule);
      expect(result.satisfies).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail for slot outside time range', () => {
      const slot = createMockSlot(7, 9); // 7am-9am
      const rule = createMockRule({
        preferredTimeRange: { start: '09:00', end: '17:00' },
      });

      const result = slotSatisfiesRules(slot, rule);
      expect(result.satisfies).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('inferTaskType', () => {
    it('should infer call from content', () => {
      const task = createMockTask({ content: 'Call with John about project' });
      expect(inferTaskType(task)).toBe('call');
    });

    it('should infer meeting from content', () => {
      const task = createMockTask({ content: 'Team standup meeting' });
      expect(inferTaskType(task)).toBe('meeting');
    });

    it('should infer coding from content', () => {
      const task = createMockTask({ content: 'Implement new feature' });
      expect(inferTaskType(task)).toBe('coding');
    });

    it('should default to other for unknown content', () => {
      const task = createMockTask({ content: 'Random stuff' });
      expect(inferTaskType(task)).toBe('other');
    });
  });
});

// ============================================================
// Protected Slots Tests
// ============================================================

describe('Protected Slots', () => {
  describe('isProtectedTime', () => {
    it('should detect overlap with protected slot', () => {
      // Use a specific Monday to ensure it's a protected day
      const monday = new Date('2025-01-06');
      const slot = createMockSlot(12, 13, monday); // Lunch time
      const protectedSlots = [createMockProtectedSlot()]; // 12-1pm on Mon-Fri

      const result = isProtectedTime(slot, protectedSlots, 'UTC');
      expect(result.protected).toBe(true);
    });

    it('should not flag non-overlapping slots', () => {
      const monday = new Date('2025-01-06');
      const slot = createMockSlot(9, 11, monday);
      const protectedSlots = [createMockProtectedSlot()]; // 12-1pm

      const result = isProtectedTime(slot, protectedSlots, 'UTC');
      expect(result.protected).toBe(false);
    });

    it('should skip disabled protected slots', () => {
      const monday = new Date('2025-01-06');
      const slot = createMockSlot(12, 13, monday);
      const protectedSlots = [
        createMockProtectedSlot({ enabled: false }),
      ];

      const result = isProtectedTime(slot, protectedSlots, 'UTC');
      expect(result.protected).toBe(false);
    });
  });

  describe('canOverrideProtected', () => {
    it('should allow urgent tasks to override when allowed', () => {
      const task = createMockTask({
        priority: 'high',
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
      });
      const protectedSlot = createMockProtectedSlot({
        allowOverrideForUrgent: true,
      });

      expect(canOverrideProtected(task, protectedSlot)).toBe(true);
    });

    it('should not allow override when not allowed', () => {
      const task = createMockTask({ priority: 'high' });
      const protectedSlot = createMockProtectedSlot({
        allowOverrideForUrgent: false,
      });

      expect(canOverrideProtected(task, protectedSlot)).toBe(false);
    });

    it('should not allow medium/low priority to override', () => {
      const task = createMockTask({ priority: 'medium' });
      const protectedSlot = createMockProtectedSlot({
        allowOverrideForUrgent: true,
      });

      expect(canOverrideProtected(task, protectedSlot)).toBe(false);
    });
  });

  describe('getProtectedTimes', () => {
    it('should expand protected slots across date range', () => {
      const startDate = new Date('2025-01-06'); // Monday
      const endDate = new Date('2025-01-10'); // Friday
      const protectedSlots = [
        createMockProtectedSlot({
          recurrence: {
            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
            startTime: '12:00',
            endTime: '13:00',
          },
        }),
      ];

      const instances = getProtectedTimes(
        startDate,
        endDate,
        protectedSlots,
        'UTC'
      );

      expect(instances.length).toBe(5); // 5 weekdays
    });
  });
});

// ============================================================
// Batch Scheduling Tests
// ============================================================

describe('Batch Scheduling', () => {
  describe('validateBatchOptions', () => {
    it('should validate correct options', () => {
      const options = {
        tasks: [createMockTask()],
        availability: [createMockAvailability(new Date(), [createMockSlot(9, 17)])],
        rules: [],
        protectedSlots: [],
        preferences: createMockPreferences(),
        respectPriority: true,
        userId: 'user-1',
      };

      const result = validateBatchOptions(options);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing tasks', () => {
      const options = {
        tasks: [],
        availability: [createMockAvailability(new Date(), [createMockSlot(9, 17)])],
        rules: [],
        protectedSlots: [],
        preferences: createMockPreferences(),
        respectPriority: true,
        userId: 'user-1',
      };

      const result = validateBatchOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No tasks provided for scheduling');
    });
  });

  describe('estimateBatchDuration', () => {
    it('should calculate total duration including buffers', () => {
      const tasks = [
        createMockTask({ timeEstimate: 60, bufferBefore: 10, bufferAfter: 10 }),
        createMockTask({ timeEstimate: 30 }),
      ];
      const rules: SchedulingRule[] = [];

      const duration = estimateBatchDuration(tasks, rules);
      expect(duration).toBe(60 + 10 + 10 + 30); // 110 minutes
    });
  });

  describe('checkAvailabilitySufficiency', () => {
    it('should determine if availability is sufficient', () => {
      const tasks = [createMockTask({ timeEstimate: 60 })];
      const availability = [
        createMockAvailability(new Date(), [createMockSlot(9, 17)]),
      ];
      // Set totalFreeMinutes manually
      availability[0].totalFreeMinutes = 480; // 8 hours

      const result = checkAvailabilitySufficiency(tasks, availability, []);
      expect(result.sufficient).toBe(true);
      expect(result.requiredMinutes).toBe(60);
      expect(result.availableMinutes).toBe(480);
    });

    it('should detect insufficient availability', () => {
      const tasks = [createMockTask({ timeEstimate: 600 })]; // 10 hours
      const availability = [
        createMockAvailability(new Date(), [createMockSlot(9, 17)]),
      ];
      availability[0].totalFreeMinutes = 480; // 8 hours

      const result = checkAvailabilitySufficiency(tasks, availability, []);
      expect(result.sufficient).toBe(false);
    });
  });

  describe('scheduleBatch', () => {
    it('should schedule tasks by priority order', async () => {
      const highPriTask = createMockTask({
        id: 'high-1',
        priority: 'high',
        timeEstimate: 60,
      });
      const lowPriTask = createMockTask({
        id: 'low-1',
        priority: 'low',
        timeEstimate: 60,
      });

      const availability = [
        createMockAvailability(new Date(), [createMockSlot(9, 17)]),
      ];
      availability[0].totalFreeMinutes = 480;

      const result = await scheduleBatch({
        tasks: [lowPriTask, highPriTask], // Wrong order intentionally
        availability,
        rules: [],
        protectedSlots: [],
        preferences: createMockPreferences(),
        respectPriority: true,
        userId: 'user-1',
      });

      // High priority should be scheduled first (gets earlier/better slot)
      expect(result.scheduled.length).toBeGreaterThanOrEqual(1);
      if (result.scheduled.length >= 2) {
        expect(result.scheduled[0].task.id).toBe('high-1');
      }
    });
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe('Scheduling Engine Integration', () => {
  it('should find best slots for a task', async () => {
    const task = createMockTask({
      taskType: 'deep_work',
      timeEstimate: 60,
      priority: 'high',
    });

    const today = new Date();
    const availability = [
      createMockAvailability(today, [
        createMockSlot(9, 12, today),
        createMockSlot(14, 17, today),
      ]),
    ];

    const context: SchedulingContext = {
      userId: 'user-1',
      task,
      availability,
      existingScheduledTasks: [],
      rules: [],
      protectedSlots: [],
      preferences: createMockPreferences(),
    };

    const engine = createSchedulingEngine(context);
    const suggestions = await engine.findBestSlots(5);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].score).toBeGreaterThan(0);
    expect(suggestions[0].reasoning).toBeTruthy();
  });

  it('should respect protected slots', async () => {
    const task = createMockTask({
      timeEstimate: 60,
      priority: 'medium',
    });

    const today = new Date();
    // Set to a weekday
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0) today.setDate(today.getDate() + 1);
    if (dayOfWeek === 6) today.setDate(today.getDate() + 2);

    const availability = [
      createMockAvailability(today, [
        createMockSlot(11, 14, today), // Spans lunch (12-1)
      ]),
    ];

    const protectedSlots = [
      createMockProtectedSlot({
        recurrence: {
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '12:00',
          endTime: '13:00',
        },
      }),
    ];

    const context: SchedulingContext = {
      userId: 'user-1',
      task,
      availability,
      existingScheduledTasks: [],
      rules: [],
      protectedSlots,
      preferences: createMockPreferences(),
    };

    const engine = createSchedulingEngine(context);
    const suggestions = await engine.findBestSlots(5);

    // Should not suggest slots during lunch time
    for (const suggestion of suggestions) {
      const slotStart = suggestion.slot.start.getHours();
      const slotEnd = suggestion.slot.end.getHours();
      // Slot should not completely overlap with 12-1pm
      expect(slotStart >= 13 || slotEnd <= 12).toBe(true);
    }
  });

  it('should handle no available slots gracefully', async () => {
    const task = createMockTask({ timeEstimate: 600 }); // 10 hours - impossible

    const today = new Date();
    const availability = [
      createMockAvailability(today, [
        createMockSlot(9, 10, today), // Only 1 hour available
      ]),
    ];

    const context: SchedulingContext = {
      userId: 'user-1',
      task,
      availability,
      existingScheduledTasks: [],
      rules: [],
      protectedSlots: [],
      preferences: createMockPreferences(),
    };

    const engine = createSchedulingEngine(context);
    const suggestions = await engine.findBestSlots(5);

    expect(suggestions).toHaveLength(0);
  });

  it('should detect and suggest displacements', async () => {
    const task = createMockTask({
      id: 'new-task',
      priority: 'high',
      timeEstimate: 60,
    });

    const today = new Date();
    const availability = [
      createMockAvailability(today, [createMockSlot(9, 11, today)]),
    ];

    const existingScheduledTasks: ScheduledTask[] = [
      {
        taskId: 'existing-task',
        calendarEventId: 'event-1',
        calendarId: 'primary',
        scheduledStart: createMockSlot(9, 10, today).start.toISOString(),
        scheduledEnd: createMockSlot(9, 10, today).end.toISOString(),
        syncStatus: 'synced',
      },
    ];

    const context: SchedulingContext = {
      userId: 'user-1',
      task,
      availability,
      existingScheduledTasks,
      rules: [],
      protectedSlots: [],
      preferences: createMockPreferences(),
    };

    const engine = createSchedulingEngine(context);
    const displacements = engine.checkDisplacements(createMockSlot(9, 10, today));

    expect(displacements.length).toBeGreaterThan(0);
    expect(displacements[0].taskId).toBe('existing-task');
  });
});
