/**
 * Scheduling module exports
 * @module scheduling
 */

// Core engine
export {
  SchedulingEngine,
  createSchedulingEngine,
  type SchedulingContext,
  type SchedulingSuggestion,
  type Conflict,
  type Displacement,
  type TimeSlot,
  type SchedulingAvailabilityWindow,
} from './engine';

// Scoring
export {
  scoreSlot,
  scoreTaskTypePreference,
  scoreDueDateProximity,
  scoreBufferAvailability,
  scoreContiguousTime,
  scorePriorityAlignment,
  scoreTimeOfDay,
  calculateTotalScore,
  generateReasoning,
  DEFAULT_WEIGHTS,
  type ScoringFactor,
  type ScoringResult,
} from './scoring';

// Rules
export {
  DEFAULT_TASK_TYPE_RULES,
  getDefaultRule,
  getEffectiveRules,
  slotSatisfiesRules,
  filterSlotsByRules,
  sortSlotsByRuleMatch,
  getTotalDurationWithBuffers,
  inferTaskType,
  getTaskType,
  type RuleSatisfactionResult,
} from './rules';

// Protected slots
export {
  DEFAULT_ADHOC_SLOT,
  DEFAULT_LUNCH_SLOT,
  getDefaultProtectedSlots,
  isProtectedTime,
  getProtectedTimes,
  canOverrideProtected,
  filterProtectedSlots,
  getProtectedConflicts,
  isUrgentTask,
  type ProtectedCheckResult,
  type ProtectedTimeInstance,
} from './protected';

// Batch scheduling
export {
  scheduleBatch,
  validateBatchOptions,
  estimateBatchDuration,
  checkAvailabilitySufficiency,
  type BatchScheduleOptions,
  type BatchScheduleResult,
  type BatchScheduledTask,
  type BatchConflict,
  type UnschedulableTask,
} from './batch';

// Cloud Functions - Suggestions
export { getSuggestions, getBatchSuggestions } from './getSuggestions';

// ============================================================
// Calendar Event Building & Scheduling
// ============================================================

// Event Builder
export {
  buildTaskEvent,
  buildBufferEvent,
  isBrainDumperEvent,
  isBufferEvent,
  getBrainDumperMetadata,
  updateEventTimes,
  calculateBufferSlots,
  BRAIN_DUMPER_KEYS,
  BRAIN_DUMPER_EVENT_VERSION,
  type BuildEventOptions,
} from './eventBuilder';

// Conflict Detection
export {
  checkConflicts,
  findConflicts,
  findBestSlot,
  canDisplaceExisting,
  comparePriorities,
  canDisplaceByPriority,
  slotsOverlap,
  getBrainDumperEvents,
  isWithinWorkingHours,
} from './conflicts';

// Proposal Storage
export {
  storeProposal,
  getProposal,
  deleteProposal,
  getPendingProposals,
  updateProposal,
  extendProposalExpiry,
  isProposalValid,
  cleanupUserExpiredProposals,
  cleanupExpiredProposals,
} from './proposalStorage';

// Cloud Functions - Schedule Management
export {
  proposeSchedule,
  proposeScheduleInternal,
} from './propose';

export {
  confirmSchedule,
  confirmScheduleInternal,
} from './confirm';

export {
  scheduleTask,
  scheduleTaskInternal,
} from './scheduleTask';

export {
  unscheduleTask,
  unscheduleTaskInternal,
  unscheduleTasksInternal,
} from './unschedule';

export {
  rescheduleTask,
  rescheduleTaskInternal,
} from './reschedule';
