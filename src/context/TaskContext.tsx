import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeToTasks,
  subscribeToProjects,
  createTask,
  updateTask as updateTaskService,
  deleteTask as deleteTaskService,
  bulkCreateTasks,
  createProject,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
} from '@/services/firestore'
import type { Task, Project, TaskContextType } from '@/types'
import { getProjectColor, getProjectIcon } from '@/lib/utils'
import { checkAndScheduleDailySummary } from '@/lib/notifications'

const TaskContext = createContext<TaskContextType | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setTasks([])
      setProjects([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribeTasks = subscribeToTasks(user.uid, (newTasks) => {
      setTasks(newTasks)
      setLoading(false)
    })

    const unsubscribeProjects = subscribeToProjects(user.uid, (newProjects) => {
      setProjects(newProjects)
    })

    return () => {
      unsubscribeTasks()
      unsubscribeProjects()
    }
  }, [user])

  // Check for daily summary notification
  useEffect(() => {
    if (tasks.length === 0) return

    const activeTasks = tasks.filter((t) => !t.completed && !t.archived)
    const completedTasks = tasks.filter((t) => t.completed && !t.archived)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueTodayTasks = activeTasks.filter((t) => {
      if (!t.dueDate) return false
      const dueDate = new Date(t.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() === today.getTime()
    }).length

    const overdueTasksCount = activeTasks.filter((t) => {
      if (!t.dueDate) return false
      const dueDate = new Date(t.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() < today.getTime()
    }).length

    checkAndScheduleDailySummary({
      totalTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      dueTodayTasks,
      overdueTasksCount,
    })
  }, [tasks])

  const addTask = async (
    task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
  ) => {
    if (!user) return
    try {
      await createTask({ ...task, userId: user.uid })
    } catch (err) {
      setError('Failed to create task')
      console.error(err)
    }
  }

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await updateTaskService(id, updates)
    } catch (err) {
      setError('Failed to update task')
      console.error(err)
    }
  }

  const deleteTask = async (id: string) => {
    try {
      await deleteTaskService(id)
    } catch (err) {
      setError('Failed to delete task')
      console.error(err)
    }
  }

  const addProject = async (name: string, color?: string, icon?: string) => {
    if (!user) return
    try {
      const projectColor = color || getProjectColor(projects.length)
      const projectIcon = icon || getProjectIcon(projects.length)
      await createProject({ name, color: projectColor, icon: projectIcon, userId: user.uid })
    } catch (err) {
      setError('Failed to create project')
      console.error(err)
    }
  }

  const updateProject = async (id: string, updates: { name?: string; color?: string; icon?: string }) => {
    try {
      await updateProjectService(id, updates)
    } catch (err) {
      setError('Failed to update project')
      console.error(err)
    }
  }

  const deleteProject = async (id: string) => {
    try {
      await deleteProjectService(id)
    } catch (err) {
      setError('Failed to delete project')
      console.error(err)
    }
  }

  const bulkAddTasks = async (
    newTasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[]
  ) => {
    if (!user) return
    try {
      const tasksWithUser = newTasks.map((task) => ({
        ...task,
        userId: user.uid,
      }))
      await bulkCreateTasks(tasksWithUser)
    } catch (err) {
      setError('Failed to create tasks')
      console.error(err)
    }
  }

  return (
    <TaskContext.Provider
      value={{
        tasks,
        projects,
        loading,
        error,
        addTask,
        updateTask,
        deleteTask,
        addProject,
        updateProject,
        deleteProject,
        bulkAddTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks(): TaskContextType {
  const context = useContext(TaskContext)
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider')
  }
  return context
}
