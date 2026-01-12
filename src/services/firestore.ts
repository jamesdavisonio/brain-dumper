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
        dueTime: data.dueTime,
        scheduledDate: toDate(data.scheduledDate),
        scheduledTime: data.scheduledTime,
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
    // Build document data, excluding undefined values (Firestore doesn't accept undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docData: Record<string, any> = {
      content: task.content,
      priority: task.priority,
      completed: task.completed,
      archived: task.archived,
      userId: task.userId,
      order: task.order,
      createdAt: now,
      updatedAt: now,
    }

    // Only add optional fields if they have values
    if (task.project) docData.project = task.project
    if (task.dueDate) docData.dueDate = toTimestamp(task.dueDate)
    if (task.dueTime) docData.dueTime = task.dueTime
    if (task.scheduledDate) docData.scheduledDate = toTimestamp(task.scheduledDate)
    if (task.scheduledTime) docData.scheduledTime = task.scheduledTime
    if (task.timeEstimate) docData.timeEstimate = task.timeEstimate
    if (task.recurrence) docData.recurrence = task.recurrence
    if (task.category) docData.category = task.category

    batch.set(docRef, docData)
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
        icon: data.icon,
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

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'color' | 'icon'>>
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, id)
  await updateDoc(docRef, updates)
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS_COLLECTION, id))
}
