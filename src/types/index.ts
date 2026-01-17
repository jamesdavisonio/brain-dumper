// Re-export calendar types
export * from './calendar'

// Re-export scheduling types
export type {
  TaskType,
  SchedulingRule,
  ProtectedSlot,
  ScheduledTask,
  SchedulingSuggestion,
  ScoringFactor,
  Conflict,
  SchedulingContext,
  UserSchedulingPreferences,
  TaskSchedulingExtension,
} from './scheduling'

export type Priority = 'high' | 'medium' | 'low'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface Recurrence {
  type: RecurrenceType
  interval: number // every X days/weeks/months
  daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc. for weekly
  endDate?: Date
}

// Import TaskType for use in Task interface
import type { TaskType } from './scheduling'

export interface Task {
  id: string
  content: string
  project?: string
  priority: Priority
  dueDate?: Date
  dueTime?: string // 'morning' | 'afternoon' | 'evening' for time-of-day
  scheduledDate?: Date
  scheduledTime?: string // 'morning' | 'afternoon' | 'evening' or HH:MM format (24-hour)
  timeEstimate?: number // minutes
  completed: boolean
  archived: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
  order: number
  recurrence?: Recurrence
  category?: string // auto-categorized
  // Calendar integration fields (from TaskSchedulingExtension)
  /** Type of task for scheduling rules */
  taskType?: TaskType
  /** ID of the calendar event if scheduled */
  calendarEventId?: string
  /** ID of the calendar the task is scheduled on */
  calendarId?: string
  /** Scheduled start time on calendar */
  scheduledStart?: Date
  /** Scheduled end time on calendar */
  scheduledEnd?: Date
  /** Current sync status with calendar */
  syncStatus?: 'pending' | 'synced' | 'error' | 'orphaned'
  /** Buffer time in minutes before the task */
  bufferBefore?: number
  /** Buffer time in minutes after the task */
  bufferAfter?: number
}

export interface Project {
  id: string
  name: string
  color: string
  icon?: string
  userId: string
  createdAt: Date
}

export interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export interface ParsedTask {
  content: string
  project?: string
  priority: Priority
  dueDate?: string
  dueTime?: string // 'morning' | 'afternoon' | 'evening' for time-of-day
  scheduledTime?: string // 'morning' | 'afternoon' | 'evening' or HH:MM format (24-hour)
  timeEstimate?: number
  recurrence?: Recurrence
  category?: string
}

export interface BrainDumpResult {
  tasks: ParsedTask[]
  suggestedProjects: string[]
}

export interface DumpHistoryEntry {
  id: string
  content: string
  taskCount: number
  userId: string
  createdAt: Date
}

export interface FilterState {
  project?: string
  priority?: Priority
  showCompleted: boolean
  dateRange?: {
    start: Date
    end: Date
  }
}

export type ViewMode = 'list' | 'timeline' | 'archive'

export interface TaskContextType {
  tasks: Task[]
  projects: Project[]
  loading: boolean
  error: string | null
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addProject: (name: string, color?: string, icon?: string) => Promise<void>
  updateProject: (id: string, updates: { name?: string; color?: string; icon?: string }) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  bulkAddTasks: (tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[]) => Promise<void>
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

// Analytics types
export interface TaskStats {
  totalTasks: number
  completedTasks: number
  archivedTasks: number
  tasksByProject: Record<string, number>
  tasksByPriority: Record<Priority, number>
  tasksByCategory: Record<string, number>
  completionRate: number
  averageCompletionTime?: number
}

export interface WeeklyStats {
  week: string
  completed: number
  scheduled: number
}

// Categories for auto-categorization
export const TASK_CATEGORIES = [
  'Work',
  'Personal',
  'Health',
  'Finance',
  'Shopping',
  'Home',
  'Learning',
  'Social',
  'Travel',
  'Admin',
] as const

export type TaskCategory = typeof TASK_CATEGORIES[number]
