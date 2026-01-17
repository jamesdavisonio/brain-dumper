import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for calendar views
 * Shows:
 * - Header placeholder
 * - 7 column placeholders with pulsing rows
 */
export function CalendarSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading calendar">
      {/* Header skeleton */}
      <CalendarHeaderSkeleton />

      {/* Week view skeleton */}
      <WeekViewSkeleton />
    </div>
  )
}

/**
 * Calendar header loading skeleton
 */
export function CalendarHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2">
      {/* Date navigation skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10" /> {/* Previous button */}
        <Skeleton className="h-6 w-40" /> {/* Date display */}
        <Skeleton className="h-10 w-10" /> {/* Next button */}
        <Skeleton className="h-10 w-16 ml-2" /> {/* Today button */}
      </div>

      {/* View mode toggle skeleton */}
      <Skeleton className="h-10 w-32" />
    </div>
  )
}

/**
 * Week view loading skeleton
 */
export function WeekViewSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex">
        {/* Time labels column */}
        <div className="w-14 flex-shrink-0 border-r bg-muted/20">
          {/* Empty header space */}
          <div className="h-[72px] border-b" />
          {/* Time label skeletons */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 flex items-center justify-end px-1">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>

        {/* Day columns */}
        {Array.from({ length: 7 }).map((_, dayIndex) => (
          <div
            key={dayIndex}
            className="flex-1 min-w-[100px] border-r last:border-r-0"
          >
            {/* Day header */}
            <div className="h-[72px] border-b p-2 flex flex-col items-center justify-center gap-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>

            {/* Time slots */}
            {Array.from({ length: 10 }).map((_, slotIndex) => (
              <div key={slotIndex} className="h-10 p-1">
                {/* Random events skeleton (show on some slots) */}
                {Math.random() > 0.7 && (
                  <Skeleton className="h-8 w-full" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Day view loading skeleton
 */
export function DayViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Compact header skeleton */}
      <div className="flex items-center justify-between py-2">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-10" />
      </div>

      {/* Day card skeleton */}
      <div className="border rounded-lg bg-card">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-2 w-full mt-2" />
        </div>

        {/* Time slots */}
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-12 w-16 flex-shrink-0" />
              <Skeleton className="h-12 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact week view loading skeleton (mobile)
 */
export function WeekViewCompactSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1 p-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center p-2 gap-1">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-1 w-full mt-1" />
        </div>
      ))}
    </div>
  )
}

/**
 * Calendar stats loading skeleton
 */
export function CalendarStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}
