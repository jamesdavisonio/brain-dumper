/**
 * Preferences Service for managing user scheduling preferences
 * @module services/preferencesService
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  UserSchedulingPreferences,
  WorkingHoursDay,
  TaskTypeRule,
  ProtectedTimeSlotConfig,
  TaskType
} from '@/types/scheduling';

/**
 * Default working hours configuration
 */
export const DEFAULT_WORKING_HOURS: WorkingHoursDay[] = [
  { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '17:00' }
];

/**
 * Default task type rules
 */
export const DEFAULT_TASK_TYPE_RULES: TaskTypeRule[] = [
  { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 },
  { taskType: 'coding', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 },
  { taskType: 'call', preferredTimeOfDay: 'afternoon', defaultDuration: 30, bufferBefore: 15, bufferAfter: 15 },
  { taskType: 'meeting', preferredTimeOfDay: 'afternoon', defaultDuration: 60, bufferBefore: 10, bufferAfter: 10 },
  { taskType: 'personal', preferredTimeOfDay: 'flexible', defaultDuration: 60, bufferBefore: 0, bufferAfter: 0 },
  { taskType: 'admin', preferredTimeOfDay: 'afternoon', defaultDuration: 30, bufferBefore: 0, bufferAfter: 0 },
  { taskType: 'health', preferredTimeOfDay: 'morning', defaultDuration: 45, bufferBefore: 0, bufferAfter: 15 },
  { taskType: 'other', preferredTimeOfDay: 'flexible', defaultDuration: 30, bufferBefore: 0, bufferAfter: 0 }
];

/**
 * Get default preferences for a user
 */
export function getDefaultPreferences(userId: string): UserSchedulingPreferences {
  return {
    userId,
    defaultCalendarId: 'primary',
    preferredCalendarId: null,
    workingHours: [...DEFAULT_WORKING_HOURS],
    taskTypeRules: [...DEFAULT_TASK_TYPE_RULES],
    protectedSlots: [],
    defaultBufferBefore: 5,
    defaultBufferAfter: 5,
    keepSlotFreeForCalls: true,
    callSlotDuration: 60,
    callSlotPreferredTime: 'afternoon',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    autoScheduleEnabled: false,
    preferContiguousBlocks: true
  };
}

/**
 * Get user scheduling preferences from Firestore
 */
export async function getPreferences(userId: string): Promise<UserSchedulingPreferences> {
  const docRef = doc(db, 'users', userId, 'settings', 'scheduling');
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return getDefaultPreferences(userId);
  }

  const data = docSnap.data();

  // Merge with defaults to ensure all fields exist
  return {
    ...getDefaultPreferences(userId),
    ...data,
    userId // Ensure userId is always set correctly
  } as UserSchedulingPreferences;
}

/**
 * Save user scheduling preferences to Firestore
 */
export async function savePreferences(
  userId: string,
  preferences: Partial<UserSchedulingPreferences>
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'settings', 'scheduling');
  const existing = await getDoc(docRef);

  // Remove userId from updates to avoid storing it redundantly
  const { userId: _userId, ...updates } = preferences;

  if (existing.exists()) {
    await updateDoc(docRef, updates);
  } else {
    const defaults = getDefaultPreferences(userId);
    await setDoc(docRef, {
      ...defaults,
      ...updates,
      userId
    });
  }
}

/**
 * Update working hours for a user
 */
export async function updateWorkingHours(
  userId: string,
  workingHours: WorkingHoursDay[]
): Promise<void> {
  await savePreferences(userId, { workingHours });
}

/**
 * Update a specific task type rule
 */
export async function updateTaskTypeRule(
  userId: string,
  rule: TaskTypeRule
): Promise<void> {
  const prefs = await getPreferences(userId);
  const rules = prefs.taskTypeRules.filter(r => r.taskType !== rule.taskType);
  rules.push(rule);
  await savePreferences(userId, { taskTypeRules: rules });
}

/**
 * Get task type rule for a specific task type
 */
export async function getTaskTypeRule(
  userId: string,
  taskType: TaskType
): Promise<TaskTypeRule | undefined> {
  const prefs = await getPreferences(userId);
  return prefs.taskTypeRules.find(r => r.taskType === taskType);
}

/**
 * Add a protected time slot
 */
export async function addProtectedSlot(
  userId: string,
  slot: Omit<ProtectedTimeSlotConfig, 'id'>
): Promise<string> {
  const prefs = await getPreferences(userId);
  const id = `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newSlot: ProtectedTimeSlotConfig = { ...slot, id };
  await savePreferences(userId, {
    protectedSlots: [...prefs.protectedSlots, newSlot]
  });
  return id;
}

/**
 * Remove a protected time slot
 */
export async function removeProtectedSlot(
  userId: string,
  slotId: string
): Promise<void> {
  const prefs = await getPreferences(userId);
  await savePreferences(userId, {
    protectedSlots: prefs.protectedSlots.filter(s => s.id !== slotId)
  });
}

/**
 * Update a protected time slot
 */
export async function updateProtectedSlot(
  userId: string,
  slot: ProtectedTimeSlotConfig
): Promise<void> {
  const prefs = await getPreferences(userId);
  const slots = prefs.protectedSlots.map(s => s.id === slot.id ? slot : s);
  await savePreferences(userId, { protectedSlots: slots });
}

/**
 * Update buffer defaults
 */
export async function updateBufferDefaults(
  userId: string,
  bufferBefore: number,
  bufferAfter: number
): Promise<void> {
  await savePreferences(userId, {
    defaultBufferBefore: bufferBefore,
    defaultBufferAfter: bufferAfter
  });
}

/**
 * Update call slot preferences
 */
export async function updateCallSlotPreferences(
  userId: string,
  keepSlotFreeForCalls: boolean,
  callSlotDuration?: number,
  callSlotPreferredTime?: 'morning' | 'afternoon' | 'evening'
): Promise<void> {
  const updates: Partial<UserSchedulingPreferences> = { keepSlotFreeForCalls };
  if (callSlotDuration !== undefined) {
    updates.callSlotDuration = callSlotDuration;
  }
  if (callSlotPreferredTime !== undefined) {
    updates.callSlotPreferredTime = callSlotPreferredTime;
  }
  await savePreferences(userId, updates);
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(userId: string): Promise<void> {
  const defaults = getDefaultPreferences(userId);
  const docRef = doc(db, 'users', userId, 'settings', 'scheduling');
  await setDoc(docRef, defaults);
}
