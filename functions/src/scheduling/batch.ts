/**
 * Batch scheduling for multiple tasks
 * Optimally schedules multiple tasks respecting priority order
 * @module scheduling/batch
 */

import type {
  Task,
  SchedulingRule,
  ProtectedSlot,
  UserSchedulingPreferences,
  Priority,
} from '../types';
import {
  SchedulingEngine,
  SchedulingContext,
  SchedulingSuggestion,
  TimeSlot,
  SchedulingAvailabilityWindow,
} from './engine';

/**
 * Options for batch scheduling
 */
export interface BatchScheduleOptions {
  /** Tasks to schedule */
  tasks: Task[];
  /** Available time windows */
  availability: SchedulingAvailabilityWindow[];
  /** Scheduling rules */
  rules: SchedulingRule[];
  /** Protected time slots */
  protectedSlots: ProtectedSlot[];
  /** User's scheduling preferences */
  preferences: UserSchedulingPreferences;
  /** Whether to respect priority order (high-priority first) */
  respectPriority: boolean;
  /** User ID */
  userId: string;
}

/**
 * Result of scheduling a single task in a batch
 */
export interface BatchScheduledTask {
  /** The task that was scheduled */
  task: Task;
  /** The assigned time slot */
  slot: TimeSlot;
  /** Score for this assignment */
  score: number;
  /** Reasoning for this assignment */
  reasoning: string;
}

/**
 * Conflict information for unschedulable tasks
 */
export interface BatchConflict {
  /** The task that has conflicts */
  task: Task;
  /** IDs of tasks it conflicts with */
  conflictsWith: string[];
  /** Suggestion for resolving the conflict */
  suggestion: string;
}

/**
 * Information about tasks that couldn't be scheduled
 */
export interface UnschedulableTask {
  /** The task that couldn't be scheduled */
  task: Task;
  /** Reason why it couldn't be scheduled */
  reason: string;
}

/**
 * Result of batch scheduling operation
 */
export interface BatchScheduleResult {
  /** Successfully scheduled tasks with their slots */
  scheduled: BatchScheduledTask[];
  /** Tasks with scheduling conflicts */
  conflicts: BatchConflict[];
  /** Tasks that couldn't be scheduled at all */
  unschedulable: UnschedulableTask[];
  /** Summary statistics */
  summary: {
    totalTasks: number;
    scheduledCount: number;
    conflictCount: number;
    unschedulableCount: number;
    totalTimeScheduled: number; // minutes
  };
}

/**
 * Priority order for sorting tasks
 */
const PRIORITY_ORDER: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Sort tasks by priority (high first), then by due date (earlier first)
 */
function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // First by priority (high > medium > low)
    const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (earlier first)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Finally by creation date (earlier first)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Check if two time slots overlap
 */
function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.start < slot2.end && slot1.end > slot2.start;
}

/**
 * Create a deep copy of availability with a slot marked as busy
 */
function markSlotAsUsed(
  availability: SchedulingAvailabilityWindow[],
  usedSlot: TimeSlot
): SchedulingAvailabilityWindow[] {
  return availability.map((window) => ({
    ...window,
    slots: window.slots.map((slot) => {
      if (slotsOverlap(slot, usedSlot)) {
        // Split the slot if needed
        const newSlots: TimeSlot[] = [];

        // Part before the used slot
        if (slot.start < usedSlot.start) {
          newSlots.push({
            start: slot.start,
            end: usedSlot.start,
            available: slot.available,
          });
        }

        // Part after the used slot
        if (slot.end > usedSlot.end) {
          newSlots.push({
            start: usedSlot.end,
            end: slot.end,
            available: slot.available,
          });
        }

        // If no parts remain, mark as unavailable
        if (newSlots.length === 0) {
          return { ...slot, available: false };
        }

        // Return first new slot (simplified - in production would need to handle multiple)
        return newSlots[0];
      }
      return slot;
    }),
    totalFreeMinutes: window.totalFreeMinutes -
      Math.max(0, Math.min(
        (usedSlot.end.getTime() - usedSlot.start.getTime()) / (1000 * 60),
        window.totalFreeMinutes
      )),
  }));
}

/**
 * Schedule multiple tasks optimally, respecting priority order
 *
 * @param options - Batch scheduling options
 * @returns BatchScheduleResult with scheduled tasks, conflicts, and unschedulable tasks
 */
export async function scheduleBatch(
  options: BatchScheduleOptions
): Promise<BatchScheduleResult> {
  const {
    tasks,
    availability,
    rules,
    protectedSlots,
    preferences,
    respectPriority,
    userId,
  } = options;

  // Sort tasks by priority if requested
  const orderedTasks = respectPriority ? sortTasksByPriority(tasks) : tasks;

  const scheduled: BatchScheduledTask[] = [];
  const conflicts: BatchConflict[] = [];
  const unschedulable: UnschedulableTask[] = [];

  // Track currently available time (updated as we schedule tasks)
  let currentAvailability = availability;

  // Track assigned slots for conflict detection
  const assignedSlots: Map<string, TimeSlot> = new Map();

  for (const task of orderedTasks) {
    // Create context for this task
    const context: SchedulingContext = {
      userId,
      task,
      availability: currentAvailability,
      existingScheduledTasks: [], // Already handled by our tracking
      rules,
      protectedSlots,
      preferences,
    };

    // Create engine and find best slots
    const engine = new SchedulingEngine(context);
    const suggestions = await engine.findBestSlots(3);

    if (suggestions.length === 0) {
      // No available slots for this task
      unschedulable.push({
        task,
        reason: 'No available time slots that fit the task requirements',
      });
      continue;
    }

    // Find the best non-conflicting slot
    let bestSuggestion: SchedulingSuggestion | null = null;
    const conflictingTaskIds: string[] = [];

    for (const suggestion of suggestions) {
      // Check if this slot conflicts with already assigned slots
      let hasConflict = false;

      for (const [taskId, assignedSlot] of assignedSlots.entries()) {
        if (slotsOverlap(suggestion.slot, assignedSlot)) {
          hasConflict = true;
          conflictingTaskIds.push(taskId);
        }
      }

      if (!hasConflict) {
        bestSuggestion = suggestion;
        break;
      }
    }

    if (bestSuggestion) {
      // Schedule the task
      scheduled.push({
        task,
        slot: bestSuggestion.slot,
        score: bestSuggestion.score,
        reasoning: bestSuggestion.reasoning,
      });

      // Mark slot as used
      assignedSlots.set(task.id, bestSuggestion.slot);
      currentAvailability = markSlotAsUsed(
        currentAvailability,
        bestSuggestion.slot
      );
    } else if (conflictingTaskIds.length > 0) {
      // Has conflicts with higher-priority tasks
      conflicts.push({
        task,
        conflictsWith: conflictingTaskIds,
        suggestion: `Consider rescheduling after ${conflictingTaskIds.join(', ')} or extending working hours`,
      });
    } else {
      // Shouldn't happen, but handle gracefully
      unschedulable.push({
        task,
        reason: 'Unable to find suitable slot due to constraints',
      });
    }
  }

  // Calculate summary
  const totalTimeScheduled = scheduled.reduce((sum, item) => {
    const duration =
      (item.slot.end.getTime() - item.slot.start.getTime()) / (1000 * 60);
    return sum + duration;
  }, 0);

  return {
    scheduled,
    conflicts,
    unschedulable,
    summary: {
      totalTasks: tasks.length,
      scheduledCount: scheduled.length,
      conflictCount: conflicts.length,
      unschedulableCount: unschedulable.length,
      totalTimeScheduled,
    },
  };
}

/**
 * Validate batch scheduling options
 *
 * @param options - Options to validate
 * @returns Validation result
 */
export function validateBatchOptions(
  options: BatchScheduleOptions
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options.tasks || options.tasks.length === 0) {
    errors.push('No tasks provided for scheduling');
  }

  if (!options.availability || options.availability.length === 0) {
    errors.push('No availability windows provided');
  }

  if (!options.preferences) {
    errors.push('User preferences are required');
  }

  if (!options.userId) {
    errors.push('User ID is required');
  }

  // Check that tasks have required fields
  for (const task of options.tasks || []) {
    if (!task.id) {
      errors.push(`Task missing ID: ${task.content?.slice(0, 30)}...`);
    }
    if (!task.priority) {
      errors.push(`Task ${task.id} missing priority`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimate total time needed for batch of tasks
 *
 * @param tasks - Tasks to estimate
 * @param rules - Scheduling rules for defaults
 * @returns Total estimated minutes
 */
export function estimateBatchDuration(
  tasks: Task[],
  rules: SchedulingRule[]
): number {
  return tasks.reduce((total, task) => {
    // Use task's time estimate or find default from rules
    let duration = task.timeEstimate;

    if (!duration) {
      const taskType = task.taskType || 'other';
      const rule = rules.find((r) => r.taskType === taskType);
      duration = rule?.defaultDuration || 60;
    }

    // Add buffers
    const bufferBefore = task.bufferBefore || 0;
    const bufferAfter = task.bufferAfter || 0;

    return total + duration + bufferBefore + bufferAfter;
  }, 0);
}

/**
 * Check if availability is sufficient for all tasks
 *
 * @param tasks - Tasks to schedule
 * @param availability - Available time windows
 * @param rules - Scheduling rules
 * @returns Result indicating if there's enough time
 */
export function checkAvailabilitySufficiency(
  tasks: Task[],
  availability: SchedulingAvailabilityWindow[],
  rules: SchedulingRule[]
): { sufficient: boolean; requiredMinutes: number; availableMinutes: number } {
  const requiredMinutes = estimateBatchDuration(tasks, rules);
  const availableMinutes = availability.reduce(
    (sum, window) => sum + window.totalFreeMinutes,
    0
  );

  return {
    sufficient: availableMinutes >= requiredMinutes,
    requiredMinutes,
    availableMinutes,
  };
}
