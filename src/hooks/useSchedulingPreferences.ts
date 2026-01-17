/**
 * Hook for managing user scheduling preferences
 * @module hooks/useSchedulingPreferences
 */

import { useState, useEffect, useCallback } from 'react';
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
import type {
  UserSchedulingPreferences,
  WorkingHoursDay,
  TaskTypeRule,
  ProtectedTimeSlotConfig
} from '@/types/scheduling';

/**
 * Result type for the useSchedulingPreferences hook
 */
export interface UseSchedulingPreferencesResult {
  /** Current preferences or null if not loaded */
  preferences: UserSchedulingPreferences | null;
  /** Whether preferences are currently loading */
  loading: boolean;
  /** Error message if loading/saving failed */
  error: string | null;
  /** Update multiple preferences at once */
  updatePreferences: (updates: Partial<UserSchedulingPreferences>) => Promise<void>;
  /** Update working hours */
  setWorkingHours: (hours: WorkingHoursDay[]) => Promise<void>;
  /** Update a task type rule */
  setTaskTypeRule: (rule: TaskTypeRule) => Promise<void>;
  /** Add a protected time slot */
  addSlot: (slot: Omit<ProtectedTimeSlotConfig, 'id'>) => Promise<string>;
  /** Remove a protected time slot */
  removeSlot: (slotId: string) => Promise<void>;
  /** Update a protected time slot */
  updateSlot: (slot: ProtectedTimeSlotConfig) => Promise<void>;
  /** Refresh preferences from server */
  refresh: () => Promise<void>;
  /** Reset preferences to defaults */
  reset: () => Promise<void>;
  /** Clear any error */
  clearError: () => void;
}

/**
 * Hook to manage user scheduling preferences
 * Provides CRUD operations for working hours, task type rules, and protected slots
 */
export function useSchedulingPreferences(): UseSchedulingPreferencesResult {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserSchedulingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch preferences from server
   */
  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const prefs = await getPreferences(user.uid);
      setPreferences(prefs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load preferences';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Load preferences on mount and when user changes
   */
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  /**
   * Update multiple preferences at once
   */
  const updatePreferences = useCallback(async (updates: Partial<UserSchedulingPreferences>) => {
    if (!user) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      await savePreferences(user.uid, updates);
      setPreferences(prev => prev ? { ...prev, ...updates } : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      setError(message);
      throw err;
    }
  }, [user]);

  /**
   * Update working hours
   */
  const setWorkingHours = useCallback(async (hours: WorkingHoursDay[]) => {
    if (!user) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      await updateWorkingHours(user.uid, hours);
      setPreferences(prev => prev ? { ...prev, workingHours: hours } : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update working hours';
      setError(message);
      throw err;
    }
  }, [user]);

  /**
   * Update a task type rule
   */
  const setTaskTypeRule = useCallback(async (rule: TaskTypeRule) => {
    if (!user || !preferences) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      await updateTaskTypeRule(user.uid, rule);
      const rules = preferences.taskTypeRules.filter(r => r.taskType !== rule.taskType);
      rules.push(rule);
      setPreferences(prev => prev ? { ...prev, taskTypeRules: rules } : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task type rule';
      setError(message);
      throw err;
    }
  }, [user, preferences]);

  /**
   * Add a protected time slot
   */
  const addSlot = useCallback(async (slot: Omit<ProtectedTimeSlotConfig, 'id'>): Promise<string> => {
    if (!user || !preferences) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      const id = await addProtectedSlot(user.uid, slot);
      const newSlot: ProtectedTimeSlotConfig = { ...slot, id };
      setPreferences(prev => prev ? {
        ...prev,
        protectedSlots: [...prev.protectedSlots, newSlot]
      } : null);
      return id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add protected slot';
      setError(message);
      throw err;
    }
  }, [user, preferences]);

  /**
   * Remove a protected time slot
   */
  const removeSlot = useCallback(async (slotId: string) => {
    if (!user || !preferences) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      await removeProtectedSlot(user.uid, slotId);
      setPreferences(prev => prev ? {
        ...prev,
        protectedSlots: prev.protectedSlots.filter(s => s.id !== slotId)
      } : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove protected slot';
      setError(message);
      throw err;
    }
  }, [user, preferences]);

  /**
   * Update a protected time slot
   */
  const updateSlot = useCallback(async (slot: ProtectedTimeSlotConfig) => {
    if (!user || !preferences) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      await updateProtectedSlot(user.uid, slot);
      setPreferences(prev => prev ? {
        ...prev,
        protectedSlots: prev.protectedSlots.map(s => s.id === slot.id ? slot : s)
      } : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update protected slot';
      setError(message);
      throw err;
    }
  }, [user, preferences]);

  /**
   * Reset preferences to defaults
   */
  const reset = useCallback(async () => {
    if (!user) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);
      await resetPreferences(user.uid);
      setPreferences(getDefaultPreferences(user.uid));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset preferences';
      setError(message);
      throw err;
    }
  }, [user]);

  /**
   * Clear any error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    setWorkingHours,
    setTaskTypeRule,
    addSlot,
    removeSlot,
    updateSlot,
    refresh: fetchPreferences,
    reset,
    clearError
  };
}
