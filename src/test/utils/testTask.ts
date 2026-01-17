import type { Task, Priority, Recurrence, ParsedTask, Project } from '@/types'

/**
 * Create a mock task object for testing
 * @param overrides - Partial task object to override default values
 * @returns Complete Task object
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date()
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Test task',
    priority: 'medium' as Priority,
    completed: false,
    archived: false,
    userId: 'test-user-123',
    createdAt: now,
    updatedAt: now,
    order: 0,
    ...overrides,
  }
}

/**
 * Create a mock task with a specific priority
 */
export function createMockTaskWithPriority(priority: Priority, overrides: Partial<Task> = {}): Task {
  return createMockTask({
    priority,
    content: `${priority.charAt(0).toUpperCase() + priority.slice(1)} priority task`,
    ...overrides,
  })
}

/**
 * Create a mock task with a due date
 */
export function createMockTaskWithDueDate(
  dueDate: Date,
  overrides: Partial<Task> = {}
): Task {
  return createMockTask({
    dueDate,
    content: 'Task with due date',
    ...overrides,
  })
}

/**
 * Create a mock task that's due today
 */
export function createMockTaskDueToday(overrides: Partial<Task> = {}): Task {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return createMockTaskWithDueDate(today, {
    content: 'Task due today',
    ...overrides,
  })
}

/**
 * Create a mock task that's overdue
 */
export function createMockOverdueTask(overrides: Partial<Task> = {}): Task {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999)
  return createMockTaskWithDueDate(yesterday, {
    content: 'Overdue task',
    priority: 'high',
    ...overrides,
  })
}

/**
 * Create a mock task that's scheduled for a specific date
 */
export function createMockScheduledTask(
  scheduledDate: Date,
  scheduledTime?: string,
  overrides: Partial<Task> = {}
): Task {
  return createMockTask({
    scheduledDate,
    scheduledTime: scheduledTime || 'morning',
    content: 'Scheduled task',
    ...overrides,
  })
}

/**
 * Create a mock completed task
 */
export function createMockCompletedTask(overrides: Partial<Task> = {}): Task {
  return createMockTask({
    completed: true,
    content: 'Completed task',
    ...overrides,
  })
}

/**
 * Create a mock archived task
 */
export function createMockArchivedTask(overrides: Partial<Task> = {}): Task {
  return createMockTask({
    archived: true,
    completed: true,
    content: 'Archived task',
    ...overrides,
  })
}

/**
 * Create a mock task with a project
 */
export function createMockTaskWithProject(
  projectName: string,
  overrides: Partial<Task> = {}
): Task {
  return createMockTask({
    project: projectName,
    content: `Task in ${projectName}`,
    ...overrides,
  })
}

/**
 * Create a mock task with recurrence
 */
export function createMockRecurringTask(
  recurrence: Recurrence,
  overrides: Partial<Task> = {}
): Task {
  return createMockTask({
    recurrence,
    content: 'Recurring task',
    ...overrides,
  })
}

/**
 * Create a mock task with a time estimate
 */
export function createMockTaskWithTimeEstimate(
  minutes: number,
  overrides: Partial<Task> = {}
): Task {
  return createMockTask({
    timeEstimate: minutes,
    content: `Task (${minutes}m)`,
    ...overrides,
  })
}

/**
 * Create an array of mock tasks for testing lists
 */
export function createMockTasks(count: number = 5): Task[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTask({
      id: `task-${index + 1}`,
      content: `Task ${index + 1}`,
      order: index,
      priority: ['high', 'medium', 'low'][index % 3] as Priority,
    })
  )
}

/**
 * Create a diverse set of tasks for testing
 */
export function createMockTaskSet(): Task[] {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  return [
    createMockTask({
      id: 'task-high-1',
      content: 'High priority task',
      priority: 'high',
      order: 0,
    }),
    createMockTaskDueToday({
      id: 'task-due-today',
      order: 1,
    }),
    createMockOverdueTask({
      id: 'task-overdue',
      order: 2,
    }),
    createMockCompletedTask({
      id: 'task-completed',
      order: 3,
    }),
    createMockTaskWithProject('Work', {
      id: 'task-project-work',
      order: 4,
    }),
    createMockTaskWithProject('Personal', {
      id: 'task-project-personal',
      order: 5,
    }),
    createMockScheduledTask(tomorrow, 'morning', {
      id: 'task-scheduled',
      order: 6,
    }),
    createMockRecurringTask(
      { type: 'daily', interval: 1 },
      {
        id: 'task-recurring',
        order: 7,
      }
    ),
  ]
}

/**
 * Create a mock parsed task (from brain dump)
 */
export function createMockParsedTask(overrides: Partial<ParsedTask> = {}): ParsedTask {
  return {
    content: 'Parsed task from brain dump',
    priority: 'medium',
    ...overrides,
  }
}

/**
 * Create mock parsed tasks array
 */
export function createMockParsedTasks(count: number = 3): ParsedTask[] {
  return Array.from({ length: count }, (_, index) =>
    createMockParsedTask({
      content: `Parsed task ${index + 1}`,
      priority: ['high', 'medium', 'low'][index % 3] as Priority,
    })
  )
}

/**
 * Create a mock project
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${Date.now()}`,
    name: 'Test Project',
    color: '#3B82F6',
    userId: 'test-user-123',
    createdAt: new Date(),
    ...overrides,
  }
}

/**
 * Create mock projects array
 */
export function createMockProjects(count: number = 3): Project[] {
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']
  const names = ['Work', 'Personal', 'Health', 'Finance', 'Learning']

  return Array.from({ length: count }, (_, index) =>
    createMockProject({
      id: `project-${index + 1}`,
      name: names[index % names.length],
      color: colors[index % colors.length],
    })
  )
}

/**
 * Task fixtures for common test scenarios
 */
export const taskFixtures = {
  basic: createMockTask(),
  highPriority: createMockTaskWithPriority('high'),
  mediumPriority: createMockTaskWithPriority('medium'),
  lowPriority: createMockTaskWithPriority('low'),
  dueToday: createMockTaskDueToday(),
  overdue: createMockOverdueTask(),
  completed: createMockCompletedTask(),
  archived: createMockArchivedTask(),
  withProject: createMockTaskWithProject('Work'),
  withTimeEstimate: createMockTaskWithTimeEstimate(30),
  recurring: createMockRecurringTask({ type: 'daily', interval: 1 }),
}

/**
 * Project fixtures for common test scenarios
 */
export const projectFixtures = {
  work: createMockProject({ id: 'work', name: 'Work', color: '#3B82F6' }),
  personal: createMockProject({ id: 'personal', name: 'Personal', color: '#10B981' }),
  health: createMockProject({ id: 'health', name: 'Health', color: '#EF4444' }),
}
