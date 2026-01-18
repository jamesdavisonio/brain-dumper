import { vi } from 'vitest'

// Mock Firebase App
export const mockFirebaseApp = {}

// Mock Auth types and functions
export interface MockFirebaseUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  isAnonymous: boolean
  metadata: {
    creationTime?: string
    lastSignInTime?: string
  }
  providerData: Array<{
    providerId: string
    uid: string
    displayName: string | null
    email: string | null
    phoneNumber: string | null
    photoURL: string | null
  }>
  refreshToken: string
  tenantId: string | null
  delete: () => Promise<void>
  getIdToken: () => Promise<string>
  getIdTokenResult: () => Promise<{ token: string }>
  reload: () => Promise<void>
  toJSON: () => object
}

export const createMockFirebaseUser = (overrides: Partial<MockFirebaseUser> = {}): MockFirebaseUser => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2024-01-15T00:00:00.000Z',
  },
  providerData: [
    {
      providerId: 'google.com',
      uid: 'google-uid-123',
      displayName: 'Test User',
      email: 'test@example.com',
      phoneNumber: null,
      photoURL: 'https://example.com/photo.jpg',
    },
  ],
  refreshToken: 'mock-refresh-token',
  tenantId: null,
  delete: vi.fn(() => Promise.resolve()),
  getIdToken: vi.fn(() => Promise.resolve('mock-id-token')),
  getIdTokenResult: vi.fn(() => Promise.resolve({ token: 'mock-id-token' })),
  reload: vi.fn(() => Promise.resolve()),
  toJSON: vi.fn(() => ({})),
  ...overrides,
})

// Mock Auth
type AuthStateCallback = (user: MockFirebaseUser | null) => void
let authStateListeners: AuthStateCallback[] = []
let currentMockUser: MockFirebaseUser | null = null

export const mockAuth = {
  currentUser: currentMockUser,
  app: mockFirebaseApp,
  name: 'mock-auth',
  config: {},
  setPersistence: vi.fn(),
  languageCode: null,
  tenantId: null,
  settings: { appVerificationDisabledForTesting: false },
  onAuthStateChanged: vi.fn((callback: AuthStateCallback) => {
    authStateListeners.push(callback)
    // Immediately call with current user
    callback(currentMockUser)
    // Return unsubscribe function
    return () => {
      authStateListeners = authStateListeners.filter((cb) => cb !== callback)
    }
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}

export const mockGoogleProvider = {
  providerId: 'google.com',
  setCustomParameters: vi.fn(),
  addScope: vi.fn(),
}

// Helper to simulate auth state changes
export const simulateAuthStateChange = (user: MockFirebaseUser | null) => {
  currentMockUser = user
  mockAuth.currentUser = user
  authStateListeners.forEach((listener) => listener(user))
}

export const resetAuthMocks = () => {
  currentMockUser = null
  mockAuth.currentUser = null
  authStateListeners = []
  vi.clearAllMocks()
}

// Mock Firestore types
export interface MockFirestoreDoc<T = Record<string, unknown>> {
  id: string
  data: () => T
  exists: () => boolean
  ref: { id: string; path: string }
}

export interface MockFirestoreSnapshot<T = Record<string, unknown>> {
  docs: MockFirestoreDoc<T>[]
  empty: boolean
  size: number
  forEach: (callback: (doc: MockFirestoreDoc<T>) => void) => void
}

export const createMockFirestoreDoc = <T extends Record<string, unknown>>(
  id: string,
  data: T
): MockFirestoreDoc<T> => ({
  id,
  data: () => data,
  exists: () => true,
  ref: { id, path: `collection/${id}` },
})

export const createMockFirestoreSnapshot = <T extends Record<string, unknown>>(
  docs: Array<{ id: string; data: T }>
): MockFirestoreSnapshot<T> => {
  const mockDocs = docs.map((doc) => createMockFirestoreDoc(doc.id, doc.data))
  return {
    docs: mockDocs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback) => mockDocs.forEach(callback),
  }
}

// Mock Firestore
export const mockFirestore = {
  app: mockFirebaseApp,
  type: 'firestore',
}

export const mockCollection = vi.fn((db, path: string) => ({
  path,
  id: path.split('/').pop(),
}))

export const mockDoc = vi.fn((collectionRef, id?: string) => ({
  id: id || 'mock-doc-id',
  path: id ? `${collectionRef.path}/${id}` : collectionRef.path,
}))

export const mockQuery = vi.fn((collectionRef, ...constraints) => ({
  ...collectionRef,
  constraints,
}))

export const mockWhere = vi.fn((field: string, operator: string, value: unknown) => ({
  type: 'where',
  field,
  operator,
  value,
}))

export const mockOrderBy = vi.fn((field: string, direction = 'asc') => ({
  type: 'orderBy',
  field,
  direction,
}))

export const mockLimit = vi.fn((n: number) => ({
  type: 'limit',
  n,
}))

// Snapshot listener storage for testing
type SnapshotCallback<T = Record<string, unknown>> = (snapshot: MockFirestoreSnapshot<T>) => void
const snapshotListeners: Map<string, SnapshotCallback[]> = new Map()

export const mockOnSnapshot = vi.fn((query, callback: SnapshotCallback) => {
  const path = query.path || 'default'
  if (!snapshotListeners.has(path)) {
    snapshotListeners.set(path, [])
  }
  snapshotListeners.get(path)!.push(callback)

  // Return unsubscribe function
  return () => {
    const listeners = snapshotListeners.get(path)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }
})

// Helper to simulate Firestore data changes
export const simulateSnapshotChange = <T extends Record<string, unknown>>(
  path: string,
  docs: Array<{ id: string; data: T }>
) => {
  const listeners = snapshotListeners.get(path)
  if (listeners) {
    const snapshot = createMockFirestoreSnapshot(docs)
    listeners.forEach((callback) => callback(snapshot))
  }
}

export const mockAddDoc = vi.fn((collectionRef, data) =>
  Promise.resolve({ id: 'new-doc-id', ...data })
)

export const mockUpdateDoc = vi.fn((_docRef, _data) => Promise.resolve())

export const mockDeleteDoc = vi.fn((_docRef) => Promise.resolve())

export const mockGetDocs = vi.fn((_query) =>
  Promise.resolve(createMockFirestoreSnapshot([]))
)

export const mockGetDoc = vi.fn((docRef) =>
  Promise.resolve(createMockFirestoreDoc(docRef.id, {}))
)

export const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(() => Promise.resolve()),
}))

// Mock Timestamp
export const mockTimestamp = {
  fromDate: vi.fn((date: Date) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  })),
  now: vi.fn(() => ({
    toDate: () => new Date(),
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
  })),
}

export const mockServerTimestamp = vi.fn(() => ({
  toDate: () => new Date(),
}))

// Mock Messaging
export const mockMessaging = {
  app: mockFirebaseApp,
}

export const mockGetToken = vi.fn(() => Promise.resolve('mock-fcm-token'))

export const mockOnMessage = vi.fn(() => vi.fn())

// Mock Functions
export const mockFunctions = {
  app: mockFirebaseApp,
}

export const mockHttpsCallable = vi.fn(
  (functions, name: string) =>
    vi.fn((data?: unknown) =>
      Promise.resolve({ data: { success: true, functionName: name, input: data } })
    )
)

// Reset all Firestore mocks
export const resetFirestoreMocks = () => {
  snapshotListeners.clear()
  mockAddDoc.mockClear()
  mockUpdateDoc.mockClear()
  mockDeleteDoc.mockClear()
  mockGetDocs.mockClear()
  mockGetDoc.mockClear()
  mockOnSnapshot.mockClear()
}

// Reset all mocks
export const resetAllFirebaseMocks = () => {
  resetAuthMocks()
  resetFirestoreMocks()
  mockGetToken.mockClear()
  mockOnMessage.mockClear()
  mockHttpsCallable.mockClear()
}
