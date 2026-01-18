import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import {
  renderWithProviders,
  renderAuthenticated,
  renderUnauthenticated,
  renderWithTasks,
  renderWithProjects,
} from './testUtils'
import { createMockUser } from './testUser'
import { createMockTask, createMockTasks, taskFixtures } from './testTask'

// Simple test component
const TestComponent = ({ text = 'Test Component' }: { text?: string }) => (
  <div data-testid="test-component">{text}</div>
)

describe('renderWithProviders', () => {
  it('renders a component', () => {
    renderWithProviders(<TestComponent />)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  it('provides auth context', () => {
    const { authContext } = renderWithProviders(<TestComponent />)
    expect(authContext.user).toBeDefined()
    expect(authContext.signIn).toBeDefined()
    expect(authContext.signOut).toBeDefined()
  })

  it('provides task context', () => {
    const { taskContext } = renderWithProviders(<TestComponent />)
    expect(taskContext.tasks).toEqual([])
    expect(taskContext.addTask).toBeDefined()
    expect(taskContext.updateTask).toBeDefined()
  })
})

describe('renderAuthenticated', () => {
  it('renders with an authenticated user', () => {
    const { authContext } = renderAuthenticated(<TestComponent />)
    expect(authContext.user).not.toBeNull()
    expect(authContext.user?.uid).toBeDefined()
  })

  it('allows custom user overrides', () => {
    const { authContext } = renderAuthenticated(<TestComponent />, {
      user: { displayName: 'Custom User' },
    })
    expect(authContext.user?.displayName).toBe('Custom User')
  })
})

describe('renderUnauthenticated', () => {
  it('renders with null user', () => {
    const { authContext } = renderUnauthenticated(<TestComponent />)
    expect(authContext.user).toBeNull()
    expect(authContext.loading).toBe(false)
  })
})

describe('renderWithTasks', () => {
  it('renders with provided tasks', () => {
    const tasks = [
      { content: 'Task 1' },
      { content: 'Task 2' },
    ]
    const { taskContext } = renderWithTasks(<TestComponent />, tasks)
    expect(taskContext.tasks).toHaveLength(2)
    expect(taskContext.tasks[0].content).toBe('Task 1')
    expect(taskContext.tasks[1].content).toBe('Task 2')
  })
})

describe('renderWithProjects', () => {
  it('renders with provided projects', () => {
    const projects = [
      { name: 'Project 1' },
      { name: 'Project 2' },
    ]
    const { taskContext } = renderWithProjects(<TestComponent />, projects)
    expect(taskContext.projects).toHaveLength(2)
    expect(taskContext.projects[0].name).toBe('Project 1')
    expect(taskContext.projects[1].name).toBe('Project 2')
  })
})

describe('createMockUser', () => {
  it('creates a mock user with defaults', () => {
    const user = createMockUser()
    expect(user.uid).toBeDefined()
    expect(user.email).toBeDefined()
    expect(user.displayName).toBeDefined()
  })

  it('allows overrides', () => {
    const user = createMockUser({ displayName: 'Custom Name' })
    expect(user.displayName).toBe('Custom Name')
  })
})

describe('createMockTask', () => {
  it('creates a mock task with defaults', () => {
    const task = createMockTask()
    expect(task.id).toBeDefined()
    expect(task.content).toBeDefined()
    expect(task.priority).toBeDefined()
    expect(task.completed).toBe(false)
    expect(task.archived).toBe(false)
  })

  it('allows overrides', () => {
    const task = createMockTask({ content: 'Custom task', priority: 'high' })
    expect(task.content).toBe('Custom task')
    expect(task.priority).toBe('high')
  })
})

describe('createMockTasks', () => {
  it('creates specified number of tasks', () => {
    const tasks = createMockTasks(3)
    expect(tasks).toHaveLength(3)
  })

  it('creates tasks with unique IDs', () => {
    const tasks = createMockTasks(3)
    const ids = new Set(tasks.map((t) => t.id))
    expect(ids.size).toBe(3)
  })
})

describe('taskFixtures', () => {
  it('has all expected fixtures', () => {
    expect(taskFixtures.basic).toBeDefined()
    expect(taskFixtures.highPriority).toBeDefined()
    expect(taskFixtures.completed).toBeDefined()
    expect(taskFixtures.archived).toBeDefined()
    expect(taskFixtures.overdue).toBeDefined()
  })

  it('highPriority has correct priority', () => {
    expect(taskFixtures.highPriority.priority).toBe('high')
  })

  it('completed task is marked completed', () => {
    expect(taskFixtures.completed.completed).toBe(true)
  })
})
