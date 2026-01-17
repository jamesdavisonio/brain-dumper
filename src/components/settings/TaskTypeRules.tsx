/**
 * TaskTypeRules component for configuring per-task-type scheduling rules
 * @module components/settings/TaskTypeRules
 */

import { useState } from 'react';
import type { TaskTypeRule, TaskType } from '@/types/scheduling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Props for the TaskTypeRules component
 */
export interface TaskTypeRulesProps {
  /** Current task type rules */
  rules: TaskTypeRule[];
  /** Callback when a rule is updated */
  onUpdate: (rule: TaskTypeRule) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/** Human-readable labels for task types */
const TASK_TYPE_LABELS: Record<TaskType, string> = {
  deep_work: 'Deep Work',
  coding: 'Coding',
  call: 'Calls',
  meeting: 'Meetings',
  personal: 'Personal Tasks',
  admin: 'Admin Tasks',
  health: 'Health & Exercise',
  other: 'Other'
};

/** Options for preferred time of day */
const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: 'Morning (before noon)' },
  { value: 'afternoon', label: 'Afternoon (noon - 5pm)' },
  { value: 'evening', label: 'Evening (after 5pm)' },
  { value: 'flexible', label: 'Flexible (any time)' }
];

/**
 * Component for configuring scheduling rules for each task type
 */
export function TaskTypeRules({ rules, onUpdate, disabled }: TaskTypeRulesProps) {
  const [editingType, setEditingType] = useState<TaskType | null>(null);
  const [editedRule, setEditedRule] = useState<TaskTypeRule | null>(null);

  /**
   * Start editing a rule
   */
  const handleEdit = (rule: TaskTypeRule) => {
    setEditingType(rule.taskType);
    setEditedRule({ ...rule });
  };

  /**
   * Save the edited rule
   */
  const handleSave = () => {
    if (editedRule) {
      onUpdate(editedRule);
      setEditingType(null);
      setEditedRule(null);
    }
  };

  /**
   * Cancel editing
   */
  const handleCancel = () => {
    setEditingType(null);
    setEditedRule(null);
  };

  // Sort rules by task type for consistent display
  const sortedRules = [...rules].sort((a, b) =>
    TASK_TYPE_LABELS[a.taskType].localeCompare(TASK_TYPE_LABELS[b.taskType])
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Task Type Rules</h3>
        <p className="text-sm text-muted-foreground">
          Customize scheduling preferences for each type of task
        </p>
      </div>

      <div className="grid gap-4">
        {sortedRules.map((rule) => (
          <Card key={rule.taskType} data-testid={`task-rule-${rule.taskType}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{TASK_TYPE_LABELS[rule.taskType]}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingType === rule.taskType && editedRule ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`preferred-time-${rule.taskType}`}>Preferred Time</Label>
                      <Select
                        value={editedRule.preferredTimeOfDay}
                        onValueChange={(value) => setEditedRule({
                          ...editedRule,
                          preferredTimeOfDay: value as TaskTypeRule['preferredTimeOfDay']
                        })}
                        disabled={disabled}
                      >
                        <SelectTrigger id={`preferred-time-${rule.taskType}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OF_DAY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`duration-${rule.taskType}`}>Default Duration (min)</Label>
                      <Input
                        id={`duration-${rule.taskType}`}
                        type="number"
                        value={editedRule.defaultDuration}
                        onChange={(e) => setEditedRule({
                          ...editedRule,
                          defaultDuration: parseInt(e.target.value) || 30
                        })}
                        disabled={disabled}
                        min={5}
                        max={480}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`buffer-before-${rule.taskType}`}>Buffer Before (min)</Label>
                      <Input
                        id={`buffer-before-${rule.taskType}`}
                        type="number"
                        value={editedRule.bufferBefore}
                        onChange={(e) => setEditedRule({
                          ...editedRule,
                          bufferBefore: parseInt(e.target.value) || 0
                        })}
                        disabled={disabled}
                        min={0}
                        max={60}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`buffer-after-${rule.taskType}`}>Buffer After (min)</Label>
                      <Input
                        id={`buffer-after-${rule.taskType}`}
                        type="number"
                        value={editedRule.bufferAfter}
                        onChange={(e) => setEditedRule({
                          ...editedRule,
                          bufferAfter: parseInt(e.target.value) || 0
                        })}
                        disabled={disabled}
                        min={0}
                        max={60}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm" data-testid={`save-rule-${rule.taskType}`}>
                      Save
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm" data-testid={`cancel-rule-${rule.taskType}`}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {TIME_OF_DAY_OPTIONS.find(o => o.value === rule.preferredTimeOfDay)?.label} |{' '}
                    {rule.defaultDuration} min |{' '}
                    {rule.bufferBefore > 0 || rule.bufferAfter > 0
                      ? `${rule.bufferBefore}/${rule.bufferAfter} min buffers`
                      : 'No buffers'}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(rule)}
                    disabled={disabled}
                    data-testid={`edit-rule-${rule.taskType}`}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
