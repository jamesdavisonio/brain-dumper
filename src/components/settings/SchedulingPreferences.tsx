/**
 * SchedulingPreferences component - main page for scheduling preferences
 * @module components/settings/SchedulingPreferences
 */

import { useState, useEffect } from 'react';
import { useSchedulingPreferences } from '@/hooks/useSchedulingPreferences';
import { WorkingHours } from './WorkingHours';
import { TaskTypeRules } from './TaskTypeRules';
import { ProtectedTimeSlots } from './ProtectedTimeSlots';
import { BufferDefaults } from './BufferDefaults';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, AlertCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { WorkingHoursDay } from '@/types/scheduling';

/**
 * Main preferences page component
 * Organizes scheduling preferences into tabs for easy navigation
 */
export function SchedulingPreferences() {
  const {
    preferences,
    loading,
    error,
    updatePreferences,
    setWorkingHours,
    setTaskTypeRule,
    addSlot,
    removeSlot,
    updateSlot,
    reset
  } = useSchedulingPreferences();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localWorkingHours, setLocalWorkingHours] = useState<WorkingHoursDay[] | null>(null);
  const [hasWorkingHoursChanges, setHasWorkingHoursChanges] = useState(false);

  // Update local state when preferences load
  useEffect(() => {
    if (preferences?.workingHours) {
      setLocalWorkingHours(preferences.workingHours);
      setHasWorkingHoursChanges(false);
    }
  }, [preferences?.workingHours]);

  /**
   * Handle local working hours change (for optimistic UI)
   */
  const handleWorkingHoursChange = (hours: WorkingHoursDay[]) => {
    setLocalWorkingHours(hours);
    setHasWorkingHoursChanges(true);
  };

  /**
   * Save working hours to server
   */
  const handleSaveWorkingHours = async () => {
    if (!localWorkingHours) return;

    setSaving(true);
    setSaveError(null);
    try {
      await setWorkingHours(localWorkingHours);
      setHasWorkingHoursChanges(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save working hours';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reset working hours to last saved state
   */
  const handleResetWorkingHours = () => {
    if (preferences?.workingHours) {
      setLocalWorkingHours(preferences.workingHours);
      setHasWorkingHoursChanges(false);
    }
  };

  /**
   * Handle buffer/call slot changes
   */
  const handleBufferChange = async (updates: {
    defaultBufferBefore?: number;
    defaultBufferAfter?: number;
    keepSlotFreeForCalls?: boolean;
    callSlotDuration?: number;
    callSlotPreferredTime?: 'morning' | 'afternoon' | 'evening';
  }) => {
    setSaving(true);
    setSaveError(null);
    try {
      await updatePreferences(updates);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle reset to defaults
   */
  const handleResetAll = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await reset();
      setHasWorkingHoursChanges(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset preferences';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loading-state">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" data-testid="error-state">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load preferences: {error}</AlertDescription>
      </Alert>
    );
  }

  // Not authenticated state
  if (!preferences) {
    return (
      <Alert data-testid="unauthenticated-state">
        <AlertDescription>Please sign in to manage scheduling preferences</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="scheduling-preferences">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scheduling Preferences</h2>
          <p className="text-muted-foreground">
            Customize how Brain Dumper schedules your tasks
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleResetAll}
          disabled={saving}
          data-testid="reset-all-button"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <Alert variant="destructive" data-testid="save-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="hours" className="space-y-6">
        <TabsList>
          <TabsTrigger value="hours" data-testid="hours-tab">Working Hours</TabsTrigger>
          <TabsTrigger value="rules" data-testid="rules-tab">Task Rules</TabsTrigger>
          <TabsTrigger value="protected" data-testid="protected-tab">Protected Slots</TabsTrigger>
          <TabsTrigger value="buffers" data-testid="buffers-tab">Buffers & Calls</TabsTrigger>
        </TabsList>

        {/* Working Hours Tab */}
        <TabsContent value="hours" className="space-y-4" data-testid="hours-content">
          {localWorkingHours && (
            <>
              <WorkingHours
                workingHours={localWorkingHours}
                onChange={handleWorkingHoursChange}
                disabled={saving}
              />
              {hasWorkingHoursChanges && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveWorkingHours}
                    disabled={saving}
                    data-testid="save-working-hours"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save Working Hours
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResetWorkingHours}
                    disabled={saving}
                    data-testid="reset-working-hours"
                  >
                    Reset Changes
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Task Rules Tab */}
        <TabsContent value="rules" data-testid="rules-content">
          <TaskTypeRules
            rules={preferences.taskTypeRules}
            onUpdate={setTaskTypeRule}
            disabled={saving}
          />
        </TabsContent>

        {/* Protected Slots Tab */}
        <TabsContent value="protected" data-testid="protected-content">
          <ProtectedTimeSlots
            slots={preferences.protectedSlots}
            onAdd={addSlot}
            onRemove={removeSlot}
            onUpdate={updateSlot}
            disabled={saving}
          />
        </TabsContent>

        {/* Buffers & Calls Tab */}
        <TabsContent value="buffers" data-testid="buffers-content">
          <BufferDefaults
            bufferBefore={preferences.defaultBufferBefore}
            bufferAfter={preferences.defaultBufferAfter}
            keepSlotFreeForCalls={preferences.keepSlotFreeForCalls}
            callSlotDuration={preferences.callSlotDuration}
            callSlotPreferredTime={preferences.callSlotPreferredTime}
            onChange={handleBufferChange}
            disabled={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
