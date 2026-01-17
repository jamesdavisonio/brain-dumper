/**
 * Calendar View Components
 * @module components/calendar
 */

// Main Calendar View
export { CalendarView, CalendarViewEmpty } from './CalendarView'
export type { CalendarViewProps } from './CalendarView'

// Header Components
export { CalendarHeader, CalendarHeaderCompact } from './CalendarHeader'
export type { CalendarHeaderProps } from './CalendarHeader'

// View Components
export { WeekView, WeekViewCompact } from './WeekView'
export type { WeekViewProps, WeekViewCompactProps } from './WeekView'

export { DayView } from './DayView'
export type { DayViewProps } from './DayView'

export { DayColumn } from './DayColumn'
export type { DayColumnProps } from './DayColumn'

// Slot Components
export { TimeSlot, TimeSlotOutsideHours } from './TimeSlot'
export type { TimeSlotProps } from './TimeSlot'

export { EventBlock, AllDayEventBlock } from './EventBlock'
export type { EventBlockProps } from './EventBlock'

// Availability Components
export {
  AvailabilityOverlay,
  AvailabilityBar,
  DayAvailabilitySummary
} from './AvailabilityOverlay'
export type {
  AvailabilityOverlayProps,
  AvailabilityBarProps,
  DayAvailabilitySummaryProps
} from './AvailabilityOverlay'

// Stats Components
export { CalendarStats, CalendarStatsInline } from './CalendarStats'
export type { CalendarStatsProps, CalendarStatsInlineProps } from './CalendarStats'

// Loading Skeletons
export {
  CalendarSkeleton,
  CalendarHeaderSkeleton,
  WeekViewSkeleton,
  DayViewSkeleton,
  WeekViewCompactSkeleton,
  CalendarStatsSkeleton
} from './CalendarSkeleton'
