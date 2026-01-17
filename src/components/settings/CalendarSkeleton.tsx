import { Skeleton } from '@/components/ui/skeleton'

interface CalendarSkeletonProps {
  count?: number
}

function CalendarSkeletonItem() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-transparent">
      {/* Color dot skeleton */}
      <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />

      {/* Name skeleton */}
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Type selector skeleton */}
      <Skeleton className="h-8 w-[100px]" />

      {/* Switch skeleton */}
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  )
}

export function CalendarSkeleton({ count = 3 }: CalendarSkeletonProps) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading calendars">
      {Array.from({ length: count }).map((_, index) => (
        <CalendarSkeletonItem key={index} />
      ))}
      <span className="sr-only">Loading calendar list...</span>
    </div>
  )
}
