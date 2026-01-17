import type { User } from '@/types'

/**
 * Create a mock user object for testing
 * @param overrides - Partial user object to override default values
 * @returns Complete User object
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    ...overrides,
  }
}

/**
 * Create a mock user with minimal data (email only)
 */
export function createMockEmailUser(email: string = 'test@example.com'): User {
  return createMockUser({
    uid: `user-${email.replace('@', '-').replace('.', '-')}`,
    email,
    displayName: null,
    photoURL: null,
  })
}

/**
 * Create a mock Google user (with all fields populated)
 */
export function createMockGoogleUser(overrides: Partial<User> = {}): User {
  return createMockUser({
    uid: 'google-user-123456',
    email: 'testuser@gmail.com',
    displayName: 'Test Google User',
    photoURL: 'https://lh3.googleusercontent.com/a/test-photo-url',
    ...overrides,
  })
}

/**
 * Create an array of mock users for testing lists
 */
export function createMockUsers(count: number = 5): User[] {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      uid: `test-user-${index + 1}`,
      email: `user${index + 1}@example.com`,
      displayName: `User ${index + 1}`,
      photoURL: `https://example.com/photos/user${index + 1}.jpg`,
    })
  )
}

/**
 * Create a null user (for unauthenticated state)
 */
export function createNullUser(): null {
  return null
}

/**
 * User fixtures for common test scenarios
 */
export const userFixtures = {
  authenticated: createMockUser(),
  googleUser: createMockGoogleUser(),
  emailUser: createMockEmailUser(),
  newUser: createMockUser({
    displayName: null,
    photoURL: null,
  }),
  unauthenticated: null as User | null,
}
