export type Priority = 'high' | 'medium' | 'low'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface Recurrence {
  type: RecurrenceType
  interval: number // every X days/weeks/months
  daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc. for weekly
  endDate?: Date
}

export interface Task {
  id: string
  content: string
  project?: string
  priority: Priority
  dueDate?: Date
  scheduledDate?: Date
  timeEstimate?: number // minutes
  completed: boolean
  archived: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
  order: number
  recurrence?: Recurrence
  category?: string // auto-categorized
}

export interface Project {
  id: string
  name: string
  color: string
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
  timeEstimate?: number
  recurrence?: Recurrence
  category?: string
}

export interface BrainDumpResult {
  tasks: ParsedTask[]
  suggestedProjects: string[]
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
  addProject: (name: string, color?: string) => Promise<void>
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
  created: number
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
