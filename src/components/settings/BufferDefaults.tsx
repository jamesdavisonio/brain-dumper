/**
 * BufferDefaults component for configuring default buffer times and call slots
 * @module components/settings/BufferDefaults
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Props for the BufferDefaults component
 */
export interface BufferDefaultsProps {
  /** Default buffer time before tasks in minutes */
  bufferBefore: number;
  /** Default buffer time after tasks in minutes */
  bufferAfter: number;
  /** Whether to keep a slot free for calls */
  keepSlotFreeForCalls: boolean;
  /** Duration of call slots in minutes */
  callSlotDuration: number;
  /** Preferred time for call slots */
  callSlotPreferredTime: 'morning' | 'afternoon' | 'evening';
  /** Callback when any value changes */
  onChange: (updates: {
    defaultBufferBefore?: number;
    defaultBufferAfter?: number;
    keepSlotFreeForCalls?: boolean;
    callSlotDuration?: number;
    callSlotPreferredTime?: 'morning' | 'afternoon' | 'evening';
  }) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Component for configuring default buffer times and ad-hoc call slots
 */
export function BufferDefaults({
  bufferBefore,
  bufferAfter,
  keepSlotFreeForCalls,
  callSlotDuration,
  callSlotPreferredTime,
  onChange,
  disabled
}: BufferDefaultsProps) {
  return (
    <div className="space-y-6">
      {/* Buffer Time Section */}
      <div>
        <h3 className="text-lg font-medium">Default Buffers</h3>
        <p className="text-sm text-muted-foreground">
          Add breathing room between tasks by default
        </p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="buffer-before">Buffer Before (minutes)</Label>
            <Input
              id="buffer-before"
              type="number"
              value={bufferBefore}
              onChange={(e) => onChange({ defaultBufferBefore: parseInt(e.target.value) || 0 })}
              disabled={disabled}
              min={0}
              max={60}
              data-testid="buffer-before-input"
            />
          </div>
          <div>
            <Label htmlFor="buffer-after">Buffer After (minutes)</Label>
            <Input
              id="buffer-after"
              type="number"
              value={bufferAfter}
              onChange={(e) => onChange({ defaultBufferAfter: parseInt(e.target.value) || 0 })}
              disabled={disabled}
              min={0}
              max={60}
              data-testid="buffer-after-input"
            />
          </div>
        </div>
      </div>

      {/* Call Slot Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Ad-hoc Call Slot</h3>
        <p className="text-sm text-muted-foreground">
          Keep a slot free daily for unexpected calls
        </p>

        <div className="flex items-center gap-4">
          <Switch
            id="keep-slot-free"
            checked={keepSlotFreeForCalls}
            onCheckedChange={(checked) => onChange({ keepSlotFreeForCalls: checked })}
            disabled={disabled}
            data-testid="keep-slot-free-switch"
          />
          <Label htmlFor="keep-slot-free">Reserve daily slot for calls</Label>
        </div>

        {keepSlotFreeForCalls && (
          <div className="grid grid-cols-2 gap-4 pl-8" data-testid="call-slot-options">
            <div>
              <Label htmlFor="call-slot-duration">Slot Duration (minutes)</Label>
              <Input
                id="call-slot-duration"
                type="number"
                value={callSlotDuration}
                onChange={(e) => onChange({ callSlotDuration: parseInt(e.target.value) || 60 })}
                disabled={disabled}
                min={15}
                max={120}
                data-testid="call-slot-duration-input"
              />
            </div>
            <div>
              <Label htmlFor="call-slot-time">Preferred Time</Label>
              <Select
                value={callSlotPreferredTime}
                onValueChange={(value) => onChange({
                  callSlotPreferredTime: value as 'morning' | 'afternoon' | 'evening'
                })}
                disabled={disabled}
              >
                <SelectTrigger id="call-slot-time" data-testid="call-slot-time-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
