/**
 * Unit tests for BufferDefaults component
 * @module components/settings/__tests__/BufferDefaults.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BufferDefaults } from '../BufferDefaults';

describe('BufferDefaults', () => {
  const defaultProps = {
    bufferBefore: 5,
    bufferAfter: 5,
    keepSlotFreeForCalls: true,
    callSlotDuration: 60,
    callSlotPreferredTime: 'afternoon' as const,
    onChange: vi.fn()
  };

  describe('rendering', () => {
    it('renders buffer section heading', () => {
      render(<BufferDefaults {...defaultProps} />);

      expect(screen.getByText('Default Buffers')).toBeInTheDocument();
      expect(screen.getByText(/Add breathing room/)).toBeInTheDocument();
    });

    it('renders call slot section heading', () => {
      render(<BufferDefaults {...defaultProps} />);

      expect(screen.getByText('Ad-hoc Call Slot')).toBeInTheDocument();
      expect(screen.getByText(/Keep a slot free/)).toBeInTheDocument();
    });

    it('renders buffer before input', () => {
      render(<BufferDefaults {...defaultProps} />);

      const input = screen.getByTestId('buffer-before-input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(5);
    });

    it('renders buffer after input', () => {
      render(<BufferDefaults {...defaultProps} />);

      const input = screen.getByTestId('buffer-after-input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(5);
    });

    it('renders call slot toggle', () => {
      render(<BufferDefaults {...defaultProps} />);

      const toggle = screen.getByTestId('keep-slot-free-switch');
      expect(toggle).toBeInTheDocument();
    });

    it('shows call slot options when enabled', () => {
      render(<BufferDefaults {...defaultProps} keepSlotFreeForCalls={true} />);

      expect(screen.getByTestId('call-slot-options')).toBeInTheDocument();
      expect(screen.getByTestId('call-slot-duration-input')).toBeInTheDocument();
      expect(screen.getByTestId('call-slot-time-select')).toBeInTheDocument();
    });

    it('hides call slot options when disabled', () => {
      render(<BufferDefaults {...defaultProps} keepSlotFreeForCalls={false} />);

      expect(screen.queryByTestId('call-slot-options')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onChange when buffer before is changed', () => {
      const onChange = vi.fn();
      render(<BufferDefaults {...defaultProps} onChange={onChange} />);

      const input = screen.getByTestId('buffer-before-input');
      fireEvent.change(input, { target: { value: '10' } });

      expect(onChange).toHaveBeenCalledWith({ defaultBufferBefore: 10 });
    });

    it('calls onChange when buffer after is changed', () => {
      const onChange = vi.fn();
      render(<BufferDefaults {...defaultProps} onChange={onChange} />);

      const input = screen.getByTestId('buffer-after-input');
      fireEvent.change(input, { target: { value: '15' } });

      expect(onChange).toHaveBeenCalledWith({ defaultBufferAfter: 15 });
    });

    it('calls onChange when call slot toggle is clicked', () => {
      const onChange = vi.fn();
      render(<BufferDefaults {...defaultProps} onChange={onChange} />);

      const toggle = screen.getByTestId('keep-slot-free-switch');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith({ keepSlotFreeForCalls: false });
    });

    it('calls onChange when call slot duration is changed', () => {
      const onChange = vi.fn();
      render(<BufferDefaults {...defaultProps} onChange={onChange} />);

      const input = screen.getByTestId('call-slot-duration-input');
      fireEvent.change(input, { target: { value: '45' } });

      expect(onChange).toHaveBeenCalledWith({ callSlotDuration: 45 });
    });

    it('handles empty buffer value as 0', () => {
      const onChange = vi.fn();
      render(<BufferDefaults {...defaultProps} onChange={onChange} />);

      const input = screen.getByTestId('buffer-before-input');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith({ defaultBufferBefore: 0 });
    });

    it('handles empty call slot duration as default', () => {
      const onChange = vi.fn();
      render(<BufferDefaults {...defaultProps} onChange={onChange} />);

      const input = screen.getByTestId('call-slot-duration-input');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith({ callSlotDuration: 60 });
    });
  });

  describe('disabled state', () => {
    it('disables buffer inputs when disabled', () => {
      render(<BufferDefaults {...defaultProps} disabled />);

      expect(screen.getByTestId('buffer-before-input')).toBeDisabled();
      expect(screen.getByTestId('buffer-after-input')).toBeDisabled();
    });

    it('disables call slot toggle when disabled', () => {
      render(<BufferDefaults {...defaultProps} disabled />);

      expect(screen.getByTestId('keep-slot-free-switch')).toBeDisabled();
    });

    it('disables call slot options when disabled', () => {
      render(<BufferDefaults {...defaultProps} disabled />);

      expect(screen.getByTestId('call-slot-duration-input')).toBeDisabled();
    });
  });
});
