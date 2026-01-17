/**
 * Unit tests for WorkingHours component
 * @module components/settings/__tests__/WorkingHours.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkingHours } from '../WorkingHours';
import type { WorkingHoursDay } from '@/types/scheduling';

// Helper to create default working hours
function createDefaultWorkingHours(): WorkingHoursDay[] {
  return [
    { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '17:00' }
  ];
}

describe('WorkingHours', () => {
  describe('rendering', () => {
    it('renders heading and description', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      expect(screen.getByText('Working Hours')).toBeInTheDocument();
      expect(screen.getByText(/Set your available hours/)).toBeInTheDocument();
    });

    it('renders all seven days of the week', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      expect(screen.getByText('Sunday')).toBeInTheDocument();
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
      expect(screen.getByText('Saturday')).toBeInTheDocument();
    });

    it('renders switch for each day', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(7);
    });

    it('shows time inputs for enabled days', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      // Monday is enabled - should show time inputs
      const mondayStartTime = screen.getByLabelText('Monday start time');
      const mondayEndTime = screen.getByLabelText('Monday end time');

      expect(mondayStartTime).toBeInTheDocument();
      expect(mondayEndTime).toBeInTheDocument();
    });

    it('shows "Not working" for disabled days', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      // Sunday and Saturday are disabled
      const notWorkingTexts = screen.getAllByText('Not working');
      expect(notWorkingTexts).toHaveLength(2);
    });

    it('displays correct time values', () => {
      const onChange = vi.fn();
      const hours = createDefaultWorkingHours();
      hours[1].startTime = '08:00';
      hours[1].endTime = '18:00';

      render(<WorkingHours workingHours={hours} onChange={onChange} />);

      const mondayStartTime = screen.getByLabelText('Monday start time');
      const mondayEndTime = screen.getByLabelText('Monday end time');

      expect(mondayStartTime).toHaveValue('08:00');
      expect(mondayEndTime).toHaveValue('18:00');
    });
  });

  describe('interactions', () => {
    it('calls onChange when day is toggled on', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      // Toggle Sunday on
      const sundaySwitch = screen.getByLabelText('Toggle Sunday');
      fireEvent.click(sundaySwitch);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedHours = onChange.mock.calls[0][0];
      expect(updatedHours.find((h: WorkingHoursDay) => h.dayOfWeek === 0).enabled).toBe(true);
    });

    it('calls onChange when day is toggled off', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      // Toggle Monday off
      const mondaySwitch = screen.getByLabelText('Toggle Monday');
      fireEvent.click(mondaySwitch);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedHours = onChange.mock.calls[0][0];
      expect(updatedHours.find((h: WorkingHoursDay) => h.dayOfWeek === 1).enabled).toBe(false);
    });

    it('calls onChange when start time is changed', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      const mondayStartTime = screen.getByLabelText('Monday start time');
      fireEvent.change(mondayStartTime, { target: { value: '08:00' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedHours = onChange.mock.calls[0][0];
      expect(updatedHours.find((h: WorkingHoursDay) => h.dayOfWeek === 1).startTime).toBe('08:00');
    });

    it('calls onChange when end time is changed', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      const mondayEndTime = screen.getByLabelText('Monday end time');
      fireEvent.change(mondayEndTime, { target: { value: '18:00' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedHours = onChange.mock.calls[0][0];
      expect(updatedHours.find((h: WorkingHoursDay) => h.dayOfWeek === 1).endTime).toBe('18:00');
    });
  });

  describe('disabled state', () => {
    it('disables all switches when disabled prop is true', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} disabled />);

      const switches = screen.getAllByRole('switch');
      switches.forEach(switchEl => {
        expect(switchEl).toBeDisabled();
      });
    });

    it('disables time inputs when disabled prop is true', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} disabled />);

      const mondayStartTime = screen.getByLabelText('Monday start time');
      const mondayEndTime = screen.getByLabelText('Monday end time');

      expect(mondayStartTime).toBeDisabled();
      expect(mondayEndTime).toBeDisabled();
    });
  });

  describe('test ids', () => {
    it('has test ids for each day', () => {
      const onChange = vi.fn();
      render(<WorkingHours workingHours={createDefaultWorkingHours()} onChange={onChange} />);

      expect(screen.getByTestId('working-hours-0')).toBeInTheDocument(); // Sunday
      expect(screen.getByTestId('working-hours-1')).toBeInTheDocument(); // Monday
      expect(screen.getByTestId('working-hours-6')).toBeInTheDocument(); // Saturday
    });
  });
});
