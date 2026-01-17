import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AvailabilityWindow } from '@/types/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarStatsSkeleton } from './CalendarSkeleton'
import { format, differenceInDays } from 'date-fns'
import { Clock, TrendingUp, Calendar, Star } from 'lucide-react'

export interface CalendarStatsProps {
  availability: AvailabilityWindow[]
  dateRange: { start: Date; end: Date }
  isLoading?: boolean
}

/**
 * Summary statistics for calendar availability
 *
 * Shows:
 * - Total free hours this week
 * - Busiest day
 * - Best day for scheduling
 * - Average free time per day
 */
export function CalendarStats({
  availability,
  dateRange,
  isLoading = false,
}: CalendarStatsProps) {
  const stats = useMemo(() => {
    if (availability.length === 0) {
      return null
    }

    // Calculate total free and busy hours
    const totalFreeMinutes = availability.reduce((sum, a) => sum + a.totalFreeMinutes, 0)
    const totalBusyMinutes = availability.reduce((sum, a) => sum + a.totalBusyMinutes, 0)

    // Find busiest day (most busy minutes)
    const busiestDay = availability.reduce((busiest, current) =>
      current.totalBusyMinutes > (busiest?.totalBusyMinutes || 0) ? current : busiest
    , availability[0])

    // Find best day for scheduling (most free minutes)
    const bestDay = availability.reduce((best, current) =>
      current.totalFreeMinutes > (best?.totalFreeMinutes || 0) ? current : best
    , availability[0])

    // Calculate average free time per day
    const daysCount = differenceInDays(dateRange.end, dateRange.start) + 1
    const avgFreeMinutesPerDay = Math.round(totalFreeMinutes / daysCount)

    // Calculate overall availability percentage
    const totalMinutes = totalFreeMinutes + totalBusyMinutes
    const availabilityPercentage = totalMinutes > 0
      ? Math.round((totalFreeMinutes / totalMinutes) * 100)
      : 0

    return {
      totalFreeHours: Math.round(totalFreeMinutes / 60 * 10) / 10,
      totalBusyHours: Math.round(totalBusyMinutes / 60 * 10) / 10,
      busiestDay: busiestDay ? {
        date: busiestDay.date,
        busyHours: Math.round(busiestDay.totalBusyMinutes / 60 * 10) / 10
      } : null,
      bestDay: bestDay ? {
        date: bestDay.date,
        freeHours: Math.round(bestDay.totalFreeMinutes / 60 * 10) / 10
      } : null,
      avgFreeHoursPerDay: Math.round(avgFreeMinutesPerDay / 60 * 10) / 10,
      availabilityPercentage,
    }
  }, [availability, dateRange])

  if (isLoading) {
    return <CalendarStatsSkeleton />
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No availability data for this period
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
      role="region"
      aria-label="Calendar statistics"
    >
      {/* Total free hours */}
      <StatCard
        icon={Clock}
        label="Free Time"
        value={`${stats.totalFreeHours}h`}
        sublabel="this week"
        variant={stats.availabilityPercentage >= 50 ? 'success' : 'warning'}
      />

      {/* Best day */}
      <StatCard
        icon={Star}
        label="Best Day"
        value={stats.bestDay ? format(stats.bestDay.date, 'EEE') : '--'}
        sublabel={stats.bestDay ? `${stats.bestDay.freeHours}h free` : ''}
        variant="success"
      />

      {/* Busiest day */}
      <StatCard
        icon={Calendar}
        label="Busiest Day"
        value={stats.busiestDay ? format(stats.busiestDay.date, 'EEE') : '--'}
        sublabel={stats.busiestDay ? `${stats.busiestDay.busyHours}h busy` : ''}
        variant="warning"
      />

      {/* Average per day */}
      <StatCard
        icon={TrendingUp}
        label="Daily Average"
        value={`${stats.avgFreeHoursPerDay}h`}
        sublabel="free per day"
        variant="neutral"
      />
    </div>
  )
}

/**
 * Individual stat card
 */
interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string
  sublabel?: string
  variant?: 'success' | 'warning' | 'neutral'
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  variant = 'neutral',
}: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            variant === 'success' && 'bg-green-100 dark:bg-green-900/30',
            variant === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/30',
            variant === 'neutral' && 'bg-gray-100 dark:bg-gray-800'
          )}>
            <Icon className={cn(
              'h-4 w-4',
              variant === 'success' && 'text-green-600 dark:text-green-400',
              variant === 'warning' && 'text-yellow-600 dark:text-yellow-400',
              variant === 'neutral' && 'text-gray-600 dark:text-gray-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {label}
            </p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
            {sublabel && (
              <p className="text-xs text-muted-foreground truncate">
                {sublabel}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Compact inline stats
 */
export interface CalendarStatsInlineProps {
  availability: AvailabilityWindow[]
}

export function CalendarStatsInline({ availability }: CalendarStatsInlineProps) {
  const stats = useMemo(() => {
    const totalFreeMinutes = availability.reduce((sum, a) => sum + a.totalFreeMinutes, 0)
    const totalBusyMinutes = availability.reduce((sum, a) => sum + a.totalBusyMinutes, 0)
    const totalMinutes = totalFreeMinutes + totalBusyMinutes

    return {
      freeHours: Math.round(totalFreeMinutes / 60 * 10) / 10,
      busyHours: Math.round(totalBusyMinutes / 60 * 10) / 10,
      percentage: totalMinutes > 0
        ? Math.round((totalFreeMinutes / totalMinutes) * 100)
        : 0
    }
  }, [availability])

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className={cn(
        'font-medium',
        stats.percentage >= 50 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
      )}>
        {stats.percentage}% available
      </span>
      <span className="text-muted-foreground">
        {stats.freeHours}h free / {stats.busyHours}h busy
      </span>
    </div>
  )
}
