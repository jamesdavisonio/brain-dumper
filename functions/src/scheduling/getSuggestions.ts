/**
 * Cloud Function for getting scheduling suggestions
 * Callable function that returns optimal time slots for a task
 * @module scheduling/getSuggestions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  SchedulingEngine,
  SchedulingContext,
  SchedulingSuggestion,
} from './engine';
import { getDefaultProtectedSlots } from './protected';
import type {
  Task,
  SchedulingRule,
  ProtectedSlot,
  ScheduledTask,
  UserSchedulingPreferences,
} from '../types';
import type { TimeSlot, SchedulingAvailabilityWindow } from './engine';

/**
 * Request parameters for getSuggestions
 */
interface GetSuggestionsRequest {
  /** ID of the task to get suggestions for */
  taskId: string;
  /** Number of suggestions to return (default: 5) */
  count?: number;
  /** Date range to search for slots */
  dateRange?: {
    start: string; // ISO string
    end: string; // ISO string
  };
}

/**
 * Response from getSuggestions
 */
interface GetSuggestionsResponse {
  /** Array of scheduling suggestions */
  suggestions: SchedulingSuggestion[];
  /** The task that was analyzed */
  task: Task;
  /** The effective rules applied */
  appliedRules: SchedulingRule;
  /** Metadata about the search */
  meta: {
    searchedDays: number;
    totalSlotsConsidered: number;
    timezone: string;
  };
}

/**
 * Default user preferences when none are set
 */
const DEFAULT_PREFERENCES: UserSchedulingPreferences = {
  defaultCalendarId: 'primary',
  workingHours: {
    start: '09:00',
    end: '17:00',
  },
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: 'UTC',
  autoScheduleEnabled: true,
  preferContiguousBlocks: true,
};

/**
 * Get scheduling suggestions for a task
 *
 * This is a Firebase Callable function that:
 * 1. Loads the task from Firestore
 * 2. Fetches user's availability from calendar
 * 3. Applies scheduling rules and preferences
 * 4. Returns scored suggestions
 */
export const getSuggestions = functions.https.onCall(
  async (
    data: GetSuggestionsRequest,
    context: functions.https.CallableContext
  ): Promise<GetSuggestionsResponse> => {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to get scheduling suggestions'
      );
    }

    const userId = context.auth.uid;
    const { taskId, count = 5, dateRange } = data;

    // Validate request
    if (!taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'taskId is required'
      );
    }

    const db = admin.firestore();

    try {
      // 1. Load the task
      const taskDoc = await db.collection('tasks').doc(taskId).get();

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `Task ${taskId} not found`
        );
      }

      const taskData = taskDoc.data();
      if (taskData?.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have access to this task'
        );
      }

      const task: Task = {
        id: taskDoc.id,
        ...taskData,
      } as Task;

      // 2. Load user preferences
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      const preferences: UserSchedulingPreferences = {
        ...DEFAULT_PREFERENCES,
        ...userData.schedulingPreferences,
      };

      // 3. Load scheduling rules
      const rulesSnapshot = await db
        .collection('schedulingRules')
        .where('userId', '==', userId)
        .where('enabled', '==', true)
        .get();

      const rules: SchedulingRule[] = rulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SchedulingRule[];

      // 4. Load protected slots
      const protectedSnapshot = await db
        .collection('protectedSlots')
        .where('userId', '==', userId)
        .where('enabled', '==', true)
        .get();

      let protectedSlots: ProtectedSlot[] = protectedSnapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      ) as ProtectedSlot[];

      // Add default protected slots if user has none
      if (protectedSlots.length === 0) {
        protectedSlots = getDefaultProtectedSlots(userId);
      }

      // 5. Calculate date range
      const now = new Date();
      const startDate = dateRange?.start
        ? new Date(dateRange.start)
        : new Date(now);
      const endDate = dateRange?.end
        ? new Date(dateRange.end)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

      // 6. Get availability (simplified - in production would call calendar API)
      const availability = await getAvailabilityForRange(
        userId,
        startDate,
        endDate,
        preferences,
        db
      );

      // 7. Load existing scheduled tasks
      const scheduledSnapshot = await db
        .collection('scheduledTasks')
        .where('userId', '==', userId)
        .where('scheduledStart', '>=', startDate.toISOString())
        .where('scheduledStart', '<=', endDate.toISOString())
        .get();

      const existingScheduledTasks: ScheduledTask[] = scheduledSnapshot.docs.map(
        (doc) => ({
          ...doc.data(),
        })
      ) as ScheduledTask[];

      // 8. Create scheduling context
      const schedulingContext: SchedulingContext = {
        userId,
        task,
        availability,
        existingScheduledTasks,
        rules,
        protectedSlots,
        preferences,
      };

      // 9. Create engine and get suggestions
      const engine = new SchedulingEngine(schedulingContext);
      const suggestions = await engine.findBestSlots(count);
      const appliedRules = engine.getEffectiveRules();

      // Calculate metadata
      const searchedDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const totalSlotsConsidered = availability.reduce(
        (sum, window) => sum + window.slots.length,
        0
      );

      return {
        suggestions,
        task,
        appliedRules,
        meta: {
          searchedDays,
          totalSlotsConsidered,
          timezone: preferences.timezone,
        },
      };
    } catch (error) {
      console.error('Error getting suggestions:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'An error occurred while getting scheduling suggestions'
      );
    }
  }
);

/**
 * Get availability for a date range
 * This is a simplified implementation - in production would use calendar API
 */
async function getAvailabilityForRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  preferences: UserSchedulingPreferences,
  db: FirebaseFirestore.Firestore
): Promise<SchedulingAvailabilityWindow[]> {
  const availability: SchedulingAvailabilityWindow[] = [];

  // Generate availability for each day in the range
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();

    // Skip non-working days
    if (!preferences.workingDays.includes(dayOfWeek)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Create availability window for this day
    const dayStart = createTimeOnDate(
      currentDate,
      preferences.workingHours.start
    );
    const dayEnd = createTimeOnDate(currentDate, preferences.workingHours.end);

    // Calculate working minutes
    const workingMinutes =
      (dayEnd.getTime() - dayStart.getTime()) / (1000 * 60);

    // Load calendar events for this day (if available)
    // In production, this would call the calendar service
    const busySlots = await getBusySlotsForDay(
      userId,
      currentDate,
      db,
      preferences.timezone
    );

    // Calculate free slots by subtracting busy periods
    const freeSlots = calculateFreeSlots(dayStart, dayEnd, busySlots);

    availability.push({
      date: new Date(currentDate),
      slots: freeSlots,
      totalFreeMinutes: freeSlots.reduce((sum, slot) => {
        if (!slot.available) return sum;
        return sum + (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
      }, 0),
      totalBusyMinutes:
        workingMinutes -
        freeSlots.reduce((sum, slot) => {
          if (!slot.available) return sum;
          return sum + (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
        }, 0),
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availability;
}

/**
 * Create a Date with specific time
 */
function createTimeOnDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Get busy slots for a specific day from calendar events
 */
async function getBusySlotsForDay(
  userId: string,
  date: Date,
  db: FirebaseFirestore.Firestore,
  timezone: string
): Promise<Array<{ start: Date; end: Date }>> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Query calendar events for this day
  const eventsSnapshot = await db
    .collection('calendarEvents')
    .where('userId', '==', userId)
    .where('start', '>=', dayStart.toISOString())
    .where('start', '<=', dayEnd.toISOString())
    .get();

  return eventsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      start: new Date(data.start),
      end: new Date(data.end),
    };
  });
}

/**
 * Calculate free time slots from working hours minus busy periods
 */
function calculateFreeSlots(
  dayStart: Date,
  dayEnd: Date,
  busySlots: Array<{ start: Date; end: Date }>
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Sort busy slots by start time
  const sortedBusy = [...busySlots].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  let currentStart = new Date(dayStart);

  for (const busy of sortedBusy) {
    // If there's a gap before this busy period, add a free slot
    if (busy.start > currentStart) {
      slots.push({
        start: new Date(currentStart),
        end: new Date(Math.min(busy.start.getTime(), dayEnd.getTime())),
        available: true,
      });
    }

    // Move current start to end of busy period
    currentStart = new Date(Math.max(currentStart.getTime(), busy.end.getTime()));
  }

  // Add remaining time after last busy period
  if (currentStart < dayEnd) {
    slots.push({
      start: new Date(currentStart),
      end: new Date(dayEnd),
      available: true,
    });
  }

  // If no busy slots, entire day is free
  if (sortedBusy.length === 0) {
    slots.push({
      start: new Date(dayStart),
      end: new Date(dayEnd),
      available: true,
    });
  }

  return slots;
}

/**
 * Batch get suggestions for multiple tasks
 */
export const getBatchSuggestions = functions.https.onCall(
  async (
    data: {
      taskIds: string[];
      count?: number;
      dateRange?: { start: string; end: string };
    },
    context: functions.https.CallableContext
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { taskIds, count = 3, dateRange } = data;

    if (!taskIds || taskIds.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'taskIds array is required'
      );
    }

    // Limit to prevent abuse
    if (taskIds.length > 20) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Maximum 20 tasks can be processed at once'
      );
    }

    // Get suggestions for each task
    const results: Record<string, SchedulingSuggestion[]> = {};

    for (const taskId of taskIds) {
      try {
        const response = await getSuggestions.run(
          { taskId, count, dateRange },
          context
        );
        results[taskId] = response.suggestions;
      } catch (error) {
        console.error(`Error getting suggestions for task ${taskId}:`, error);
        results[taskId] = [];
      }
    }

    return { results };
  }
);
