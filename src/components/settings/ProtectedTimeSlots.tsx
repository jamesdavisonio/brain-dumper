/**
 * ProtectedTimeSlots component for managing protected time slots
 * @module components/settings/ProtectedTimeSlots
 */

import { useState } from 'react';
import type { ProtectedTimeSlotConfig } from '@/types/scheduling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';

/**
 * Props for the ProtectedTimeSlots component
 */
export interface ProtectedTimeSlotsProps {
  /** Current protected time slots */
  slots: ProtectedTimeSlotConfig[];
  /** Callback to add a new slot */
  onAdd: (slot: Omit<ProtectedTimeSlotConfig, 'id'>) => void;
  /** Callback to remove a slot */
  onRemove: (slotId: string) => void;
  /** Callback to update a slot */
  onUpdate: (slot: ProtectedTimeSlotConfig) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/** Options for recurrence patterns */
const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays only' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom days' }
];

/** Day abbreviations for weekly selection */
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Default new slot values */
const DEFAULT_NEW_SLOT: Omit<ProtectedTimeSlotConfig, 'id'> = {
  name: '',
  recurrence: 'daily',
  startTime: '12:00',
  endTime: '13:00',
  enabled: true
};

/**
 * Component for managing protected time slots
 * Protected slots are times that should not be used for scheduling
 */
export function ProtectedTimeSlots({
  slots,
  onAdd,
  onRemove,
  onUpdate,
  disabled
}: ProtectedTimeSlotsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSlot, setNewSlot] = useState<Omit<ProtectedTimeSlotConfig, 'id'>>(DEFAULT_NEW_SLOT);

  /**
   * Handle adding a new slot
   */
  const handleAdd = () => {
    if (newSlot.name.trim()) {
      onAdd(newSlot);
      setNewSlot(DEFAULT_NEW_SLOT);
      setIsAdding(false);
    }
  };

  /**
   * Handle canceling add mode
   */
  const handleCancelAdd = () => {
    setNewSlot(DEFAULT_NEW_SLOT);
    setIsAdding(false);
  };

  /**
   * Toggle day selection for weekly/custom recurrence
   */
  const toggleDay = (dayIndex: number) => {
    const days = newSlot.dayOfWeek || [];
    const updated = days.includes(dayIndex)
      ? days.filter(d => d !== dayIndex)
      : [...days, dayIndex].sort();
    setNewSlot({ ...newSlot, dayOfWeek: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Protected Time Slots</h3>
          <p className="text-sm text-muted-foreground">
            Block off times that should never be scheduled
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          disabled={disabled || isAdding}
          size="sm"
          data-testid="add-slot-button"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Slot
        </Button>
      </div>

      {/* Add New Slot Form */}
      {isAdding && (
        <Card data-testid="new-slot-form">
          <CardContent className="pt-4 space-y-4">
            <div>
              <Label htmlFor="slot-name">Name</Label>
              <Input
                id="slot-name"
                value={newSlot.name}
                onChange={(e) => setNewSlot({ ...newSlot, name: e.target.value })}
                placeholder="e.g., Lunch break"
                disabled={disabled}
                data-testid="slot-name-input"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="slot-recurrence">Recurrence</Label>
                <Select
                  value={newSlot.recurrence}
                  onValueChange={(value) => setNewSlot({
                    ...newSlot,
                    recurrence: value as ProtectedTimeSlotConfig['recurrence'],
                    dayOfWeek: value === 'weekly' || value === 'custom' ? [] : undefined
                  })}
                  disabled={disabled}
                >
                  <SelectTrigger id="slot-recurrence" data-testid="slot-recurrence-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="slot-start-time">Start Time</Label>
                <Input
                  id="slot-start-time"
                  type="time"
                  value={newSlot.startTime}
                  onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                  disabled={disabled}
                  data-testid="slot-start-time-input"
                />
              </div>
              <div>
                <Label htmlFor="slot-end-time">End Time</Label>
                <Input
                  id="slot-end-time"
                  type="time"
                  value={newSlot.endTime}
                  onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                  disabled={disabled}
                  data-testid="slot-end-time-input"
                />
              </div>
            </div>

            {/* Day selection for weekly/custom recurrence */}
            {(newSlot.recurrence === 'weekly' || newSlot.recurrence === 'custom') && (
              <div>
                <Label>Days of Week</Label>
                <div className="flex gap-2 mt-2">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <Button
                      key={day}
                      variant={newSlot.dayOfWeek?.includes(index) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleDay(index)}
                      disabled={disabled}
                      data-testid={`day-button-${index}`}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={!newSlot.name.trim() || disabled}
                data-testid="confirm-add-slot"
              >
                Add Protected Slot
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelAdd}
                data-testid="cancel-add-slot"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Slots List */}
      <div className="space-y-2">
        {slots.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="no-slots-message">
            No protected time slots configured
          </p>
        )}

        {slots.map((slot) => (
          <Card key={slot.id} data-testid={`protected-slot-${slot.id}`}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Switch
                  checked={slot.enabled}
                  onCheckedChange={(enabled) => onUpdate({ ...slot, enabled })}
                  disabled={disabled}
                  aria-label={`Toggle ${slot.name}`}
                  data-testid={`toggle-slot-${slot.id}`}
                />
                <div>
                  <p className="font-medium">{slot.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {RECURRENCE_OPTIONS.find(o => o.value === slot.recurrence)?.label} |{' '}
                    {slot.startTime} - {slot.endTime}
                    {slot.dayOfWeek && slot.dayOfWeek.length > 0 && (
                      <> | {slot.dayOfWeek.map(d => DAYS_OF_WEEK[d]).join(', ')}</>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(slot.id)}
                disabled={disabled}
                aria-label={`Remove ${slot.name}`}
                data-testid={`remove-slot-${slot.id}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
