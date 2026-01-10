import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task, Project } from '@/types'

const TASKS_COLLECTION = 'tasks'
const PROJECTS_COLLECTION = 'projects'

// Convert Firestore timestamp to Date
function toDate(timestamp: Timestamp | Date | undefined): Date | undefined {
  if (!timestamp) return undefined
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  return timestamp
}

// Convert Date to Firestore timestamp
function toTimestamp(date: Date | undefined): Timestamp | undefined {
  if (!date) return undefined
  return Timestamp.fromDate(date)
}

// Task Operations
export function subscribeToTasks(
  userId: string,
  callback: (tasks: Task[]) => void
): () => void {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where('userId', '==', userId),
    orderBy('order', 'asc')
  )

  return onSnapshot(q, (snapshot) => {
    const tasks: Task[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        content: data.content,
        project: data.project,
        priority: data.priority,
        dueDate: toDate(data.dueDate),
        scheduledDate: toDate(data.scheduledDate),
        timeEstimate: data.timeEstimate,
        completed: data.completed,
        archived: data.archived,
        userId: data.userId,
        createdAt: toDate(data.createdAt) || new Date(),
        updatedAt: toDate(data.updatedAt) || new Date(),
        order: data.order || 0,
        recurrence: data.recurrence,
        category: data.category,
      }
    })
    callback(tasks)
  })
}

export async function createTask(
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Timestamp.now()
  const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
    ...task,
    dueDate: toTimestamp(task.dueDate),
    scheduledDate: toTimestamp(task.scheduledDate),
    createdAt: now,
    updatedAt: now,
  })
  return docRef.id
}

export async function updateTask(
  id: string,
  updates: Partial<Task>
): Promise<void> {
  const docRef = doc(db, TASKS_COLLECTION, id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    updatedAt: Timestamp.now(),
  }

  // Copy over the updates, converting dates as needed
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'dueDate' || key === 'scheduledDate') {
      if (value !== undefined) {
        updateData[key] = toTimestamp(value as Date)
      }
    } else if (value !== undefined) {
      updateData[key] = value
    }
  }

  await updateDoc(docRef, updateData)
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, TASKS_COLLECTION, id))
}

export async function bulkCreateTasks(
  tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  const batch = writeBatch(db)
  const now = Timestamp.now()

  tasks.forEach((task) => {
    const docRef = doc(collection(db, TASKS_COLLECTION))
    batch.set(docRef, {
      ...task,
      dueDate: toTimestamp(task.dueDate),
      scheduledDate: toTimestamp(task.scheduledDate),
      createdAt: now,
      updatedAt: now,
    })
  })

  await batch.commit()
}

// Project Operations
export function subscribeToProjects(
  userId: string,
  callback: (projects: Project[]) => void
): () => void {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'asc')
  )

  return onSnapshot(q, (snapshot) => {
    const projects: Project[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        color: data.color,
        userId: data.userId,
        createdAt: toDate(data.createdAt) || new Date(),
      }
    })
    callback(projects)
  })
}

export async function createProject(
  project: Omit<Project, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
    ...project,
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS_COLLECTION, id))
}
