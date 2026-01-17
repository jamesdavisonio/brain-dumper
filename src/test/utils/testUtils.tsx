import React, { ReactElement, ReactNode } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { User, Task, Project, AuthContextType, TaskContextType } from '@/types'
import { createMockUser } from './testUser'
import { createMockTask } from './testTask'

// Default mock values for contexts
const defaultMockUser = createMockUser()

const defaultAuthContext: AuthContextType = {
  user: defaultMockUser,
  loading: false,
  signIn: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
}

const defaultTaskContext: TaskContextType = {
  tasks: [],
  projects: [],
  loading: false,
  error: null,
  addTask: vi.fn(() => Promise.resolve()),
  updateTask: vi.fn(() => Promise.resolve()),
  deleteTask: vi.fn(() => Promise.resolve()),
  addProject: vi.fn(() => Promise.resolve()),
  updateProject: vi.fn(() => Promise.resolve()),
  deleteProject: vi.fn(() => Promise.resolve()),
  bulkAddTasks: vi.fn(() => Promise.resolve()),
}

// Create mock context providers
const MockAuthContext = React.createContext<AuthContextType | null>(null)
const MockTaskContext = React.createContext<TaskContextType | null>(null)

// Export mock hooks for use in tests
export const mockUseAuth = vi.fn(() => defaultAuthContext)
export const mockUseTasks = vi.fn(() => defaultTaskContext)

// Mock providers component
interface MockProvidersProps {
  children: ReactNode
  authValue?: Partial<AuthContextType>
  taskValue?: Partial<TaskContextType>
}

const MockProviders: React.FC<MockProvidersProps> = ({
  children,
  authValue = {},
  taskValue = {},
}) => {
  const authContextValue: AuthContextType = {
    ...defaultAuthContext,
    ...authValue,
  }

  const taskContextValue: TaskContextType = {
    ...defaultTaskContext,
    ...taskValue,
  }

  return (
    <BrowserRouter>
      <MockAuthContext.Provider value={authContextValue}>
        <MockTaskContext.Provider value={taskContextValue}>
          {children}
        </MockTaskContext.Provider>
      </MockAuthContext.Provider>
    </BrowserRouter>
  )
}

// Custom render options
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: Partial<AuthContextType>
  taskValue?: Partial<TaskContextType>
  route?: string
}

/**
 * Custom render function that wraps components with all necessary providers
 * @param ui - React element to render
 * @param options - Custom render options including provider values
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & {
  authContext: AuthContextType
  taskContext: TaskContextType
} {
  const { authValue, taskValue, route = '/', ...renderOptions } = options

  // Set the route if provided
  if (route !== '/') {
    window.history.pushState({}, 'Test page', route)
  }

  const authContext: AuthContextType = {
    ...defaultAuthContext,
    ...authValue,
  }

  const taskContext: TaskContextType = {
    ...defaultTaskContext,
    ...taskValue,
  }

  const wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <MockProviders authValue={authValue} taskValue={taskValue}>
      {children}
    </MockProviders>
  )

  const result = render(ui, { wrapper, ...renderOptions })

  return {
    ...result,
    authContext,
    taskContext,
  }
}

/**
 * Render with authenticated user
 */
export function renderAuthenticated(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'authValue'> & {
    user?: Partial<User>
    authValue?: Omit<Partial<AuthContextType>, 'user'>
  } = {}
) {
  const { user, authValue, ...rest } = options
  const mockUser = createMockUser(user)

  return renderWithProviders(ui, {
    ...rest,
    authValue: {
      ...authValue,
      user: mockUser,
      loading: false,
    },
  })
}

/**
 * Render with unauthenticated state
 */
export function renderUnauthenticated(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'authValue'> = {}
) {
  return renderWithProviders(ui, {
    ...options,
    authValue: {
      user: null,
      loading: false,
    },
  })
}

/**
 * Render with loading state
 */
export function renderLoading(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  return renderWithProviders(ui, {
    ...options,
    authValue: {
      ...options.authValue,
      loading: true,
    },
    taskValue: {
      ...options.taskValue,
      loading: true,
    },
  })
}

/**
 * Render with tasks
 */
export function renderWithTasks(
  ui: ReactElement,
  tasks: Partial<Task>[],
  options: CustomRenderOptions = {}
) {
  const mockTasks = tasks.map((task, index) =>
    createMockTask({ ...task, id: task.id || `task-${index}` })
  )

  return renderWithProviders(ui, {
    ...options,
    taskValue: {
      ...options.taskValue,
      tasks: mockTasks,
    },
  })
}

/**
 * Render with projects
 */
export function renderWithProjects(
  ui: ReactElement,
  projects: Partial<Project>[],
  options: CustomRenderOptions = {}
) {
  const mockProjects: Project[] = projects.map((project, index) => ({
    id: project.id || `project-${index}`,
    name: project.name || `Project ${index + 1}`,
    color: project.color || '#3B82F6',
    userId: project.userId || 'test-user-123',
    createdAt: project.createdAt || new Date(),
    icon: project.icon,
  }))

  return renderWithProviders(ui, {
    ...options,
    taskValue: {
      ...options.taskValue,
      projects: mockProjects,
    },
  })
}

/**
 * Render with error state
 */
export function renderWithError(
  ui: ReactElement,
  error: string,
  options: CustomRenderOptions = {}
) {
  return renderWithProviders(ui, {
    ...options,
    taskValue: {
      ...options.taskValue,
      error,
    },
  })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { renderWithProviders as render }
