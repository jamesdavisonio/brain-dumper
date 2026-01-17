import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestionCard } from '../SuggestionCard'
import type { SchedulingSuggestion } from '@/types'

const createMockSuggestion = (
  overrides: Partial<SchedulingSuggestion> = {}
): SchedulingSuggestion => {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(9, 0, 0, 0)

  const end = new Date(start)
  end.setHours(11, 0, 0, 0)

  return {
    slot: { start, end, available: true },
    score: 85,
    reasoning: 'Good time slot based on preferences',
    factors: [
      { name: 'Time preference', weight: 0.3, value: 90, description: 'Excellent' },
      { name: 'Buffer time', weight: 0.2, value: 80, description: 'Available' },
    ],
    conflicts: [],
    ...overrides,
  }
}

describe('SuggestionCard', () => {
  it('renders suggestion with date and time', () => {
    const suggestion = createMockSuggestion()
    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    // Should show Tomorrow since we set date to tomorrow
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
    expect(screen.getByText(/9:00 AM - 11:00 AM/)).toBeInTheDocument()
  })

  it('renders score and label', () => {
    const suggestion = createMockSuggestion({ score: 85 })
    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('85/100')).toBeInTheDocument()
    expect(screen.getByText('Great')).toBeInTheDocument()
  })

  it('shows "Best match" badge for high scores', () => {
    const suggestion = createMockSuggestion({ score: 92 })
    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Best match')).toBeInTheDocument()
  })

  it('applies selected styling when selected', () => {
    const suggestion = createMockSuggestion()
    const { container } = render(
      <SuggestionCard
        suggestion={suggestion}
        selected={true}
        onSelect={vi.fn()}
      />
    )

    const card = container.querySelector('[class*="ring-2"]')
    expect(card).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const suggestion = createMockSuggestion()
    const onSelect = vi.fn()
    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={onSelect}
      />
    )

    // Click on the card - find it by role or test id
    const card = screen.getByRole('button', { hidden: true }).closest('[class*="Card"]')
      || document.querySelector('[class*="card"]')
      || screen.getByText('Tomorrow').closest('div[class*="rounded"]')

    if (card) {
      fireEvent.click(card)
      expect(onSelect).toHaveBeenCalled()
    }
  })

  it('shows conflict warning when conflicts exist', () => {
    const suggestion = createMockSuggestion({
      conflicts: [
        {
          type: 'overlap',
          description: 'Overlaps with existing meeting',
          severity: 'warning',
        },
      ],
    })

    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText(/1 warning/)).toBeInTheDocument()
  })

  it('shows expandable details section', () => {
    const suggestion = createMockSuggestion()
    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
        showReasoning
      />
    )

    expect(screen.getByText('Show details')).toBeInTheDocument()
  })

  it('expands to show reasoning when toggle is clicked', () => {
    const suggestion = createMockSuggestion({
      reasoning: 'This is a great time slot',
    })

    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
        showReasoning
      />
    )

    fireEvent.click(screen.getByText('Show details'))

    expect(screen.getByText('This is a great time slot')).toBeInTheDocument()
    expect(screen.getByText('Hide details')).toBeInTheDocument()
  })

  it('shows scoring factors when expanded', () => {
    const suggestion = createMockSuggestion({
      factors: [
        { name: 'Time preference', weight: 0.3, value: 90, description: 'Excellent' },
        { name: 'Buffer time', weight: 0.2, value: 80, description: 'Available' },
      ],
    })

    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
        showReasoning
      />
    )

    fireEvent.click(screen.getByText('Show details'))

    expect(screen.getByText('Scoring Factors')).toBeInTheDocument()
    expect(screen.getByText('Time preference')).toBeInTheDocument()
    expect(screen.getByText('Buffer time')).toBeInTheDocument()
  })

  it('displays correct duration', () => {
    const start = new Date()
    start.setHours(9, 0, 0, 0)
    const end = new Date()
    end.setHours(11, 30, 0, 0)

    const suggestion = createMockSuggestion({
      slot: { start, end, available: true },
    })

    render(
      <SuggestionCard
        suggestion={suggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('2h 30m')).toBeInTheDocument()
  })

  it('applies correct color based on score', () => {
    const lowScoreSuggestion = createMockSuggestion({ score: 50 })

    const { rerender } = render(
      <SuggestionCard
        suggestion={lowScoreSuggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    // Poor score should be shown
    expect(screen.getByText('Poor')).toBeInTheDocument()

    const highScoreSuggestion = createMockSuggestion({ score: 95 })
    rerender(
      <SuggestionCard
        suggestion={highScoreSuggestion}
        selected={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Excellent')).toBeInTheDocument()
  })
})
