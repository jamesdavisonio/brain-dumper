/**
 * Unit tests for TaskTypeRules component
 * @module components/settings/__tests__/TaskTypeRules.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskTypeRules } from '../TaskTypeRules';
import type { TaskTypeRule } from '@/types/scheduling';

// Helper to create default rules
function createDefaultRules(): TaskTypeRule[] {
  return [
    { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 },
    { taskType: 'coding', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 },
    { taskType: 'call', preferredTimeOfDay: 'afternoon', defaultDuration: 30, bufferBefore: 15, bufferAfter: 15 },
    { taskType: 'meeting', preferredTimeOfDay: 'afternoon', defaultDuration: 60, bufferBefore: 10, bufferAfter: 10 },
    { taskType: 'personal', preferredTimeOfDay: 'flexible', defaultDuration: 60, bufferBefore: 0, bufferAfter: 0 }
  ];
}

describe('TaskTypeRules', () => {
  describe('rendering', () => {
    it('renders heading and description', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      expect(screen.getByText('Task Type Rules')).toBeInTheDocument();
      expect(screen.getByText(/Customize scheduling preferences/)).toBeInTheDocument();
    });

    it('renders cards for all task types', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      expect(screen.getByText('Deep Work')).toBeInTheDocument();
      expect(screen.getByText('Coding')).toBeInTheDocument();
      expect(screen.getByText('Calls')).toBeInTheDocument();
      expect(screen.getByText('Meetings')).toBeInTheDocument();
      expect(screen.getByText('Personal Tasks')).toBeInTheDocument();
    });

    it('shows edit button for each rule', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons).toHaveLength(5);
    });

    it('displays rule summary when not editing', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      // Deep work should show morning preference (check for partial match)
      expect(screen.getAllByText(/Morning/)[0]).toBeInTheDocument();
      // Call should show buffers
      expect(screen.getByText(/15\/15 min buffers/)).toBeInTheDocument();
    });

    it('shows "No buffers" when buffer times are 0', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      // Personal tasks have no buffers
      expect(screen.getByText(/No buffers/)).toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('shows edit form when edit button is clicked', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      expect(screen.getByLabelText(/Preferred Time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Default Duration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Buffer Before/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Buffer After/i)).toBeInTheDocument();
    });

    it('shows save and cancel buttons when editing', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      expect(screen.getByTestId('save-rule-deep_work')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-rule-deep_work')).toBeInTheDocument();
    });

    it('cancels editing when cancel button is clicked', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      const cancelButton = screen.getByTestId('cancel-rule-deep_work');
      fireEvent.click(cancelButton);

      // Form should be hidden, edit button should be visible again
      expect(screen.queryByTestId('save-rule-deep_work')).not.toBeInTheDocument();
      expect(screen.getByTestId('edit-rule-deep_work')).toBeInTheDocument();
    });

    it('calls onUpdate when save button is clicked', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      const saveButton = screen.getByTestId('save-rule-deep_work');
      fireEvent.click(saveButton);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        taskType: 'deep_work'
      }));
    });

    it('updates duration when changed', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      const durationInput = screen.getByLabelText(/Default Duration/i);
      fireEvent.change(durationInput, { target: { value: '90' } });

      const saveButton = screen.getByTestId('save-rule-deep_work');
      fireEvent.click(saveButton);

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        taskType: 'deep_work',
        defaultDuration: 90
      }));
    });

    it('updates buffer before when changed', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      const bufferBeforeInput = screen.getByLabelText(/Buffer Before/i);
      fireEvent.change(bufferBeforeInput, { target: { value: '10' } });

      const saveButton = screen.getByTestId('save-rule-deep_work');
      fireEvent.click(saveButton);

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        taskType: 'deep_work',
        bufferBefore: 10
      }));
    });

    it('updates buffer after when changed', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      const editButton = screen.getByTestId('edit-rule-deep_work');
      fireEvent.click(editButton);

      const bufferAfterInput = screen.getByLabelText(/Buffer After/i);
      fireEvent.change(bufferAfterInput, { target: { value: '20' } });

      const saveButton = screen.getByTestId('save-rule-deep_work');
      fireEvent.click(saveButton);

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        taskType: 'deep_work',
        bufferAfter: 20
      }));
    });
  });

  describe('disabled state', () => {
    it('disables edit buttons when disabled prop is true', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} disabled />);

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      editButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('test ids', () => {
    it('has test ids for each task rule card', () => {
      const onUpdate = vi.fn();
      render(<TaskTypeRules rules={createDefaultRules()} onUpdate={onUpdate} />);

      expect(screen.getByTestId('task-rule-deep_work')).toBeInTheDocument();
      expect(screen.getByTestId('task-rule-coding')).toBeInTheDocument();
      expect(screen.getByTestId('task-rule-call')).toBeInTheDocument();
    });
  });
});
