export type Priority = 'high' | 'medium' | 'low'

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
