/**
 * Unit tests for SchedulingPreferences component
 * @module components/settings/__tests__/SchedulingPreferences.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingPreferences } from '../SchedulingPreferences';
import type { UserSchedulingPreferences, WorkingHoursDay, TaskTypeRule } from '@/types/scheduling';

// Mock the useSchedulingPreferences hook
vi.mock('@/hooks/useSchedulingPreferences', () => ({
  useSchedulingPreferences: vi.fn()
}));

import { useSchedulingPreferences } from '@/hooks/useSchedulingPreferences';

const mockUseSchedulingPreferences = vi.mocked(useSchedulingPreferences);

// Helper to create mock preferences
function createMockPreferences(overrides: Partial<UserSchedulingPreferences> = {}): UserSchedulingPreferences {
  return {
    userId: 'test-user-123',
    defaultCalendarId: 'primary',
    preferredCalendarId: null,
    workingHours: [
      { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '17:00' }
    ],
    taskTypeRules: [
      { taskType: 'deep_work', preferredTimeOfDay: 'morning', defaultDuration: 120, bufferBefore: 0, bufferAfter: 10 }
    ],
    protectedSlots: [],
    defaultBufferBefore: 5,
    defaultBufferAfter: 5,
    keepSlotFreeForCalls: true,
    callSlotDuration: 60,
    callSlotPreferredTime: 'afternoon',
    timezone: 'America/New_York',
    autoScheduleEnabled: false,
    preferContiguousBlocks: true,
    ...overrides
  };
}

describe('SchedulingPreferences', () => {
  const defaultHookReturn = {
    preferences: createMockPreferences(),
    loading: false,
    error: null,
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    setWorkingHours: vi.fn().mockResolvedValue(undefined),
    setTaskTypeRule: vi.fn().mockResolvedValue(undefined),
    addSlot: vi.fn().mockResolvedValue('slot-1'),
    removeSlot: vi.fn().mockResolvedValue(undefined),
    updateSlot: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSchedulingPreferences.mockReturnValue(defaultHookReturn);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading spinner when loading', () => {
      mockUseSchedulingPreferences.mockReturnValue({
        ...defaultHookReturn,
        loading: true,
        preferences: null
      });

      render(<SchedulingPreferences />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error occurs', () => {
      mockUseSchedulingPreferences.mockReturnValue({
        ...defaultHookReturn,
        error: 'Network error',
        preferences: null
      });

      render(<SchedulingPreferences />);

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  describe('unauthenticated state', () => {
    it('shows sign in message when not authenticated', () => {
      mockUseSchedulingPreferences.mockReturnValue({
        ...defaultHookReturn,
        preferences: null
      });

      render(<SchedulingPreferences />);

      expect(screen.getByTestId('unauthenticated-state')).toBeInTheDocument();
      expect(screen.getByText(/Please sign in/)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders main heading', () => {
      render(<SchedulingPreferences />);

      expect(screen.getByText('Scheduling Preferences')).toBeInTheDocument();
    });

    it('renders reset button', () => {
      render(<SchedulingPreferences />);

      expect(screen.getByTestId('reset-all-button')).toBeInTheDocument();
    });

    it('renders all tabs', () => {
      render(<SchedulingPreferences />);

      expect(screen.getByTestId('hours-tab')).toBeInTheDocument();
      expect(screen.getByTestId('rules-tab')).toBeInTheDocument();
      expect(screen.getByTestId('protected-tab')).toBeInTheDocument();
      expect(screen.getByTestId('buffers-tab')).toBeInTheDocument();
    });

    it('shows working hours tab by default', () => {
      render(<SchedulingPreferences />);

      expect(screen.getByTestId('hours-content')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('shows task rules tab when clicked', () => {
      render(<SchedulingPreferences />);

      fireEvent.click(screen.getByTestId('rules-tab'));

      expect(screen.getByTestId('rules-content')).toBeInTheDocument();
    });

    it('shows protected slots tab when clicked', () => {
      render(<SchedulingPreferences />);

      fireEvent.click(screen.getByTestId('protected-tab'));

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('shows buffers tab when clicked', () => {
      render(<SchedulingPreferences />);

      fireEvent.click(screen.getByTestId('buffers-tab'));

      expect(screen.getByTestId('buffers-content')).toBeInTheDocument();
    });
  });

  describe('working hours interactions', () => {
    it('shows save button when working hours are modified', () => {
      render(<SchedulingPreferences />);

      // Toggle Sunday
      const sundaySwitch = screen.getByLabelText('Toggle Sunday');
      fireEvent.click(sundaySwitch);

      expect(screen.getByTestId('save-working-hours')).toBeInTheDocument();
    });

    it('shows reset button when working hours are modified', () => {
      render(<SchedulingPreferences />);

      const sundaySwitch = screen.getByLabelText('Toggle Sunday');
      fireEvent.click(sundaySwitch);

      expect(screen.getByTestId('reset-working-hours')).toBeInTheDocument();
    });

    it('calls setWorkingHours when save is clicked', async () => {
      render(<SchedulingPreferences />);

      const sundaySwitch = screen.getByLabelText('Toggle Sunday');
      fireEvent.click(sundaySwitch);

      fireEvent.click(screen.getByTestId('save-working-hours'));

      await waitFor(() => {
        expect(defaultHookReturn.setWorkingHours).toHaveBeenCalled();
      });
    });

    it('resets changes when reset is clicked', () => {
      render(<SchedulingPreferences />);

      const sundaySwitch = screen.getByLabelText('Toggle Sunday');
      fireEvent.click(sundaySwitch);

      expect(screen.getByTestId('save-working-hours')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('reset-working-hours'));

      // Save button should disappear
      expect(screen.queryByTestId('save-working-hours')).not.toBeInTheDocument();
    });
  });

  describe('task type rules interactions', () => {
    it('calls setTaskTypeRule when rule is updated', async () => {
      const user = userEvent.setup();
      render(<SchedulingPreferences />);

      await user.click(screen.getByTestId('rules-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('rules-content')).toBeInTheDocument();
      });

      // Click edit on deep_work rule
      await user.click(screen.getByTestId('edit-rule-deep_work'));

      // Save the rule
      await user.click(screen.getByTestId('save-rule-deep_work'));

      expect(defaultHookReturn.setTaskTypeRule).toHaveBeenCalled();
    });
  });

  describe('protected slots interactions', () => {
    it('calls addSlot when new slot is added', async () => {
      const user = userEvent.setup();
      render(<SchedulingPreferences />);

      await user.click(screen.getByTestId('protected-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-slot-button'));

      await user.type(screen.getByTestId('slot-name-input'), 'Lunch');
      await user.click(screen.getByTestId('confirm-add-slot'));

      expect(defaultHookReturn.addSlot).toHaveBeenCalled();
    });

    it('calls removeSlot when slot is removed', async () => {
      const user = userEvent.setup();
      mockUseSchedulingPreferences.mockReturnValue({
        ...defaultHookReturn,
        preferences: createMockPreferences({
          protectedSlots: [
            { id: 'slot-1', name: 'Lunch', recurrence: 'daily', startTime: '12:00', endTime: '13:00', enabled: true }
          ]
        })
      });

      render(<SchedulingPreferences />);

      await user.click(screen.getByTestId('protected-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('remove-slot-slot-1'));

      expect(defaultHookReturn.removeSlot).toHaveBeenCalledWith('slot-1');
    });
  });

  describe('buffer defaults interactions', () => {
    it('calls updatePreferences when buffer is changed', async () => {
      const user = userEvent.setup();
      render(<SchedulingPreferences />);

      await user.click(screen.getByTestId('buffers-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('buffers-content')).toBeInTheDocument();
      });

      // Use fireEvent for input change since it's more direct
      const bufferBeforeInput = screen.getByTestId('buffer-before-input');
      fireEvent.change(bufferBeforeInput, { target: { value: '10' } });

      await waitFor(() => {
        expect(defaultHookReturn.updatePreferences).toHaveBeenCalled();
      });
    });
  });

  describe('reset all', () => {
    it('calls reset when reset button is clicked', async () => {
      render(<SchedulingPreferences />);

      fireEvent.click(screen.getByTestId('reset-all-button'));

      await waitFor(() => {
        expect(defaultHookReturn.reset).toHaveBeenCalled();
      });
    });
  });

  describe('save error handling', () => {
    it('shows save error when save fails', async () => {
      const setWorkingHours = vi.fn().mockRejectedValue(new Error('Save failed'));
      mockUseSchedulingPreferences.mockReturnValue({
        ...defaultHookReturn,
        setWorkingHours
      });

      render(<SchedulingPreferences />);

      const sundaySwitch = screen.getByLabelText('Toggle Sunday');
      fireEvent.click(sundaySwitch);

      fireEvent.click(screen.getByTestId('save-working-hours'));

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      });
    });
  });
});
