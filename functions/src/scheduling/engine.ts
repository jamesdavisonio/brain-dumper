/**
 * Core scheduling engine for finding optimal time slots
 * Orchestrates scoring, rules, and protected slot handling
 * @module scheduling/engine
 */

import type {
  Task,
  SchedulingRule,
  ProtectedSlot,
  ScheduledTask,
  UserSchedulingPreferences,
  Priority,
} from '../types';
import {
  scoreSlot,
  ScoringFactor,
  ScoringResult,
} from './scoring';
import { getEffectiveRules, slotSatisfiesRules } from './rules';
import {
  isProtectedTime,
  canOverrideProtected,
  getProtectedConflicts,
  isUrgentTask,
} from './protected';

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
 * Contains available time slots for a specific date
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
 * Context for the scheduling engine
 */
export interface SchedulingContext {
  /** User ID for context */
  userId: string;
  /** The task to be scheduled */
  task: Task;
  /** Available time windows from calendar */
  availability: SchedulingAvailabilityWindow[];
  /** Tasks already scheduled on the calendar */
  existingScheduledTasks: ScheduledTask[];
  /** Scheduling rules (user and default) */
  rules: SchedulingRule[];
  /** Protected time slots */
  protectedSlots: ProtectedSlot[];
  /** User's scheduling preferences */
  preferences: UserSchedulingPreferences;
}

/**
 * A scheduling suggestion with scoring information
 */
export interface SchedulingSuggestion {
  /** The suggested time slot */
  slot: TimeSlot;
  /** Overall score for this suggestion (0-100) */
  score: number;
  /** Human-readable explanation of why this slot was suggested */
  reasoning: string;
  /** Individual factors that contributed to the score */
  factors: ScoringFactor[];
  /** Any conflicts or warnings for this suggestion */
  conflicts: Conflict[];
  /** Potential displacements if this slot is used */
  displacements: Displacement[];
}

/**
 * Represents a conflict with a scheduling suggestion
 */
export interface Conflict {
  /** Type of conflict */
  type: 'overlap' | 'buffer' | 'rule_violation' | 'protected_slot' | 'outside_hours';
  /** Human-readable description of the conflict */
  description: string;
  /** Severity of the conflict */
  severity: 'info' | 'warning' | 'error';
  /** Suggested resolution for the conflict */
  resolution?: string;
  /** ID of the conflicting event, if applicable */
  conflictingEventId?: string;
}

/**
 * Represents a potential displacement if a slot is used
 */
export interface Displacement {
  /** ID of the task that would be displaced */
  taskId: string;
  /** Name/content of the task that would be displaced */
  taskContent: string;
  /** Priority of the displaced task */
  priority: Priority;
  /** Whether this displacement is recommended (current task higher priority) */
  recommended: boolean;
  /** Reason for displacement recommendation */
  reason: string;
}

/**
 * Candidate slot with scoring information
 */
interface CandidateSlot {
  slot: TimeSlot;
  scoringResult: ScoringResult;
  conflicts: Conflict[];
  displacements: Displacement[];
}

/**
 * The main scheduling engine class
 */
export class SchedulingEngine {
  private context: SchedulingContext;
  private effectiveRules: SchedulingRule;

  constructor(context: SchedulingContext) {
    this.context = context;
    this.effectiveRules = getEffectiveRules(context.task, context.rules);
  }

  /**
   * Find the best slots for the task
   *
   * @param count - Number of suggestions to return (default: 5)
   * @returns Array of scheduling suggestions sorted by score
   */
  async findBestSlots(count: number = 5): Promise<SchedulingSuggestion[]> {
    const { task, availability } = this.context;

    // 1. Generate candidate slots from availability
    const candidateSlots = this.generateCandidateSlots(availability, task);

    if (candidateSlots.length === 0) {
      return [];
    }

    // 2. Filter by task rules (time preferences, working days)
    const ruleFilteredSlots = this.filterByRules(candidateSlots);

    // 3. Filter out protected slots (unless urgent task can override)
    const protectedFilteredSlots = this.filterProtectedSlots(ruleFilteredSlots);

    // 4. Score remaining slots
    const scoredSlots = this.scoreSlots(protectedFilteredSlots);

    // 5. Check for conflicts and potential displacements
    const slotsWithConflicts = this.checkConflictsAndDisplacements(scoredSlots);

    // 6. Sort by score and return top N
    const sortedSlots = slotsWithConflicts.sort(
      (a, b) => b.scoringResult.totalScore - a.scoringResult.totalScore
    );

    // Convert to suggestions
    return sortedSlots.slice(0, count).map((candidate) => ({
      slot: candidate.slot,
      score: candidate.scoringResult.totalScore,
      reasoning: candidate.scoringResult.reasoning,
      factors: candidate.scoringResult.factors,
      conflicts: candidate.conflicts,
      displacements: candidate.displacements,
    }));
  }

  /**
   * Generate candidate time slots from availability windows
   */
  private generateCandidateSlots(
    availability: SchedulingAvailabilityWindow[],
    task: Task
  ): TimeSlot[] {
    const candidates: TimeSlot[] = [];
    const taskDuration = task.timeEstimate || this.effectiveRules.defaultDuration;
    const bufferBefore = task.bufferBefore ?? this.effectiveRules.bufferBefore;
    const bufferAfter = task.bufferAfter ?? this.effectiveRules.bufferAfter;
    const totalDuration = taskDuration + bufferBefore + bufferAfter;

    for (const window of availability) {
      // Process each available slot in the window
      for (const availSlot of window.slots) {
        if (!availSlot.available) continue;

        const slotDuration =
          (availSlot.end.getTime() - availSlot.start.getTime()) / (1000 * 60);

        // Skip if slot is too short
        if (slotDuration < totalDuration) continue;

        // Generate potential start times within this available slot
        // Use 15-minute intervals for granularity
        const interval = 15;
        let currentStart = new Date(availSlot.start.getTime() + bufferBefore * 60 * 1000);

        while (true) {
          const currentEnd = new Date(currentStart.getTime() + taskDuration * 60 * 1000);
          const endWithBuffer = new Date(currentEnd.getTime() + bufferAfter * 60 * 1000);

          // Check if we've exceeded the available slot
          if (endWithBuffer > availSlot.end) break;

          candidates.push({
            start: new Date(currentStart),
            end: new Date(currentEnd),
            available: true,
          });

          // Move to next interval
          currentStart = new Date(currentStart.getTime() + interval * 60 * 1000);
        }
      }
    }

    return candidates;
  }

  /**
   * Filter slots by scheduling rules
   */
  private filterByRules(slots: TimeSlot[]): TimeSlot[] {
    // In flexible mode, we keep all slots but prefer ones that match rules
    // Scoring will handle preference
    return slots.filter((slot) => {
      const result = slotSatisfiesRules(slot, this.effectiveRules);
      // Keep slots that at least partially match (>= 33%)
      return result.partialScore >= 33;
    });
  }

  /**
   * Filter out protected slots
   */
  private filterProtectedSlots(slots: TimeSlot[]): TimeSlot[] {
    const { task, protectedSlots, preferences } = this.context;
    const isUrgent = isUrgentTask(task);

    return slots.filter((slot) => {
      const result = isProtectedTime(slot, protectedSlots, preferences.timezone);

      // If not protected, keep the slot
      if (!result.protected) return true;

      // If protected but task can override, keep the slot (with warning)
      if (result.slot && isUrgent && canOverrideProtected(task, result.slot)) {
        return true;
      }

      // Protected and cannot override, filter out
      return false;
    });
  }

  /**
   * Score all candidate slots
   */
  private scoreSlots(slots: TimeSlot[]): CandidateSlot[] {
    const { task, rules, availability } = this.context;

    // Determine preferred time of day
    let preferredTime: 'morning' | 'afternoon' | 'evening' | null = null;
    if (task.scheduledTime) {
      const time = task.scheduledTime.toLowerCase();
      if (['morning', 'afternoon', 'evening'].includes(time)) {
        preferredTime = time as 'morning' | 'afternoon' | 'evening';
      }
    }

    return slots.map((slot) => {
      // Find the availability window containing this slot
      const containingWindow = availability.find((window) =>
        window.slots.some(
          (ws) =>
            ws.start.getTime() <= slot.start.getTime() &&
            ws.end.getTime() >= slot.end.getTime()
        )
      );

      const scoringResult = scoreSlot(slot, {
        task,
        rules,
        availability: containingWindow || availability[0],
        preferredTimeOfDay: preferredTime,
      });

      return {
        slot,
        scoringResult,
        conflicts: [],
        displacements: [],
      };
    });
  }

  /**
   * Check for conflicts and potential displacements
   */
  private checkConflictsAndDisplacements(
    candidates: CandidateSlot[]
  ): CandidateSlot[] {
    const { task, existingScheduledTasks, protectedSlots, preferences } = this.context;

    return candidates.map((candidate) => {
      const conflicts: Conflict[] = [];
      const displacements: Displacement[] = [];

      // Check for protected slot conflicts (with warnings for override)
      const protectedConflicts = getProtectedConflicts(
        candidate.slot,
        protectedSlots,
        task,
        preferences.timezone
      );
      conflicts.push(...protectedConflicts);

      // Check for rule violations
      const ruleResult = slotSatisfiesRules(candidate.slot, this.effectiveRules);
      if (!ruleResult.satisfies) {
        conflicts.push({
          type: 'rule_violation',
          description: ruleResult.violations.join('; '),
          severity: 'info',
          resolution: 'Slot is outside preferred parameters but still usable',
        });
      }

      // Check for overlaps with existing scheduled tasks
      for (const scheduled of existingScheduledTasks) {
        const scheduledStart = new Date(scheduled.scheduledStart);
        const scheduledEnd = new Date(scheduled.scheduledEnd);

        // Check for overlap
        if (
          candidate.slot.start < scheduledEnd &&
          candidate.slot.end > scheduledStart
        ) {
          const displacement = this.checkDisplacement(
            candidate.slot,
            scheduled
          );
          if (displacement) {
            displacements.push(displacement);
          }
        }
      }

      return {
        ...candidate,
        conflicts,
        displacements,
      };
    });
  }

  /**
   * Check if scheduling would displace an existing task
   */
  private checkDisplacement(
    slot: TimeSlot,
    scheduledTask: ScheduledTask
  ): Displacement | null {
    const { task } = this.context;

    // Get priority comparison
    const currentPriority = task.priority;

    // We don't have the full Task object for scheduled tasks,
    // so we need to look it up or make assumptions
    // For now, assume medium priority for existing tasks unless we have more info
    const existingPriority: Priority = 'medium';

    const priorityOrder: Record<Priority, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const shouldDisplace =
      priorityOrder[currentPriority] > priorityOrder[existingPriority];

    return {
      taskId: scheduledTask.taskId,
      taskContent: `Task ${scheduledTask.taskId}`, // Would need to look up actual content
      priority: existingPriority,
      recommended: shouldDisplace,
      reason: shouldDisplace
        ? `Current task (${currentPriority} priority) has higher priority than existing task (${existingPriority} priority)`
        : `Existing task (${existingPriority} priority) has equal or higher priority than current task (${currentPriority} priority)`,
    };
  }

  /**
   * Get the effective rules being used
   */
  getEffectiveRules(): SchedulingRule {
    return this.effectiveRules;
  }

  /**
   * Score a single slot (public method for testing)
   */
  scoreSlot(slot: TimeSlot): ScoringResult {
    const { task, rules, availability } = this.context;

    const containingWindow = availability.find((window) =>
      window.slots.some(
        (ws) =>
          ws.start.getTime() <= slot.start.getTime() &&
          ws.end.getTime() >= slot.end.getTime()
      )
    );

    return scoreSlot(slot, {
      task,
      rules,
      availability: containingWindow || availability[0],
    });
  }

  /**
   * Check displacements for a slot (public method)
   */
  checkDisplacements(slot: TimeSlot): Displacement[] {
    const { existingScheduledTasks } = this.context;
    const displacements: Displacement[] = [];

    for (const scheduled of existingScheduledTasks) {
      const scheduledStart = new Date(scheduled.scheduledStart);
      const scheduledEnd = new Date(scheduled.scheduledEnd);

      // Check for overlap
      if (slot.start < scheduledEnd && slot.end > scheduledStart) {
        const displacement = this.checkDisplacement(slot, scheduled);
        if (displacement) {
          displacements.push(displacement);
        }
      }
    }

    return displacements;
  }
}

/**
 * Create a scheduling engine instance
 *
 * @param context - The scheduling context
 * @returns SchedulingEngine instance
 */
export function createSchedulingEngine(
  context: SchedulingContext
): SchedulingEngine {
  return new SchedulingEngine(context);
}
