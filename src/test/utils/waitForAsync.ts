import { waitFor, screen } from '@testing-library/react'

/**
 * Wait for loading state to finish
 * Looks for common loading indicators and waits for them to disappear
 */
export async function waitForLoadingToFinish(): Promise<void> {
  // Wait for any loading text or spinners to disappear
  await waitFor(
    () => {
      const loadingElements = screen.queryAllByText(/loading/i)
      const spinners = screen.queryAllByRole('progressbar')
      const skeletons = document.querySelectorAll('[data-loading="true"]')

      if (
        loadingElements.length > 0 ||
        spinners.length > 0 ||
        skeletons.length > 0
      ) {
        throw new Error('Still loading')
      }
    },
    { timeout: 5000 }
  )
}

/**
 * Wait for a specific element to appear
 */
export async function waitForElement(
  selector: string,
  options: { timeout?: number } = {}
): Promise<Element> {
  const { timeout = 5000 } = options

  return waitFor(
    () => {
      const element = document.querySelector(selector)
      if (!element) {
        throw new Error(`Element not found: ${selector}`)
      }
      return element
    },
    { timeout }
  )
}

/**
 * Wait for a specific text to appear
 */
export async function waitForText(
  text: string | RegExp,
  options: { timeout?: number } = {}
): Promise<HTMLElement> {
  const { timeout = 5000 } = options

  return waitFor(
    () => {
      const element = screen.getByText(text)
      return element
    },
    { timeout }
  )
}

/**
 * Wait for an element to disappear
 */
export async function waitForElementToDisappear(
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options

  await waitFor(
    () => {
      const element = document.querySelector(selector)
      if (element) {
        throw new Error(`Element still present: ${selector}`)
      }
    },
    { timeout }
  )
}

/**
 * Wait for text to disappear
 */
export async function waitForTextToDisappear(
  text: string | RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options

  await waitFor(
    () => {
      const element = screen.queryByText(text)
      if (element) {
        throw new Error(`Text still present: ${text}`)
      }
    },
    { timeout }
  )
}

/**
 * Wait for a mock function to be called
 */
export async function waitForMockCall(
  mockFn: jest.Mock | ReturnType<typeof import('vitest').vi.fn>,
  options: { timeout?: number; times?: number } = {}
): Promise<void> {
  const { timeout = 5000, times = 1 } = options

  await waitFor(
    () => {
      if (mockFn.mock.calls.length < times) {
        throw new Error(
          `Mock not called enough times. Expected: ${times}, Actual: ${mockFn.mock.calls.length}`
        )
      }
    },
    { timeout }
  )
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options

  await waitFor(
    () => {
      if (!condition()) {
        throw new Error('Condition not met')
      }
    },
    { timeout, interval }
  )
}

/**
 * Wait for async state update
 * Useful when waiting for React state updates after async operations
 */
export async function waitForStateUpdate(): Promise<void> {
  await waitFor(() => {
    // Small delay to allow state updates to propagate
    return true
  })
}

/**
 * Wait for network request to complete (using MSW)
 * Note: This is a simple delay-based approach. For more precise control,
 * use MSW's network delay features or track requests manually.
 */
export async function waitForNetworkIdle(delay: number = 100): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Wait for animation frame
 * Useful when testing animations or transitions
 */
export async function waitForAnimationFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

/**
 * Wait for multiple animation frames
 */
export async function waitForAnimationFrames(count: number = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await waitForAnimationFrame()
  }
}

/**
 * Flush all pending promises
 * Useful when you need to wait for all microtasks to complete
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Wait with timeout helper
 * Returns a promise that rejects after timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeout)
    ),
  ])
}
