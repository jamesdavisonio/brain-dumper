/**
 * Unit tests for useSchedulingPreferences hook
 * @module hooks/__tests__/useSchedulingPreferences.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSchedulingPreferences } from '../useSchedulingPreferences';
import type { UserSchedulingPreferences, WorkingHoursDay, TaskTypeRule, ProtectedTimeSlotConfig } from '@/types/scheduling';

// Mock the auth context
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock the preferences service
vi.mock('@/services/preferencesService', () => ({
  getPreferences: vi.fn(),
  savePreferences: vi.fn(),
  updateWorkingHours: vi.fn(),
  updateTaskTypeRule: vi.fn(),
  addProtectedSlot: vi.fn(),
  removeProtectedSlot: vi.fn(),
  updateProtectedSlot: vi.fn(),
  resetPreferences: vi.fn(),
  getDefaultPreferences: vi.fn()
}));

import { useAuth } from '@/context/AuthContext';
import {
  getPreferences,
  savePreferences,
  updateWorkingHours,
  updateTaskTypeRule,
  addProtectedSlot,
  removeProtectedSlot,
  updateProtectedSlot,
  resetPreferences,
  getDefaultPreferences
} from '@/services/preferencesService';

const mockUseAuth = vi.mocked(useAuth);
const mockGetPreferences = vi.mocked(getPreferences);
const mockSavePreferences = vi.mocked(savePreferences);
const mockUpdateWorkingHours = vi.mocked(updateWorkingHours);
const mockUpdateTaskTypeRule = vi.mocked(updateTaskTypeRule);
const mockAddProtectedSlot = vi.mocked(addProtectedSlot);
const mockRemoveProtectedSlot = vi.mocked(removeProtectedSlot);
const mockUpdateProtectedSlot = vi.mocked(updateProtectedSlot);
const mockResetPreferences = vi.mocked(resetPreferences);
const mockGetDefaultPreferences = vi.mocked(getDefaultPreferences);

// Helper to create mock preferences
function createMockPreferences(overrides: Partial<UserSchedulingPreferences> = {}): UserSchedulingPreferences {
  return {
    userId: 'test-user-123',
    defaultCalendarId: 'primary',
    preferredCalendarId: null,
    workingHours: [
      { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '17:00' }
    ],
    taskTypeRules: [
      { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 }
    ],
    protectedSlots: [],
    defaultBufferBefore: 5,
    defaultBufferAfter: 5,
    keepSlotFreeForCalls: true,
    callSlotDuration: 60,
    callSlotPreferredTime: 'afternoon',
    timezone: 'America/New_York',
    autoScheduleEnabled: false,
    preferContiguousBlocks: true,
    ...overrides
  };
}

describe('useSchedulingPreferences', () => {
  const testUser = { uid: 'test-user-123', email: 'test@example.com', displayName: 'Test User', photoURL: null };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: testUser,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with loading state', async () => {
      mockGetPreferences.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useSchedulingPreferences());

      expect(result.current.loading).toBe(true);
      expect(result.current.preferences).toBeNull();
    });

    it('should load preferences on mount', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.preferences).toEqual(mockPrefs);
      expect(mockGetPreferences).toHaveBeenCalledWith(testUser.uid);
    });

    it('should handle error during load', async () => {
      mockGetPreferences.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.preferences).toBeNull();
    });

    it('should set preferences to null when not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn()
      });

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.preferences).toBeNull();
      expect(mockGetPreferences).not.toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockSavePreferences.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updatePreferences({ defaultBufferBefore: 10 });
      });

      expect(mockSavePreferences).toHaveBeenCalledWith(testUser.uid, { defaultBufferBefore: 10 });
      expect(result.current.preferences?.defaultBufferBefore).toBe(10);
    });

    it('should throw error when not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn()
      });

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updatePreferences({ defaultBufferBefore: 10 });
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should set error on failure', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockSavePreferences.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The function should throw when save fails
      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.updatePreferences({ defaultBufferBefore: 10 });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe('Save failed');
      expect(mockSavePreferences).toHaveBeenCalled();
    });
  });

  describe('setWorkingHours', () => {
    it('should update working hours', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockUpdateWorkingHours.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newHours: WorkingHoursDay[] = [
        { dayOfWeek: 0, enabled: true, startTime: '10:00', endTime: '18:00' }
      ] as WorkingHoursDay[];

      await act(async () => {
        await result.current.setWorkingHours(newHours);
      });

      expect(mockUpdateWorkingHours).toHaveBeenCalledWith(testUser.uid, newHours);
      expect(result.current.preferences?.workingHours).toEqual(newHours);
    });

    it('should handle update error', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockUpdateWorkingHours.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The function should throw when update fails
      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.setWorkingHours([]);
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe('Update failed');
      expect(mockUpdateWorkingHours).toHaveBeenCalled();
    });
  });

  describe('setTaskTypeRule', () => {
    it('should update task type rule', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockUpdateTaskTypeRule.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newRule: TaskTypeRule = {
        taskType: 'deep_work',
        preferredTimeOfDay: 'afternoon',
        defaultDuration: 90,
        bufferBefore: 5,
        bufferAfter: 5
      };

      await act(async () => {
        await result.current.setTaskTypeRule(newRule);
      });

      expect(mockUpdateTaskTypeRule).toHaveBeenCalledWith(testUser.uid, newRule);
    });

    it('should add new rule to existing rules', async () => {
      const mockPrefs = createMockPreferences({
        taskTypeRules: [
          { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 }
        ]
      });
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockUpdateTaskTypeRule.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newRule: TaskTypeRule = {
        taskType: 'coding',
        preferredTimeOfDay: 'morning',
        defaultDuration: 60,
        bufferBefore: 0,
        bufferAfter: 0
      };

      await act(async () => {
        await result.current.setTaskTypeRule(newRule);
      });

      expect(result.current.preferences?.taskTypeRules).toContainEqual(newRule);
    });

    it('should replace existing rule for same task type', async () => {
      const mockPrefs = createMockPreferences({
        taskTypeRules: [
          { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 }
        ]
      });
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockUpdateTaskTypeRule.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updatedRule: TaskTypeRule = {
        taskType: 'deep_work',
        preferredTimeOfDay: 'evening',
        defaultDuration: 60,
        bufferBefore: 5,
        bufferAfter: 5
      };

      await act(async () => {
        await result.current.setTaskTypeRule(updatedRule);
      });

      expect(result.current.preferences?.taskTypeRules.filter(r => r.taskType === 'deep_work')).toHaveLength(1);
      expect(result.current.preferences?.taskTypeRules.find(r => r.taskType === 'deep_work')?.preferredTimeOfDay).toBe('evening');
    });
  });

  describe('addSlot', () => {
    it('should add protected slot and return id', async () => {
      const mockPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockAddProtectedSlot.mockResolvedValue('slot-123');

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newSlot: Omit<ProtectedTimeSlotConfig, 'id'> = {
        name: 'Lunch',
        recurrence: 'daily',
        startTime: '12:00',
        endTime: '13:00',
        enabled: true
      };

      let slotId: string = '';
      await act(async () => {
        slotId = await result.current.addSlot(newSlot);
      });

      expect(slotId).toBe('slot-123');
      expect(mockAddProtectedSlot).toHaveBeenCalledWith(testUser.uid, newSlot);
      expect(result.current.preferences?.protectedSlots).toContainEqual({ ...newSlot, id: 'slot-123' });
    });
  });

  describe('removeSlot', () => {
    it('should remove protected slot', async () => {
      const mockPrefs = createMockPreferences({
        protectedSlots: [
          { id: 'slot-1', name: 'Lunch', recurrence: 'daily', startTime: '12:00', endTime: '13:00', enabled: true }
        ]
      });
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockRemoveProtectedSlot.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.removeSlot('slot-1');
      });

      expect(mockRemoveProtectedSlot).toHaveBeenCalledWith(testUser.uid, 'slot-1');
      expect(result.current.preferences?.protectedSlots).toEqual([]);
    });
  });

  describe('updateSlot', () => {
    it('should update protected slot', async () => {
      const mockPrefs = createMockPreferences({
        protectedSlots: [
          { id: 'slot-1', name: 'Lunch', recurrence: 'daily', startTime: '12:00', endTime: '13:00', enabled: true }
        ]
      });
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockUpdateProtectedSlot.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updatedSlot: ProtectedTimeSlotConfig = {
        id: 'slot-1',
        name: 'Long Lunch',
        recurrence: 'daily',
        startTime: '12:00',
        endTime: '14:00',
        enabled: true
      };

      await act(async () => {
        await result.current.updateSlot(updatedSlot);
      });

      expect(mockUpdateProtectedSlot).toHaveBeenCalledWith(testUser.uid, updatedSlot);
      expect(result.current.preferences?.protectedSlots[0].name).toBe('Long Lunch');
    });
  });

  describe('refresh', () => {
    it('should reload preferences from server', async () => {
      const mockPrefs1 = createMockPreferences({ defaultBufferBefore: 5 });
      const mockPrefs2 = createMockPreferences({ defaultBufferBefore: 10 });

      mockGetPreferences.mockResolvedValueOnce(mockPrefs1).mockResolvedValueOnce(mockPrefs2);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.preferences?.defaultBufferBefore).toBe(5);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.preferences?.defaultBufferBefore).toBe(10);
      expect(mockGetPreferences).toHaveBeenCalledTimes(2);
    });
  });

  describe('reset', () => {
    it('should reset to defaults', async () => {
      const mockPrefs = createMockPreferences({ defaultBufferBefore: 15 });
      const defaultPrefs = createMockPreferences();
      mockGetPreferences.mockResolvedValue(mockPrefs);
      mockResetPreferences.mockResolvedValue(undefined);
      mockGetDefaultPreferences.mockReturnValue(defaultPrefs);

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.reset();
      });

      expect(mockResetPreferences).toHaveBeenCalledWith(testUser.uid);
      expect(result.current.preferences?.defaultBufferBefore).toBe(5);
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockGetPreferences.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('user change', () => {
    it('should reload preferences when user changes', async () => {
      const mockPrefs1 = createMockPreferences({ userId: 'user-1' });
      const mockPrefs2 = createMockPreferences({ userId: 'user-2' });

      mockGetPreferences.mockResolvedValueOnce(mockPrefs1).mockResolvedValueOnce(mockPrefs2);

      const { result, rerender } = renderHook(() => useSchedulingPreferences());

      await waitFor(() => {
        expect(result.current.preferences?.userId).toBe('user-1');
      });

      // Change user
      mockUseAuth.mockReturnValue({
        user: { uid: 'user-2', email: 'user2@example.com', displayName: 'User 2', photoURL: null },
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn()
      });

      rerender();

      await waitFor(() => {
        expect(mockGetPreferences).toHaveBeenCalledWith('user-2');
      });
    });
  });
});
