/**
 * Scoring factors for the scheduling engine
 * Each factor contributes to the overall slot score with configurable weights
 * @module scheduling/scoring
 */

import type {
  Task,
  TaskType,
  SchedulingRule,
  Priority,
} from '../types';
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
 * Availability window for scheduling purposes
 */
export interface SchedulingAvailabilityWindow {
  /** The date this availability is for */
  date: Date;
  /** Available time slots within this day */
  slots: TimeSlot[];
  /** Total free minutes available */
  totalFreeMinutes: number;
  /** Total busy minutes */
  totalBusyMinutes: number;
}

/**
 * A factor that contributes to the scheduling score
 */
export interface ScoringFactor {
  /** Name of the scoring factor */
  name: string;
  /** Weight of this factor in the overall score */
  weight: number;
  /** Value of this factor (0-100) */
  value: number;
  /** Human-readable description of this factor's contribution */
  description: string;
}

/**
 * Result from scoring a slot
 */
export interface ScoringResult {
  /** Total score (0-100) */
  totalScore: number;
  /** Individual factors that contributed to the score */
  factors: ScoringFactor[];
  /** Human-readable reasoning for the score */
  reasoning: string;
}

/**
 * Default weights for scoring factors (must sum to 100)
 */
export const DEFAULT_WEIGHTS = {
  taskTypePreference: 25,
  dueDateProximity: 20,
  bufferAvailability: 15,
  contiguousTime: 15,
  priorityAlignment: 15,
  timeOfDay: 10,
} as const;

/**
 * Parse a time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTimeString(timeStr);
  return hours * 60 + minutes;
}

/**
 * Get the hour of a date
 */
function getHour(date: Date): number {
  return date.getHours();
}

/**
 * Get the time of day category for an hour
 */
function getTimeOfDayCategory(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Check if a slot is within a time range
 */
function isWithinTimeRange(
  slot: TimeSlot,
  startTime: string,
  endTime: string
): boolean {
  const slotStartMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
  const slotEndMinutes = slot.end.getHours() * 60 + slot.end.getMinutes();
  const rangeStart = timeToMinutes(startTime);
  const rangeEnd = timeToMinutes(endTime);

  // Slot should be fully within the range
  return slotStartMinutes >= rangeStart && slotEndMinutes <= rangeEnd;
}

/**
 * Score a slot based on task type preference
 * Higher scores for slots within the preferred time range for the task type
 *
 * @param slot - The time slot to score
 * @param taskType - The type of task being scheduled
 * @param rules - Scheduling rules to apply
 * @param weight - Weight for this factor (default from DEFAULT_WEIGHTS)
 * @returns ScoringFactor with the score and description
 */
export function scoreTaskTypePreference(
  slot: TimeSlot,
  taskType: TaskType | undefined,
  rules: SchedulingRule[],
  weight: number = DEFAULT_WEIGHTS.taskTypePreference
): ScoringFactor {
  const name = 'taskTypePreference';

  // If no task type, return neutral score
  if (!taskType) {
    return {
      name,
      weight,
      value: 50,
      description: 'No task type specified',
    };
  }

  // Find rule for this task type
  const rule = rules.find((r) => r.taskType === taskType && r.enabled);

  if (!rule) {
    return {
      name,
      weight,
      value: 50,
      description: `No specific rule for ${taskType}`,
    };
  }

  // Check if slot is within preferred time range
  const isInPreferredRange = isWithinTimeRange(
    slot,
    rule.preferredTimeRange.start,
    rule.preferredTimeRange.end
  );

  // Check if slot is on a preferred day
  const slotDay = slot.start.getDay();
  const isPreferredDay = rule.preferredDays.length === 0 || rule.preferredDays.includes(slotDay);

  if (isInPreferredRange && isPreferredDay) {
    return {
      name,
      weight,
      value: 100,
      description: `Perfect match: ${taskType} scheduled in preferred time (${rule.preferredTimeRange.start}-${rule.preferredTimeRange.end})`,
    };
  }

  if (isInPreferredRange) {
    return {
      name,
      weight,
      value: 80,
      description: `Good time for ${taskType}, but not preferred day`,
    };
  }

  if (isPreferredDay) {
    return {
      name,
      weight,
      value: 60,
      description: `Preferred day for ${taskType}, but outside optimal hours`,
    };
  }

  return {
    name,
    weight,
    value: 30,
    description: `Outside preferred time and day for ${taskType}`,
  };
}

/**
 * Score a slot based on due date proximity
 * Higher scores for slots earlier when the task is urgent
 *
 * @param slot - The time slot to score
 * @param dueDate - The due date of the task (can be null)
 * @param priority - The priority of the task
 * @param weight - Weight for this factor (default from DEFAULT_WEIGHTS)
 * @returns ScoringFactor with the score and description
 */
export function scoreDueDateProximity(
  slot: TimeSlot,
  dueDate: Date | null,
  priority: Priority,
  weight: number = DEFAULT_WEIGHTS.dueDateProximity
): ScoringFactor {
  const name = 'dueDateProximity';

  // If no due date, return neutral score with priority consideration
  if (!dueDate) {
    const priorityBonus = priority === 'high' ? 60 : priority === 'medium' ? 50 : 40;
    return {
      name,
      weight,
      value: priorityBonus,
      description: 'No due date - scored by priority only',
    };
  }

  // Calculate days until due
  const slotDate = new Date(slot.start);
  slotDate.setHours(0, 0, 0, 0);
  const dueDateNorm = new Date(dueDate);
  dueDateNorm.setHours(0, 0, 0, 0);

  const daysDiff = Math.ceil(
    (dueDateNorm.getTime() - slotDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If slot is after due date, heavily penalize
  if (daysDiff < 0) {
    return {
      name,
      weight,
      value: 10,
      description: 'Slot is after due date - not recommended',
    };
  }

  // If slot is on due date
  if (daysDiff === 0) {
    return {
      name,
      weight,
      value: 95,
      description: 'Slot is on due date - urgent',
    };
  }

  // Calculate score based on days remaining and priority
  let baseScore: number;
  if (daysDiff <= 1) {
    baseScore = 90;
  } else if (daysDiff <= 3) {
    baseScore = 80;
  } else if (daysDiff <= 7) {
    baseScore = 60;
  } else {
    baseScore = 40;
  }

  // Priority multiplier
  const priorityMultiplier =
    priority === 'high' ? 1.2 : priority === 'medium' ? 1.0 : 0.8;

  const value = Math.min(100, Math.round(baseScore * priorityMultiplier));

  return {
    name,
    weight,
    value,
    description: `${daysDiff} day(s) before due date (${priority} priority)`,
  };
}

/**
 * Score a slot based on buffer availability
 * Higher scores for slots with enough buffer time before and after
 *
 * @param slot - The time slot to score
 * @param bufferBefore - Required buffer minutes before the task
 * @param bufferAfter - Required buffer minutes after the task
 * @param availability - The availability window containing this slot
 * @param weight - Weight for this factor (default from DEFAULT_WEIGHTS)
 * @returns ScoringFactor with the score and description
 */
export function scoreBufferAvailability(
  slot: TimeSlot,
  bufferBefore: number,
  bufferAfter: number,
  availability: SchedulingAvailabilityWindow,
  weight: number = DEFAULT_WEIGHTS.bufferAvailability
): ScoringFactor {
  const name = 'bufferAvailability';

  // If no buffers needed, perfect score
  if (bufferBefore === 0 && bufferAfter === 0) {
    return {
      name,
      weight,
      value: 100,
      description: 'No buffer required',
    };
  }

  // Find the available slot that contains this time slot
  const containingSlot = availability.slots.find(
    (availSlot) =>
      availSlot.available &&
      availSlot.start.getTime() <= slot.start.getTime() &&
      availSlot.end.getTime() >= slot.end.getTime()
  );

  if (!containingSlot) {
    return {
      name,
      weight,
      value: 0,
      description: 'Slot not in available period',
    };
  }

  // Calculate available buffer times
  const availableBufferBefore = (slot.start.getTime() - containingSlot.start.getTime()) / (1000 * 60);
  const availableBufferAfter = (containingSlot.end.getTime() - slot.end.getTime()) / (1000 * 60);

  // Calculate how much of the required buffer is available
  const bufferBeforePct = bufferBefore > 0
    ? Math.min(100, (availableBufferBefore / bufferBefore) * 100)
    : 100;
  const bufferAfterPct = bufferAfter > 0
    ? Math.min(100, (availableBufferAfter / bufferAfter) * 100)
    : 100;

  // Average of both buffer satisfactions
  const value = Math.round((bufferBeforePct + bufferAfterPct) / 2);

  let description: string;
  if (value === 100) {
    description = `Full buffer available: ${bufferBefore}min before, ${bufferAfter}min after`;
  } else if (value >= 50) {
    description = `Partial buffer: ${Math.round(availableBufferBefore)}/${bufferBefore}min before, ${Math.round(availableBufferAfter)}/${bufferAfter}min after`;
  } else {
    description = 'Insufficient buffer time available';
  }

  return {
    name,
    weight,
    value,
    description,
  };
}

/**
 * Score a slot based on contiguous free time
 * Higher scores for slots within larger blocks of free time
 *
 * @param slot - The time slot to score
 * @param availability - The availability window containing this slot
 * @param taskDuration - The duration of the task in minutes
 * @param weight - Weight for this factor (default from DEFAULT_WEIGHTS)
 * @returns ScoringFactor with the score and description
 */
export function scoreContiguousTime(
  slot: TimeSlot,
  availability: SchedulingAvailabilityWindow,
  taskDuration: number,
  weight: number = DEFAULT_WEIGHTS.contiguousTime
): ScoringFactor {
  const name = 'contiguousTime';

  // Find the available slot that contains this time slot
  const containingSlot = availability.slots.find(
    (availSlot) =>
      availSlot.available &&
      availSlot.start.getTime() <= slot.start.getTime() &&
      availSlot.end.getTime() >= slot.end.getTime()
  );

  if (!containingSlot) {
    return {
      name,
      weight,
      value: 0,
      description: 'Slot not in available period',
    };
  }

  // Calculate the size of the contiguous block
  const blockDuration =
    (containingSlot.end.getTime() - containingSlot.start.getTime()) / (1000 * 60);

  // Ratio of block to task duration
  const ratio = blockDuration / taskDuration;

  let value: number;
  let description: string;

  if (ratio >= 3) {
    value = 100;
    description = `Large contiguous block (${Math.round(blockDuration)} min) - plenty of flexibility`;
  } else if (ratio >= 2) {
    value = 85;
    description = `Good contiguous block (${Math.round(blockDuration)} min) - some flexibility`;
  } else if (ratio >= 1.5) {
    value = 70;
    description = `Moderate contiguous block (${Math.round(blockDuration)} min)`;
  } else if (ratio >= 1) {
    value = 50;
    description = `Tight fit - block is ${Math.round(blockDuration)} min for ${taskDuration} min task`;
  } else {
    value = 0;
    description = 'Block too small for task';
  }

  return {
    name,
    weight,
    value,
    description,
  };
}

/**
 * Score a slot based on priority alignment
 * High-priority tasks get better scores for morning slots (prime productive hours)
 *
 * @param slot - The time slot to score
 * @param priority - The priority of the task
 * @param weight - Weight for this factor (default from DEFAULT_WEIGHTS)
 * @returns ScoringFactor with the score and description
 */
export function scorePriorityAlignment(
  slot: TimeSlot,
  priority: Priority,
  weight: number = DEFAULT_WEIGHTS.priorityAlignment
): ScoringFactor {
  const name = 'priorityAlignment';
  const hour = getHour(slot.start);

  // Define prime hours (morning for high priority work)
  const isPrimeTime = hour >= 9 && hour < 12;
  const isGoodTime = hour >= 8 && hour < 14;

  if (priority === 'high') {
    if (isPrimeTime) {
      return {
        name,
        weight,
        value: 100,
        description: 'High priority task in prime morning hours (9am-12pm)',
      };
    }
    if (isGoodTime) {
      return {
        name,
        weight,
        value: 70,
        description: 'High priority task in good hours',
      };
    }
    return {
      name,
      weight,
      value: 40,
      description: 'High priority task outside optimal hours',
    };
  }

  if (priority === 'medium') {
    // Medium priority is flexible
    return {
      name,
      weight,
      value: 70,
      description: 'Medium priority task - time flexible',
    };
  }

  // Low priority - slightly prefer non-prime times to leave prime for high-pri
  if (isPrimeTime) {
    return {
      name,
      weight,
      value: 50,
      description: 'Low priority task - consider saving prime hours for high-pri',
    };
  }

  return {
    name,
    weight,
    value: 80,
    description: 'Low priority task in appropriate time slot',
  };
}

/**
 * Score a slot based on preferred time of day
 * Matches user preference for morning/afternoon/evening
 *
 * @param slot - The time slot to score
 * @param preferredTime - User's preferred time of day (null means no preference)
 * @param weight - Weight for this factor (default from DEFAULT_WEIGHTS)
 * @returns ScoringFactor with the score and description
 */
export function scoreTimeOfDay(
  slot: TimeSlot,
  preferredTime: 'morning' | 'afternoon' | 'evening' | null,
  weight: number = DEFAULT_WEIGHTS.timeOfDay
): ScoringFactor {
  const name = 'timeOfDay';

  // If no preference, return neutral score
  if (!preferredTime) {
    return {
      name,
      weight,
      value: 70,
      description: 'No time preference specified',
    };
  }

  const hour = getHour(slot.start);
  const slotCategory = getTimeOfDayCategory(hour);

  if (slotCategory === preferredTime) {
    return {
      name,
      weight,
      value: 100,
      description: `Matches preferred time: ${preferredTime}`,
    };
  }

  // Adjacent time periods get partial score
  const adjacentMap: Record<string, string[]> = {
    morning: ['afternoon'],
    afternoon: ['morning', 'evening'],
    evening: ['afternoon'],
  };

  if (adjacentMap[preferredTime].includes(slotCategory)) {
    return {
      name,
      weight,
      value: 60,
      description: `Close to preferred time (${preferredTime}), actual: ${slotCategory}`,
    };
  }

  return {
    name,
    weight,
    value: 30,
    description: `Far from preferred time (${preferredTime}), actual: ${slotCategory}`,
  };
}

/**
 * Combine all scoring factors into a final score
 * Uses weighted average calculation
 *
 * @param factors - Array of scoring factors
 * @returns Total score (0-100)
 */
export function calculateTotalScore(factors: ScoringFactor[]): number {
  if (factors.length === 0) return 0;

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = factors.reduce((sum, f) => sum + f.value * f.weight, 0);

  return Math.round(weightedSum / totalWeight);
}

/**
 * Generate a human-readable reasoning string from scoring factors
 *
 * @param factors - Array of scoring factors
 * @returns Human-readable reasoning string
 */
export function generateReasoning(factors: ScoringFactor[]): string {
  // Sort factors by weighted contribution (value * weight)
  const sortedFactors = [...factors].sort(
    (a, b) => b.value * b.weight - a.value * a.weight
  );

  // Get top positive and negative factors
  const positiveFactors = sortedFactors.filter((f) => f.value >= 70);
  const negativeFactors = sortedFactors.filter((f) => f.value < 50);

  const parts: string[] = [];

  if (positiveFactors.length > 0) {
    const topPositive = positiveFactors.slice(0, 2);
    parts.push(topPositive.map((f) => f.description).join('; '));
  }

  if (negativeFactors.length > 0) {
    const topNegative = negativeFactors.slice(0, 1);
    parts.push(`Note: ${topNegative.map((f) => f.description).join('; ')}`);
  }

  return parts.join('. ') || 'Standard slot selection';
}

/**
 * Score a slot with all factors
 *
 * @param slot - The time slot to score
 * @param context - Context for scoring (task, rules, availability)
 * @returns Complete scoring result
 */
export function scoreSlot(
  slot: TimeSlot,
  context: {
    task: Task;
    rules: SchedulingRule[];
    availability: SchedulingAvailabilityWindow;
    preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | null;
  }
): ScoringResult {
  const { task, rules, availability, preferredTimeOfDay } = context;

  // Get effective duration
  const taskDuration = task.timeEstimate || 60;

  // Get effective buffers
  const bufferBefore = task.bufferBefore || 0;
  const bufferAfter = task.bufferAfter || 0;

  // Parse due date
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  // Calculate all factors
  const factors: ScoringFactor[] = [
    scoreTaskTypePreference(slot, task.taskType, rules),
    scoreDueDateProximity(slot, dueDate, task.priority),
    scoreBufferAvailability(slot, bufferBefore, bufferAfter, availability),
    scoreContiguousTime(slot, availability, taskDuration),
    scorePriorityAlignment(slot, task.priority),
    scoreTimeOfDay(slot, preferredTimeOfDay || null),
  ];

  const totalScore = calculateTotalScore(factors);
  const reasoning = generateReasoning(factors);

  return {
    totalScore,
    factors,
    reasoning,
  };
}
