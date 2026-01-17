/**
 * Rule engine for scheduling
 * Provides default rules for task types and rule application logic
 * @module scheduling/rules
 */

import type { Task, TaskType, SchedulingRule } from '../types';
import { parseTimeString } from '../calendar/utils';

/**
 * Represents a time slot for scheduling
 */
export interface TimeSlot {
  /** Start time of the slot */
  start: Date;
  /** End time of the slot */
  end: Date;
  /** Whether this slot is available */
  available: boolean;
}

/**
 * Default rules for each task type
 * These are used when user hasn't specified custom rules
 */
export const DEFAULT_TASK_TYPE_RULES: Record<TaskType, Partial<SchedulingRule>> = {
  deep_work: {
    preferredTimeRange: { start: '09:00', end: '12:00' },
    defaultDuration: 120,
    bufferBefore: 0,
    bufferAfter: 10,
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  coding: {
    preferredTimeRange: { start: '09:00', end: '12:00' },
    defaultDuration: 120,
    bufferBefore: 0,
    bufferAfter: 10,
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  call: {
    preferredTimeRange: { start: '14:00', end: '17:00' },
    defaultDuration: 30,
    bufferBefore: 15,
    bufferAfter: 15,
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  meeting: {
    preferredTimeRange: { start: '10:00', end: '16:00' },
    defaultDuration: 60,
    bufferBefore: 10,
    bufferAfter: 5,
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  personal: {
    preferredTimeRange: { start: '08:00', end: '20:00' },
    defaultDuration: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    preferredDays: [0, 1, 2, 3, 4, 5, 6], // All days
  },
  admin: {
    preferredTimeRange: { start: '14:00', end: '17:00' },
    defaultDuration: 30,
    bufferBefore: 0,
    bufferAfter: 0,
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  health: {
    preferredTimeRange: { start: '07:00', end: '09:00' },
    defaultDuration: 60,
    bufferBefore: 0,
    bufferAfter: 15,
    preferredDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  },
  other: {
    preferredTimeRange: { start: '09:00', end: '17:00' },
    defaultDuration: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    preferredDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
};

/**
 * Result from rule satisfaction check
 */
export interface RuleSatisfactionResult {
  /** Whether all rules are satisfied */
  satisfies: boolean;
  /** List of rule violations */
  violations: string[];
  /** Partial satisfaction score (0-100) */
  partialScore: number;
}

/**
 * Get the default rule for a task type
 *
 * @param taskType - The type of task
 * @returns Default scheduling rule for this task type
 */
export function getDefaultRule(taskType: TaskType): Partial<SchedulingRule> {
  return DEFAULT_TASK_TYPE_RULES[taskType] || DEFAULT_TASK_TYPE_RULES.other;
}

/**
 * Get effective rules for a task (user rules override defaults)
 * Merges default rules with user-specified rules
 *
 * @param task - The task to get rules for
 * @param userRules - User's custom scheduling rules
 * @returns Effective scheduling rule for this task
 */
export function getEffectiveRules(
  task: Task,
  userRules: SchedulingRule[]
): SchedulingRule {
  const taskType = task.taskType || 'other';
  const defaultRule = getDefaultRule(taskType);

  // Find user rule for this task type
  const userRule = userRules.find(
    (r) => r.taskType === taskType && r.enabled
  );

  // Start with defaults
  const effectiveRule: SchedulingRule = {
    id: userRule?.id || `default-${taskType}`,
    userId: userRule?.userId || task.userId,
    taskType,
    enabled: true,
    preferredTimeRange: userRule?.preferredTimeRange ||
      defaultRule.preferredTimeRange ||
      { start: '09:00', end: '17:00' },
    preferredDays: userRule?.preferredDays ||
      defaultRule.preferredDays ||
      [1, 2, 3, 4, 5],
    defaultDuration: userRule?.defaultDuration ||
      defaultRule.defaultDuration ||
      60,
    bufferBefore: userRule?.bufferBefore ??
      defaultRule.bufferBefore ??
      0,
    bufferAfter: userRule?.bufferAfter ??
      defaultRule.bufferAfter ??
      0,
    calendarId: userRule?.calendarId,
    createdAt: userRule?.createdAt || new Date().toISOString(),
    updatedAt: userRule?.updatedAt || new Date().toISOString(),
  };

  // Task-specific overrides take precedence
  if (task.timeEstimate) {
    effectiveRule.defaultDuration = task.timeEstimate;
  }
  if (task.bufferBefore !== undefined) {
    effectiveRule.bufferBefore = task.bufferBefore;
  }
  if (task.bufferAfter !== undefined) {
    effectiveRule.bufferAfter = task.bufferAfter;
  }

  return effectiveRule;
}

/**
 * Parse time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTimeString(timeStr);
  return hours * 60 + minutes;
}

/**
 * Check if a slot satisfies scheduling rules
 *
 * @param slot - The time slot to check
 * @param rules - The scheduling rules to apply
 * @returns Object indicating whether rules are satisfied and any violations
 */
export function slotSatisfiesRules(
  slot: TimeSlot,
  rules: SchedulingRule
): RuleSatisfactionResult {
  const violations: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // Check 1: Day of week
  totalChecks++;
  const slotDay = slot.start.getDay();
  if (rules.preferredDays.length > 0 && !rules.preferredDays.includes(slotDay)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    violations.push(
      `${dayNames[slotDay]} is not a preferred day for this task type`
    );
  } else {
    passedChecks++;
  }

  // Check 2: Time range
  totalChecks++;
  const slotStartMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
  const slotEndMinutes = slot.end.getHours() * 60 + slot.end.getMinutes();
  const rangeStart = timeToMinutes(rules.preferredTimeRange.start);
  const rangeEnd = timeToMinutes(rules.preferredTimeRange.end);

  if (slotStartMinutes < rangeStart || slotEndMinutes > rangeEnd) {
    violations.push(
      `Slot (${formatTime(slotStartMinutes)}-${formatTime(slotEndMinutes)}) is outside preferred time range (${rules.preferredTimeRange.start}-${rules.preferredTimeRange.end})`
    );
  } else {
    passedChecks++;
  }

  // Check 3: Duration
  totalChecks++;
  const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
  if (slotDuration < rules.defaultDuration) {
    violations.push(
      `Slot duration (${Math.round(slotDuration)} min) is less than required (${rules.defaultDuration} min)`
    );
  } else {
    passedChecks++;
  }

  const partialScore = Math.round((passedChecks / totalChecks) * 100);

  return {
    satisfies: violations.length === 0,
    violations,
    partialScore,
  };
}

/**
 * Format minutes as HH:MM string
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Filter slots by rules
 * Can operate in strict mode (all rules must pass) or flexible mode (partial match OK)
 *
 * @param slots - Array of time slots to filter
 * @param rules - The scheduling rules to apply
 * @param strict - If true, only return slots that fully satisfy rules
 * @returns Array of slots that match the rules
 */
export function filterSlotsByRules(
  slots: TimeSlot[],
  rules: SchedulingRule,
  strict: boolean = false
): TimeSlot[] {
  return slots.filter((slot) => {
    const result = slotSatisfiesRules(slot, rules);
    if (strict) {
      return result.satisfies;
    }
    // In non-strict mode, accept slots that pass at least 50% of rules
    return result.partialScore >= 50;
  });
}

/**
 * Sort slots by how well they match the rules
 * Better matching slots come first
 *
 * @param slots - Array of time slots to sort
 * @param rules - The scheduling rules to apply
 * @returns Sorted array of slots
 */
export function sortSlotsByRuleMatch(
  slots: TimeSlot[],
  rules: SchedulingRule
): TimeSlot[] {
  return [...slots].sort((a, b) => {
    const resultA = slotSatisfiesRules(a, rules);
    const resultB = slotSatisfiesRules(b, rules);
    return resultB.partialScore - resultA.partialScore;
  });
}

/**
 * Get the required total duration for a task including buffers
 *
 * @param task - The task
 * @param rules - The effective scheduling rules
 * @returns Total duration in minutes (task + buffers)
 */
export function getTotalDurationWithBuffers(
  task: Task,
  rules: SchedulingRule
): number {
  const taskDuration = task.timeEstimate || rules.defaultDuration;
  const bufferBefore = task.bufferBefore ?? rules.bufferBefore;
  const bufferAfter = task.bufferAfter ?? rules.bufferAfter;
  return taskDuration + bufferBefore + bufferAfter;
}

/**
 * Infer task type from task content using keywords
 * This is a simple heuristic when task type is not explicitly set
 *
 * @param task - The task to analyze
 * @returns Inferred task type
 */
export function inferTaskType(task: Task): TaskType {
  const content = task.content.toLowerCase();

  // Check for call-related keywords
  if (
    content.includes('call') ||
    content.includes('phone') ||
    content.includes('zoom') ||
    content.includes('teams call')
  ) {
    return 'call';
  }

  // Check for meeting-related keywords
  if (
    content.includes('meeting') ||
    content.includes('sync') ||
    content.includes('standup') ||
    content.includes('1:1') ||
    content.includes('one-on-one')
  ) {
    return 'meeting';
  }

  // Check for coding-related keywords
  if (
    content.includes('code') ||
    content.includes('coding') ||
    content.includes('develop') ||
    content.includes('implement') ||
    content.includes('fix bug') ||
    content.includes('debug')
  ) {
    return 'coding';
  }

  // Check for deep work keywords
  if (
    content.includes('write') ||
    content.includes('design') ||
    content.includes('research') ||
    content.includes('plan') ||
    content.includes('strategy')
  ) {
    return 'deep_work';
  }

  // Check for admin keywords
  if (
    content.includes('email') ||
    content.includes('inbox') ||
    content.includes('expense') ||
    content.includes('report') ||
    content.includes('paperwork')
  ) {
    return 'admin';
  }

  // Check for health keywords
  if (
    content.includes('exercise') ||
    content.includes('gym') ||
    content.includes('workout') ||
    content.includes('doctor') ||
    content.includes('dentist')
  ) {
    return 'health';
  }

  // Check for personal keywords
  if (
    content.includes('personal') ||
    content.includes('family') ||
    content.includes('errand') ||
    content.includes('shopping')
  ) {
    return 'personal';
  }

  return 'other';
}

/**
 * Get task type, either from task or inferred
 *
 * @param task - The task
 * @returns Task type (explicit or inferred)
 */
export function getTaskType(task: Task): TaskType {
  return task.taskType || inferTaskType(task);
}
