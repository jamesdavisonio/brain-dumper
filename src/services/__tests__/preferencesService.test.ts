/**
 * Unit tests for preferencesService
 * @module services/__tests__/preferencesService.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  getDefaultPreferences,
  getPreferences,
  savePreferences,
  updateWorkingHours,
  updateTaskTypeRule,
  getTaskTypeRule,
  addProtectedSlot,
  removeProtectedSlot,
  updateProtectedSlot,
  updateBufferDefaults,
  updateCallSlotPreferences,
  resetPreferences,
  DEFAULT_WORKING_HOURS,
  DEFAULT_TASK_TYPE_RULES
} from '../preferencesService';
import type { WorkingHoursDay, TaskTypeRule, ProtectedTimeSlotConfig } from '@/types/scheduling';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn()
}));

vi.mock('@/lib/firebase', () => ({
  db: {}
}));

const mockDoc = vi.mocked(doc);
const mockGetDoc = vi.mocked(getDoc);
const mockSetDoc = vi.mocked(setDoc);
const mockUpdateDoc = vi.mocked(updateDoc);

describe('preferencesService', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ id: 'scheduling' } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_WORKING_HOURS', () => {
    it('should have 7 days configured', () => {
      expect(DEFAULT_WORKING_HOURS).toHaveLength(7);
    });

    it('should have weekdays enabled by default', () => {
      const enabledDays = DEFAULT_WORKING_HOURS.filter(d => d.enabled);
      expect(enabledDays).toHaveLength(5);
      expect(enabledDays.map(d => d.dayOfWeek).sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('should have weekend disabled by default', () => {
      const disabledDays = DEFAULT_WORKING_HOURS.filter(d => !d.enabled);
      expect(disabledDays).toHaveLength(2);
      expect(disabledDays.map(d => d.dayOfWeek).sort()).toEqual([0, 6]);
    });

    it('should have default times of 09:00-17:00', () => {
      DEFAULT_WORKING_HOURS.forEach(day => {
        expect(day.startTime).toBe('09:00');
        expect(day.endTime).toBe('17:00');
      });
    });
  });

  describe('DEFAULT_TASK_TYPE_RULES', () => {
    it('should have rules for all main task types', () => {
      const taskTypes = DEFAULT_TASK_TYPE_RULES.map(r => r.taskType);
      expect(taskTypes).toContain('deep_work');
      expect(taskTypes).toContain('coding');
      expect(taskTypes).toContain('call');
      expect(taskTypes).toContain('meeting');
      expect(taskTypes).toContain('personal');
    });

    it('should have morning preference for deep work', () => {
      const deepWorkRule = DEFAULT_TASK_TYPE_RULES.find(r => r.taskType === 'deep_work');
      expect(deepWorkRule?.preferredTimeOfDay).toBe('morning');
    });

    it('should have buffers configured for calls', () => {
      const callRule = DEFAULT_TASK_TYPE_RULES.find(r => r.taskType === 'call');
      expect(callRule?.bufferBefore).toBeGreaterThan(0);
      expect(callRule?.bufferAfter).toBeGreaterThan(0);
    });
  });

  describe('getDefaultPreferences', () => {
    it('should return default preferences with userId', () => {
      const prefs = getDefaultPreferences(testUserId);
      expect(prefs.userId).toBe(testUserId);
    });

    it('should include default working hours', () => {
      const prefs = getDefaultPreferences(testUserId);
      expect(prefs.workingHours).toEqual(DEFAULT_WORKING_HOURS);
    });

    it('should include default task type rules', () => {
      const prefs = getDefaultPreferences(testUserId);
      expect(prefs.taskTypeRules).toEqual(DEFAULT_TASK_TYPE_RULES);
    });

    it('should have empty protected slots by default', () => {
      const prefs = getDefaultPreferences(testUserId);
      expect(prefs.protectedSlots).toEqual([]);
    });

    it('should have call slot enabled by default', () => {
      const prefs = getDefaultPreferences(testUserId);
      expect(prefs.keepSlotFreeForCalls).toBe(true);
    });

    it('should have default buffer times', () => {
      const prefs = getDefaultPreferences(testUserId);
      expect(prefs.defaultBufferBefore).toBe(5);
      expect(prefs.defaultBufferAfter).toBe(5);
    });
  });

  describe('getPreferences', () => {
    it('should return default preferences if no document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null
      } as any);

      const prefs = await getPreferences(testUserId);
      expect(prefs.userId).toBe(testUserId);
      expect(prefs.workingHours).toEqual(DEFAULT_WORKING_HOURS);
    });

    it('should return stored preferences if document exists', async () => {
      const storedPrefs = {
        defaultBufferBefore: 10,
        defaultBufferAfter: 15
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => storedPrefs
      } as any);

      const prefs = await getPreferences(testUserId);
      expect(prefs.defaultBufferBefore).toBe(10);
      expect(prefs.defaultBufferAfter).toBe(15);
    });

    it('should merge stored preferences with defaults', async () => {
      const storedPrefs = {
        defaultBufferBefore: 10
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => storedPrefs
      } as any);

      const prefs = await getPreferences(testUserId);
      expect(prefs.defaultBufferBefore).toBe(10);
      expect(prefs.defaultBufferAfter).toBe(5); // default
      expect(prefs.workingHours).toBeDefined();
    });

    it('should always set userId correctly', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'different-user' })
      } as any);

      const prefs = await getPreferences(testUserId);
      expect(prefs.userId).toBe(testUserId);
    });
  });

  describe('savePreferences', () => {
    it('should update existing document', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({})
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await savePreferences(testUserId, { defaultBufferBefore: 15 });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { defaultBufferBefore: 15 }
      );
    });

    it('should create new document if not exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null
      } as any);
      mockSetDoc.mockResolvedValue(undefined);

      await savePreferences(testUserId, { defaultBufferBefore: 15 });

      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should remove userId from updates', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({})
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await savePreferences(testUserId, { userId: 'ignored', defaultBufferBefore: 15 } as any);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ userId: expect.anything() })
      );
    });
  });

  describe('updateWorkingHours', () => {
    it('should save working hours', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({})
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const newHours: WorkingHoursDay[] = [
        { dayOfWeek: 0, enabled: true, startTime: '10:00', endTime: '18:00' }
      ] as WorkingHoursDay[];

      await updateWorkingHours(testUserId, newHours);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { workingHours: newHours }
      );
    });
  });

  describe('updateTaskTypeRule', () => {
    it('should update existing rule', async () => {
      const existingRules: TaskTypeRule[] = [
        { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 }
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ taskTypeRules: existingRules })
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const newRule: TaskTypeRule = {
        taskType: 'deep_work',
        preferredTimeOfDay: 'afternoon',
        defaultDuration: 90,
        bufferBefore: 5,
        bufferAfter: 5
      };

      await updateTaskTypeRule(testUserId, newRule);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          taskTypeRules: expect.arrayContaining([newRule])
        })
      );
    });

    it('should add new rule if not exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ taskTypeRules: [] })
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const newRule: TaskTypeRule = {
        taskType: 'coding',
        preferredTimeOfDay: 'morning',
        defaultDuration: 60,
        bufferBefore: 0,
        bufferAfter: 0
      };

      await updateTaskTypeRule(testUserId, newRule);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          taskTypeRules: [newRule]
        })
      );
    });
  });

  describe('getTaskTypeRule', () => {
    it('should return rule for task type', async () => {
      const rules: TaskTypeRule[] = [
        { taskType: 'coding', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 }
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ taskTypeRules: rules })
      } as any);

      const rule = await getTaskTypeRule(testUserId, 'coding');
      expect(rule?.taskType).toBe('coding');
    });

    it('should return undefined if rule not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ taskTypeRules: [] })
      } as any);

      const rule = await getTaskTypeRule(testUserId, 'coding');
      expect(rule).toBeUndefined();
    });
  });

  describe('addProtectedSlot', () => {
    it('should add new protected slot with generated id', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ protectedSlots: [] })
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const newSlot: Omit<ProtectedTimeSlotConfig, 'id'> = {
        name: 'Lunch',
        recurrence: 'daily',
        startTime: '12:00',
        endTime: '13:00',
        enabled: true
      };

      const id = await addProtectedSlot(testUserId, newSlot);

      expect(id).toMatch(/^slot-/);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          protectedSlots: expect.arrayContaining([
            expect.objectContaining({ name: 'Lunch' })
          ])
        })
      );
    });
  });

  describe('removeProtectedSlot', () => {
    it('should remove slot by id', async () => {
      const slots: ProtectedTimeSlotConfig[] = [
        { id: 'slot-1', name: 'Lunch', recurrence: 'daily', startTime: '12:00', endTime: '13:00', enabled: true },
        { id: 'slot-2', name: 'Exercise', recurrence: 'daily', startTime: '18:00', endTime: '19:00', enabled: true }
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ protectedSlots: slots })
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await removeProtectedSlot(testUserId, 'slot-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        {
          protectedSlots: [{ id: 'slot-2', name: 'Exercise', recurrence: 'daily', startTime: '18:00', endTime: '19:00', enabled: true }]
        }
      );
    });
  });

  describe('updateProtectedSlot', () => {
    it('should update existing slot', async () => {
      const slots: ProtectedTimeSlotConfig[] = [
        { id: 'slot-1', name: 'Lunch', recurrence: 'daily', startTime: '12:00', endTime: '13:00', enabled: true }
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ protectedSlots: slots })
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      const updatedSlot: ProtectedTimeSlotConfig = {
        id: 'slot-1',
        name: 'Long Lunch',
        recurrence: 'daily',
        startTime: '12:00',
        endTime: '14:00',
        enabled: true
      };

      await updateProtectedSlot(testUserId, updatedSlot);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          protectedSlots: [updatedSlot]
        })
      );
    });
  });

  describe('updateBufferDefaults', () => {
    it('should update buffer times', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({})
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateBufferDefaults(testUserId, 10, 15);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        {
          defaultBufferBefore: 10,
          defaultBufferAfter: 15
        }
      );
    });
  });

  describe('updateCallSlotPreferences', () => {
    it('should update call slot preferences', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({})
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateCallSlotPreferences(testUserId, true, 45, 'morning');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        {
          keepSlotFreeForCalls: true,
          callSlotDuration: 45,
          callSlotPreferredTime: 'morning'
        }
      );
    });

    it('should only update specified fields', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({})
      } as any);
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateCallSlotPreferences(testUserId, false);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { keepSlotFreeForCalls: false }
      );
    });
  });

  describe('resetPreferences', () => {
    it('should reset to default preferences', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await resetPreferences(testUserId);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: testUserId,
          workingHours: DEFAULT_WORKING_HOURS,
          taskTypeRules: DEFAULT_TASK_TYPE_RULES
        })
      );
    });
  });
});
