import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OAuthButton } from '../OAuthButton'

describe('OAuthButton', () => {
  it('renders connect button with Google branding', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={false} />)

    const button = screen.getByRole('button', { name: /connect with google calendar/i })
    expect(button).toBeInTheDocument()
    expect(screen.getByText('Connect with Google Calendar')).toBeInTheDocument()
  })

  it('shows loading state when isLoading is true', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={true} />)

    expect(screen.getByText('Connecting...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when button is clicked', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={false} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={false} disabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is disabled when isLoading is true', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('has proper accessibility label', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={false} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Connect with Google Calendar')
  })

  it('has loading accessibility label when connecting', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={true} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Connecting to Google Calendar')
  })

  it('applies custom className', () => {
    const onClick = vi.fn()
    render(<OAuthButton onClick={onClick} isLoading={false} className="custom-class" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })
})
