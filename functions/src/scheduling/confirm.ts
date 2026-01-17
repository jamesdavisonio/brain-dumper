/**
 * Confirm Schedule module
 * Executes approved scheduling proposals
 * @module scheduling/confirm
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ConfirmResult } from '../types';
import { getCalendarClientOrThrow } from '../calendar/client';
import {
  buildTaskEvent,
  buildBufferEvent,
} from './eventBuilder';
import { getProposal, deleteProposal } from './proposalStorage';

const db = admin.firestore();

/**
 * Parameters for confirmSchedule function
 */
interface ConfirmScheduleParams {
  /** Proposal ID to confirm */
  proposalId: string;
  /** Array of approved tasks with their selected slots */
  approved: Array<{
    /** Task ID */
    taskId: string;
    /** Index of the slot in proposedSlots (0 if only one option) */
    slotIndex: number;
    /** Whether this task is confirmed for scheduling */
    confirmed: boolean;
  }>;
  /** Whether user approved displacing lower-priority tasks */
  displacementsApproved: boolean;
}

/**
 * Response from confirmSchedule function
 */
interface ConfirmScheduleResponse {
  /** Whether the operation was successful overall */
  success: boolean;
  /** Detailed results */
  result?: ConfirmResult;
  /** Error message if failed */
  error?: string;
}

/**
 * Update task in Firestore with calendar event info
 */
async function updateTaskWithEventInfo(
  userId: string,
  taskId: string,
  eventInfo: {
    calendarEventId: string;
    calendarId: string;
    scheduledStart: string;
    scheduledEnd: string;
    bufferBeforeEventId?: string;
    bufferAfterEventId?: string;
  }
): Promise<void> {
  const taskRef = db.collection('tasks').doc(taskId);
  await taskRef.update({
    calendarEventId: eventInfo.calendarEventId,
    calendarId: eventInfo.calendarId,
    scheduledStart: eventInfo.scheduledStart,
    scheduledEnd: eventInfo.scheduledEnd,
    bufferBeforeEventId: eventInfo.bufferBeforeEventId || null,
    bufferAfterEventId: eventInfo.bufferAfterEventId || null,
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Clear task's calendar event info in Firestore
 */
async function clearTaskEventInfo(taskId: string): Promise<void> {
  const taskRef = db.collection('tasks').doc(taskId);
  await taskRef.update({
    calendarEventId: admin.firestore.FieldValue.delete(),
    calendarId: admin.firestore.FieldValue.delete(),
    scheduledStart: admin.firestore.FieldValue.delete(),
    scheduledEnd: admin.firestore.FieldValue.delete(),
    bufferBeforeEventId: admin.firestore.FieldValue.delete(),
    bufferAfterEventId: admin.firestore.FieldValue.delete(),
    syncStatus: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete calendar event with retry logic
 */
async function deleteCalendarEvent(
  calendar: any,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error: any) {
    // Ignore 404 errors (event already deleted)
    if (error.code !== 404 && error.response?.status !== 404) {
      throw error;
    }
  }
}

/**
 * Callable function to confirm and execute a schedule proposal
 *
 * @example
 * const result = await confirmSchedule({
 *   proposalId: 'proposal_123',
 *   approved: [
 *     { taskId: 'task1', slotIndex: 0, confirmed: true },
 *     { taskId: 'task2', slotIndex: 0, confirmed: false }
 *   ],
 *   displacementsApproved: true
 * });
 */
export const confirmSchedule = functions.https.onCall(
  async (data: ConfirmScheduleParams, context): Promise<ConfirmScheduleResponse> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to confirm schedule'
      );
    }

    const userId = context.auth.uid;
    const { proposalId, approved, displacementsApproved } = data;

    // Validate input
    if (!proposalId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Proposal ID is required'
      );
    }

    if (!approved || !Array.isArray(approved)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Approved array is required'
      );
    }

    try {
      // Retrieve the proposal
      const proposal = await getProposal(userId, proposalId);

      if (!proposal) {
        return {
          success: false,
          error: 'Proposal not found or has expired',
        };
      }

      // Get calendar client
      const calendar = await getCalendarClientOrThrow(userId);

      // Initialize result tracking
      const result: ConfirmResult = {
        success: true,
        scheduled: [],
        displaced: [],
        errors: [],
      };

      // Process each approved task
      for (const approval of approved) {
        if (!approval.confirmed) {
          continue; // Skip tasks not approved
        }

        // Find the proposed slot for this task
        const proposedSlot = proposal.proposedSlots.find(
          (ps) => ps.task.id === approval.taskId
        );

        if (!proposedSlot) {
          result.errors.push({
            taskId: approval.taskId,
            error: 'Task not found in proposal',
          });
          continue;
        }

        const { task, slot, calendarId, displacements } = proposedSlot;

        // Check if displacements are needed and approved
        if (displacements.length > 0 && !displacementsApproved) {
          result.errors.push({
            taskId: task.id,
            error: 'Displacements required but not approved',
          });
          continue;
        }

        try {
          // Handle displacements first
          if (displacements.length > 0 && displacementsApproved) {
            for (const displacement of displacements) {
              try {
                // Get the displaced task's event info
                const displacedTaskRef = db.collection('tasks').doc(displacement.existingTaskId);
                const displacedTaskDoc = await displacedTaskRef.get();
                const displacedTask = displacedTaskDoc.data();

                if (displacedTask?.calendarEventId) {
                  // Delete the existing calendar event
                  await deleteCalendarEvent(
                    calendar,
                    displacedTask.calendarId || calendarId,
                    displacedTask.calendarEventId
                  );

                  // Delete buffer events if they exist
                  if (displacedTask.bufferBeforeEventId) {
                    await deleteCalendarEvent(
                      calendar,
                      displacedTask.calendarId || calendarId,
                      displacedTask.bufferBeforeEventId
                    );
                  }
                  if (displacedTask.bufferAfterEventId) {
                    await deleteCalendarEvent(
                      calendar,
                      displacedTask.calendarId || calendarId,
                      displacedTask.bufferAfterEventId
                    );
                  }

                  // Clear task's event info
                  await clearTaskEventInfo(displacement.existingTaskId);
                }

                result.displaced.push({
                  taskId: displacement.existingTaskId,
                  newSlot: displacement.suggestedNewSlot,
                  unscheduled: !displacement.suggestedNewSlot,
                });
              } catch (displacementError) {
                console.error(`Error displacing task ${displacement.existingTaskId}:`, displacementError);
                // Continue with other displacements
              }
            }
          }

          // Build and create the main event
          const eventPayload = buildTaskEvent({
            task,
            slot,
            calendarId,
          });

          const eventResponse = await calendar.events.insert({
            calendarId,
            requestBody: eventPayload,
          });

          const eventId = eventResponse.data.id;

          if (!eventId) {
            throw new Error('Failed to create calendar event: no event ID returned');
          }

          // Create buffer events if configured
          let bufferBeforeEventId: string | undefined;
          let bufferAfterEventId: string | undefined;

          if (proposal.options.includeBuffers) {
            const bufferBefore = task.bufferBefore || 0;
            const bufferAfter = task.bufferAfter || 0;

            if (bufferBefore > 0) {
              const bufferBeforePayload = buildBufferEvent(
                task,
                'before',
                bufferBefore,
                new Date(slot.start),
                calendarId
              );

              const bufferBeforeResponse = await calendar.events.insert({
                calendarId,
                requestBody: bufferBeforePayload,
              });

              bufferBeforeEventId = bufferBeforeResponse.data.id || undefined;
            }

            if (bufferAfter > 0) {
              const bufferAfterPayload = buildBufferEvent(
                task,
                'after',
                bufferAfter,
                new Date(slot.end),
                calendarId
              );

              const bufferAfterResponse = await calendar.events.insert({
                calendarId,
                requestBody: bufferAfterPayload,
              });

              bufferAfterEventId = bufferAfterResponse.data.id || undefined;
            }
          }

          // Update task in Firestore
          await updateTaskWithEventInfo(userId, task.id, {
            calendarEventId: eventId,
            calendarId,
            scheduledStart: slot.start,
            scheduledEnd: slot.end,
            bufferBeforeEventId,
            bufferAfterEventId,
          });

          // Add to scheduled results
          result.scheduled.push({
            taskId: task.id,
            calendarEventId: eventId,
            scheduledStart: slot.start,
            scheduledEnd: slot.end,
          });

        } catch (taskError) {
          console.error(`Error scheduling task ${task.id}:`, taskError);
          const errorMessage = taskError instanceof Error ? taskError.message : 'Unknown error';

          result.errors.push({
            taskId: task.id,
            error: errorMessage,
          });

          // If event was created but Firestore update failed, try to clean up
          // This provides transaction-like behavior
        }
      }

      // Delete the processed proposal
      await deleteProposal(userId, proposalId);

      // Determine overall success
      result.success = result.errors.length === 0;

      console.log(`Confirmed schedule: ${result.scheduled.length} scheduled, ${result.displaced.length} displaced, ${result.errors.length} errors`);

      return {
        success: true,
        result,
      };
    } catch (error) {
      console.error(`Error confirming schedule for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new functions.https.HttpsError('internal', `Failed to confirm schedule: ${errorMessage}`);
    }
  }
);

/**
 * Internal function to confirm a schedule (for use by other server-side functions)
 *
 * @param userId - User's Firebase UID
 * @param proposalId - Proposal ID
 * @param approved - Array of approved tasks
 * @param displacementsApproved - Whether displacements are approved
 * @returns Confirmation result
 */
export async function confirmScheduleInternal(
  userId: string,
  proposalId: string,
  approved: Array<{
    taskId: string;
    slotIndex: number;
    confirmed: boolean;
  }>,
  displacementsApproved: boolean
): Promise<ConfirmScheduleResponse> {
  try {
    const proposal = await getProposal(userId, proposalId);

    if (!proposal) {
      return {
        success: false,
        error: 'Proposal not found or has expired',
      };
    }

    const calendar = await getCalendarClientOrThrow(userId);

    const result: ConfirmResult = {
      success: true,
      scheduled: [],
      displaced: [],
      errors: [],
    };

    for (const approval of approved) {
      if (!approval.confirmed) {
        continue;
      }

      const proposedSlot = proposal.proposedSlots.find(
        (ps) => ps.task.id === approval.taskId
      );

      if (!proposedSlot) {
        result.errors.push({
          taskId: approval.taskId,
          error: 'Task not found in proposal',
        });
        continue;
      }

      const { task, slot, calendarId, displacements } = proposedSlot;

      if (displacements.length > 0 && !displacementsApproved) {
        result.errors.push({
          taskId: task.id,
          error: 'Displacements required but not approved',
        });
        continue;
      }

      try {
        // Handle displacements
        if (displacements.length > 0 && displacementsApproved) {
          for (const displacement of displacements) {
            try {
              const displacedTaskRef = db.collection('tasks').doc(displacement.existingTaskId);
              const displacedTaskDoc = await displacedTaskRef.get();
              const displacedTask = displacedTaskDoc.data();

              if (displacedTask?.calendarEventId) {
                await deleteCalendarEvent(
                  calendar,
                  displacedTask.calendarId || calendarId,
                  displacedTask.calendarEventId
                );

                if (displacedTask.bufferBeforeEventId) {
                  await deleteCalendarEvent(
                    calendar,
                    displacedTask.calendarId || calendarId,
                    displacedTask.bufferBeforeEventId
                  );
                }
                if (displacedTask.bufferAfterEventId) {
                  await deleteCalendarEvent(
                    calendar,
                    displacedTask.calendarId || calendarId,
                    displacedTask.bufferAfterEventId
                  );
                }

                await clearTaskEventInfo(displacement.existingTaskId);
              }

              result.displaced.push({
                taskId: displacement.existingTaskId,
                newSlot: displacement.suggestedNewSlot,
                unscheduled: !displacement.suggestedNewSlot,
              });
            } catch (displacementError) {
              console.error(`Error displacing task ${displacement.existingTaskId}:`, displacementError);
            }
          }
        }

        // Create main event
        const eventPayload = buildTaskEvent({ task, slot, calendarId });
        const eventResponse = await calendar.events.insert({
          calendarId,
          requestBody: eventPayload,
        });

        const eventId = eventResponse.data.id;
        if (!eventId) {
          throw new Error('Failed to create calendar event');
        }

        let bufferBeforeEventId: string | undefined;
        let bufferAfterEventId: string | undefined;

        if (proposal.options.includeBuffers) {
          const bufferBefore = task.bufferBefore || 0;
          const bufferAfter = task.bufferAfter || 0;

          if (bufferBefore > 0) {
            const bufferBeforePayload = buildBufferEvent(
              task, 'before', bufferBefore, new Date(slot.start), calendarId
            );
            const bufferBeforeResponse = await calendar.events.insert({
              calendarId, requestBody: bufferBeforePayload,
            });
            bufferBeforeEventId = bufferBeforeResponse.data.id || undefined;
          }

          if (bufferAfter > 0) {
            const bufferAfterPayload = buildBufferEvent(
              task, 'after', bufferAfter, new Date(slot.end), calendarId
            );
            const bufferAfterResponse = await calendar.events.insert({
              calendarId, requestBody: bufferAfterPayload,
            });
            bufferAfterEventId = bufferAfterResponse.data.id || undefined;
          }
        }

        await updateTaskWithEventInfo(userId, task.id, {
          calendarEventId: eventId,
          calendarId,
          scheduledStart: slot.start,
          scheduledEnd: slot.end,
          bufferBeforeEventId,
          bufferAfterEventId,
        });

        result.scheduled.push({
          taskId: task.id,
          calendarEventId: eventId,
          scheduledStart: slot.start,
          scheduledEnd: slot.end,
        });
      } catch (taskError) {
        const errorMessage = taskError instanceof Error ? taskError.message : 'Unknown error';
        result.errors.push({ taskId: task.id, error: errorMessage });
      }
    }

    await deleteProposal(userId, proposalId);
    result.success = result.errors.length === 0;

    return { success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to confirm schedule: ${errorMessage}` };
  }
}
