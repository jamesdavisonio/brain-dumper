/**
 * Scheduling context for sharing scheduling state across components
 * Provides active proposal, scheduling task, and refresh triggers
 * @module context/SchedulingContext
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import type { ScheduleProposal } from '@/services/scheduling'

/**
 * Scheduling context type definition
 */
export interface SchedulingContextType {
  // Active proposal (from brain dump flow)
  /** Currently active schedule proposal being reviewed */
  activeProposal: ScheduleProposal | null
  /** Set the active schedule proposal */
  setActiveProposal: (proposal: ScheduleProposal | null) => void

  // Currently scheduling task (for modals)
  /** ID of the task currently being scheduled (for modal state) */
  schedulingTaskId: string | null
  /** Set the task ID being scheduled */
  setSchedulingTaskId: (taskId: string | null) => void

  // Refresh trigger
  /** Trigger a refresh of scheduled tasks */
  refreshScheduledTasks: () => void
  /** Counter that increments on each refresh trigger */
  refreshCounter: number
}

const SchedulingContext = createContext<SchedulingContextType | null>(null)

/**
 * Props for the SchedulingProvider component
 */
interface SchedulingProviderProps {
  children: ReactNode
}

/**
 * Provider component for scheduling context
 * Wraps the application to provide scheduling state management
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <CalendarProvider>
 *         <SchedulingProvider>
 *           <TaskProvider>
 *             <Routes />
 *           </TaskProvider>
 *         </SchedulingProvider>
 *       </CalendarProvider>
 *     </AuthProvider>
 *   );
 * }
 * ```
 */
export function SchedulingProvider({ children }: SchedulingProviderProps) {
  // Active proposal state
  const [activeProposal, setActiveProposalState] = useState<ScheduleProposal | null>(null)

  // Currently scheduling task
  const [schedulingTaskId, setSchedulingTaskIdState] = useState<string | null>(null)

  // Refresh counter for triggering updates
  const [refreshCounter, setRefreshCounter] = useState(0)

  /**
   * Set the active schedule proposal
   */
  const setActiveProposal = useCallback((proposal: ScheduleProposal | null): void => {
    setActiveProposalState(proposal)
  }, [])

  /**
   * Set the task ID being scheduled
   */
  const setSchedulingTaskId = useCallback((taskId: string | null): void => {
    setSchedulingTaskIdState(taskId)
  }, [])

  /**
   * Trigger a refresh of scheduled tasks
   * Components can listen to refreshCounter to know when to refetch
   */
  const refreshScheduledTasks = useCallback((): void => {
    setRefreshCounter((prev) => prev + 1)
  }, [])

  const value = useMemo(
    (): SchedulingContextType => ({
      activeProposal,
      setActiveProposal,
      schedulingTaskId,
      setSchedulingTaskId,
      refreshScheduledTasks,
      refreshCounter,
    }),
    [
      activeProposal,
      setActiveProposal,
      schedulingTaskId,
      setSchedulingTaskId,
      refreshScheduledTasks,
      refreshCounter,
    ]
  )

  return (
    <SchedulingContext.Provider value={value}>
      {children}
    </SchedulingContext.Provider>
  )
}

/**
 * Hook to access the scheduling context
 *
 * @throws Error if used outside of SchedulingProvider
 * @returns SchedulingContextType - Scheduling state and actions
 *
 * @example
 * ```tsx
 * function ScheduleModal() {
 *   const { schedulingTaskId, setSchedulingTaskId } = useSchedulingContext();
 *
 *   if (!schedulingTaskId) return null;
 *
 *   return (
 *     <Modal onClose={() => setSchedulingTaskId(null)}>
 *       <TaskSchedulePanel taskId={schedulingTaskId} />
 *     </Modal>
 *   );
 * }
 * ```
 */
export function useSchedulingContext(): SchedulingContextType {
  const context = useContext(SchedulingContext)
  if (!context) {
    throw new Error('useSchedulingContext must be used within a SchedulingProvider')
  }
  return context
}

/**
 * Optional hook to access the scheduling context
 * Returns null if used outside of SchedulingProvider instead of throwing
 *
 * @returns SchedulingContextType | null
 *
 * @example
 * ```tsx
 * function MaybeScheduleButton() {
 *   const context = useSchedulingContextOptional();
 *
 *   if (!context) {
 *     // Not wrapped in SchedulingProvider, render without scheduling
 *     return null;
 *   }
 *
 *   return (
 *     <button onClick={() => context.setSchedulingTaskId(taskId)}>
 *       Schedule
 *     </button>
 *   );
 * }
 * ```
 */
export function useSchedulingContextOptional(): SchedulingContextType | null {
  return useContext(SchedulingContext)
}
