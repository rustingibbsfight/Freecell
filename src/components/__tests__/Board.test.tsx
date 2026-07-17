import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board } from '../Board'

describe('<Board>', () => {
  it('renders 8 tableau columns and 4 free cells', () => {
    render(<Board seed={1} />)
    for (let i = 0; i < 8; i++) {
      expect(screen.getByTestId(`column-${i}`)).toBeInTheDocument()
    }
    // 52 cards are dealt onto the tableau.
    const cards = screen.getAllByRole('button', { name: / of / })
    expect(cards.length).toBe(52)
  })

  it('has working New Game and Undo controls', () => {
    render(<Board seed={1} />)
    expect(screen.getByRole('button', { name: 'New Game' })).toBeEnabled()
    // Undo starts disabled (no moves yet).
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('selecting a legal single card and clicking a free cell moves it there', async () => {
    const user = userEvent.setup()
    render(<Board seed={1} />)

    // The top (last) card of column 0 is the movable one.
    const col0 = screen.getByTestId('column-0')
    const cardsInCol0 = within(col0).getAllByRole('button', { name: / of / })
    const topCard = cardsInCol0[cardsInCol0.length - 1]
    const topLabel = topCard.getAttribute('aria-label')!

    // Select it, then click the first free cell slot.
    await user.click(topCard)
    const freeCellsRegion = screen.getByLabelText('free cells')
    const firstCell = freeCellsRegion.querySelectorAll('.cell')[0] as HTMLElement
    await user.click(firstCell)

    // The moved card now lives inside the free cells region, not column 0.
    expect(within(freeCellsRegion).getByLabelText(topLabel)).toBeInTheDocument()
    expect(within(col0).queryByLabelText(topLabel)).not.toBeInTheDocument()

    // Undo becomes available after a move.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })
})
