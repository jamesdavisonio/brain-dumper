/**
 * WorkingHours component for configuring daily working hours
 * @module components/settings/WorkingHours
 */

import type { WorkingHoursDay } from '@/types/scheduling';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Props for the WorkingHours component
 */
export interface WorkingHoursProps {
  /** Current working hours configuration */
  workingHours: WorkingHoursDay[];
  /** Callback when working hours change */
  onChange: (hours: WorkingHoursDay[]) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/** Day names for display */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Component for configuring working hours for each day of the week
 */
export function WorkingHours({ workingHours, onChange, disabled }: WorkingHoursProps) {
  /**
   * Toggle a day's enabled status
   */
  const handleToggleDay = (dayIndex: number) => {
    const updated = workingHours.map(h =>
      h.dayOfWeek === dayIndex ? { ...h, enabled: !h.enabled } : h
    );
    onChange(updated);
  };

  /**
   * Update a time field for a specific day
   */
  const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = workingHours.map(h =>
      h.dayOfWeek === dayIndex ? { ...h, [field]: value } : h
    );
    onChange(updated);
  };

  // Sort by day of week to ensure correct display order
  const sortedHours = [...workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Working Hours</h3>
        <p className="text-sm text-muted-foreground">
          Set your available hours for each day of the week
        </p>
      </div>

      <div className="space-y-3">
        {sortedHours.map((day) => (
          <div
            key={day.dayOfWeek}
            className="flex items-center gap-4 p-3 border rounded-lg"
            data-testid={`working-hours-${day.dayOfWeek}`}
          >
            <Switch
              checked={day.enabled}
              onCheckedChange={() => handleToggleDay(day.dayOfWeek)}
              disabled={disabled}
              aria-label={`Toggle ${DAY_NAMES[day.dayOfWeek]}`}
            />
            <Label className="w-24 font-medium">{DAY_NAMES[day.dayOfWeek]}</Label>

            {day.enabled ? (
              <>
                <Input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => handleTimeChange(day.dayOfWeek, 'startTime', e.target.value)}
                  disabled={disabled}
                  className="w-32"
                  aria-label={`${DAY_NAMES[day.dayOfWeek]} start time`}
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => handleTimeChange(day.dayOfWeek, 'endTime', e.target.value)}
                  disabled={disabled}
                  className="w-32"
                  aria-label={`${DAY_NAMES[day.dayOfWeek]} end time`}
                />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Not working</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
