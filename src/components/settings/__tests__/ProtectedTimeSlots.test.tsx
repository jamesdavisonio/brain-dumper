/**
 * Unit tests for ProtectedTimeSlots component
 * @module components/settings/__tests__/ProtectedTimeSlots.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProtectedTimeSlots } from '../ProtectedTimeSlots';
import type { ProtectedTimeSlotConfig } from '@/types/scheduling';

// Helper to create sample slots
function createSampleSlots(): ProtectedTimeSlotConfig[] {
  return [
    { id: 'slot-1', name: 'Lunch Break', recurrence: 'daily', startTime: '12:00', endTime: '13:00', enabled: true },
    { id: 'slot-2', name: 'Exercise', recurrence: 'weekdays', startTime: '18:00', endTime: '19:00', enabled: true }
  ];
}

describe('ProtectedTimeSlots', () => {
  describe('rendering', () => {
    it('renders heading and description', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByText('Protected Time Slots')).toBeInTheDocument();
      expect(screen.getByText(/Block off times/)).toBeInTheDocument();
    });

    it('renders add slot button', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByTestId('add-slot-button')).toBeInTheDocument();
    });

    it('shows empty state message when no slots', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByTestId('no-slots-message')).toBeInTheDocument();
      expect(screen.getByText(/No protected time slots configured/)).toBeInTheDocument();
    });

    it('renders existing slots', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByText('Lunch Break')).toBeInTheDocument();
      expect(screen.getByText('Exercise')).toBeInTheDocument();
    });

    it('shows slot details', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByText(/Every day/)).toBeInTheDocument();
      expect(screen.getByText(/12:00 - 13:00/)).toBeInTheDocument();
    });

    it('shows switch for each slot', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(2);
    });

    it('shows remove button for each slot', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByTestId('remove-slot-slot-1')).toBeInTheDocument();
      expect(screen.getByTestId('remove-slot-slot-2')).toBeInTheDocument();
    });
  });

  describe('adding slots', () => {
    it('shows add form when add button is clicked', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      const addButton = screen.getByTestId('add-slot-button');
      fireEvent.click(addButton);

      expect(screen.getByTestId('new-slot-form')).toBeInTheDocument();
    });

    it('shows name input in add form', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));

      expect(screen.getByTestId('slot-name-input')).toBeInTheDocument();
    });

    it('shows recurrence select in add form', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));

      expect(screen.getByTestId('slot-recurrence-select')).toBeInTheDocument();
    });

    it('shows time inputs in add form', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));

      expect(screen.getByTestId('slot-start-time-input')).toBeInTheDocument();
      expect(screen.getByTestId('slot-end-time-input')).toBeInTheDocument();
    });

    it('shows confirm and cancel buttons in add form', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));

      expect(screen.getByTestId('confirm-add-slot')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-add-slot')).toBeInTheDocument();
    });

    it('calls onAdd with new slot data', () => {
      const onAdd = vi.fn();
      const props = { slots: [], onAdd, onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));

      const nameInput = screen.getByTestId('slot-name-input');
      fireEvent.change(nameInput, { target: { value: 'Lunch' } });

      fireEvent.click(screen.getByTestId('confirm-add-slot'));

      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Lunch',
        recurrence: 'daily',
        enabled: true
      }));
    });

    it('closes form after adding', () => {
      const onAdd = vi.fn();
      const props = { slots: [], onAdd, onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));
      fireEvent.change(screen.getByTestId('slot-name-input'), { target: { value: 'Lunch' } });
      fireEvent.click(screen.getByTestId('confirm-add-slot'));

      expect(screen.queryByTestId('new-slot-form')).not.toBeInTheDocument();
    });

    it('cancels adding when cancel button is clicked', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));
      fireEvent.click(screen.getByTestId('cancel-add-slot'));

      expect(screen.queryByTestId('new-slot-form')).not.toBeInTheDocument();
    });

    it('disables confirm button when name is empty', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('add-slot-button'));

      expect(screen.getByTestId('confirm-add-slot')).toBeDisabled();
    });
  });

  describe('removing slots', () => {
    it('calls onRemove when remove button is clicked', () => {
      const onRemove = vi.fn();
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove, onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('remove-slot-slot-1'));

      expect(onRemove).toHaveBeenCalledWith('slot-1');
    });
  });

  describe('toggling slots', () => {
    it('calls onUpdate when slot is toggled', () => {
      const onUpdate = vi.fn();
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate };
      render(<ProtectedTimeSlots {...props} />);

      fireEvent.click(screen.getByTestId('toggle-slot-slot-1'));

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        id: 'slot-1',
        enabled: false
      }));
    });
  });

  describe('disabled state', () => {
    it('disables add button when disabled', () => {
      const props = { slots: [], onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn(), disabled: true };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByTestId('add-slot-button')).toBeDisabled();
    });

    it('disables remove buttons when disabled', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn(), disabled: true };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByTestId('remove-slot-slot-1')).toBeDisabled();
    });

    it('disables toggle switches when disabled', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn(), disabled: true };
      render(<ProtectedTimeSlots {...props} />);

      const switches = screen.getAllByRole('switch');
      switches.forEach(switchEl => {
        expect(switchEl).toBeDisabled();
      });
    });
  });

  describe('test ids', () => {
    it('has test ids for slot cards', () => {
      const props = { slots: createSampleSlots(), onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
      render(<ProtectedTimeSlots {...props} />);

      expect(screen.getByTestId('protected-slot-slot-1')).toBeInTheDocument();
      expect(screen.getByTestId('protected-slot-slot-2')).toBeInTheDocument();
    });
  });
});
