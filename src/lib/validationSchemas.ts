/**
 * Zod validation schemas for calendar and scheduling types
 * @module lib/validationSchemas
 */

import { z } from 'zod'
import type { TaskType } from '../types'

/**
 * Schema for validating time strings in "HH:mm" format (24-hour)
 * Examples: "09:00", "14:30", "23:59"
 */
export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in "HH:mm" format (24-hour)',
  })

/**
 * Array of valid task types
 */
export const TASK_TYPES = [
  'deep_work',
  'coding',
  'call',
  'meeting',
  'personal',
  'admin',
  'health',
  'other',
] as const

/**
 * Schema for task type validation
 */
export const taskTypeSchema = z.enum(TASK_TYPES)

/**
 * Schema for day of week (0 = Sunday, 6 = Saturday)
 */
export const dayOfWeekSchema = z.number().int().min(0).max(6)

/**
 * Schema for preferred time range
 */
export const preferredTimeRangeSchema = z
  .object({
    start: timeStringSchema,
    end: timeStringSchema,
  })
  .refine(
    (data) => {
      // Ensure start is before end
      return data.start < data.end
    },
    {
      message: 'Start time must be before end time',
    }
  )

/**
 * Schema for creating/updating a scheduling rule
 */
export const schedulingRuleSchema = z.object({
  taskType: taskTypeSchema,
  enabled: z.boolean().default(true),
  preferredTimeRange: preferredTimeRangeSchema,
  preferredDays: z
    .array(dayOfWeekSchema)
    .min(1, { message: 'At least one preferred day is required' })
    .max(7),
  defaultDuration: z
    .number()
    .int()
    .min(5, { message: 'Minimum duration is 5 minutes' })
    .max(480, { message: 'Maximum duration is 8 hours (480 minutes)' }),
  bufferBefore: z
    .number()
    .int()
    .min(0, { message: 'Buffer cannot be negative' })
    .max(60, { message: 'Maximum buffer is 60 minutes' }),
  bufferAfter: z
    .number()
    .int()
    .min(0, { message: 'Buffer cannot be negative' })
    .max(60, { message: 'Maximum buffer is 60 minutes' }),
  calendarId: z.string().optional(),
})

/**
 * Full scheduling rule schema including system fields
 */
export const fullSchedulingRuleSchema = schedulingRuleSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
})

/**
 * Schema for recurrence configuration in protected slots
 */
export const protectedSlotRecurrenceSchema = z
  .object({
    daysOfWeek: z
      .array(dayOfWeekSchema)
      .min(1, { message: 'At least one day of week is required' })
      .max(7),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
  })
  .refine(
    (data) => {
      return data.startTime < data.endTime
    },
    {
      message: 'Start time must be before end time',
    }
  )

/**
 * Schema for creating/updating a protected slot
 */
export const protectedSlotSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name must be 100 characters or less' }),
  enabled: z.boolean().default(true),
  recurrence: protectedSlotRecurrenceSchema,
  allowOverrideForUrgent: z.boolean().default(false),
})

/**
 * Full protected slot schema including system fields
 */
export const fullProtectedSlotSchema = protectedSlotSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.date(),
})

/**
 * Schema for user scheduling preferences
 */
export const userSchedulingPreferencesSchema = z.object({
  defaultCalendarId: z.string().min(1),
  workingHours: preferredTimeRangeSchema,
  workingDays: z
    .array(dayOfWeekSchema)
    .min(1, { message: 'At least one working day is required' })
    .max(7),
  timezone: z.string().min(1, { message: 'Timezone is required' }),
  autoScheduleEnabled: z.boolean().default(false),
  preferContiguousBlocks: z.boolean().default(true),
})

/**
 * Schema for connected calendar
 */
export const connectedCalendarSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['work', 'personal']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #3b82f6)',
  }),
  primary: z.boolean(),
  accessRole: z.enum(['reader', 'writer', 'owner']),
  enabled: z.boolean().default(true),
  syncToken: z.string().optional(),
  lastSyncAt: z.date().optional(),
})

/**
 * Schema for calendar event
 */
export const calendarEventSchema = z.object({
  id: z.string().min(1),
  calendarId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  start: z.date(),
  end: z.date(),
  allDay: z.boolean(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']),
  brainDumperTaskId: z.string().optional(),
  brainDumperBufferType: z.enum(['before', 'after']).optional(),
  recurringEventId: z.string().optional(),
  htmlLink: z.string().url().optional(),
})

/**
 * Type inference helpers
 */
export type SchedulingRuleInput = z.infer<typeof schedulingRuleSchema>
export type ProtectedSlotInput = z.infer<typeof protectedSlotSchema>
export type UserSchedulingPreferencesInput = z.infer<typeof userSchedulingPreferencesSchema>
export type ConnectedCalendarInput = z.infer<typeof connectedCalendarSchema>
export type CalendarEventInput = z.infer<typeof calendarEventSchema>

/**
 * Validates scheduling rule data and returns a typed result
 * @param data - Unknown data to validate
 * @returns Validated SchedulingRule data (without id, userId, timestamps)
 * @throws ZodError if validation fails
 */
export function validateSchedulingRule(data: unknown): SchedulingRuleInput {
  return schedulingRuleSchema.parse(data)
}

/**
 * Safely validates scheduling rule data
 * @param data - Unknown data to validate
 * @returns Result object with success flag and either data or error
 */
export function safeValidateSchedulingRule(data: unknown): z.SafeParseReturnType<unknown, SchedulingRuleInput> {
  return schedulingRuleSchema.safeParse(data)
}

/**
 * Validates protected slot data and returns a typed result
 * @param data - Unknown data to validate
 * @returns Validated ProtectedSlot data (without id, userId, timestamps)
 * @throws ZodError if validation fails
 */
export function validateProtectedSlot(data: unknown): ProtectedSlotInput {
  return protectedSlotSchema.parse(data)
}

/**
 * Safely validates protected slot data
 * @param data - Unknown data to validate
 * @returns Result object with success flag and either data or error
 */
export function safeValidateProtectedSlot(data: unknown): z.SafeParseReturnType<unknown, ProtectedSlotInput> {
  return protectedSlotSchema.safeParse(data)
}

/**
 * Validates user scheduling preferences
 * @param data - Unknown data to validate
 * @returns Validated preferences data
 * @throws ZodError if validation fails
 */
export function validateUserSchedulingPreferences(data: unknown): UserSchedulingPreferencesInput {
  return userSchedulingPreferencesSchema.parse(data)
}

/**
 * Safely validates user scheduling preferences
 * @param data - Unknown data to validate
 * @returns Result object with success flag and either data or error
 */
export function safeValidateUserSchedulingPreferences(data: unknown): z.SafeParseReturnType<unknown, UserSchedulingPreferencesInput> {
  return userSchedulingPreferencesSchema.safeParse(data)
}

/**
 * Validates a time string in "HH:mm" format
 * @param time - String to validate
 * @returns True if valid, false otherwise
 */
export function isValidTimeString(time: string): boolean {
  return timeStringSchema.safeParse(time).success
}

/**
 * Validates a task type string
 * @param type - String to validate
 * @returns True if valid task type, false otherwise
 */
export function isValidTaskType(type: string): type is TaskType {
  return taskTypeSchema.safeParse(type).success
}

/**
 * Formats Zod errors into a user-friendly message
 * @param error - Zod error object
 * @returns Array of error messages
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.')
    return path ? `${path}: ${err.message}` : err.message
  })
}
