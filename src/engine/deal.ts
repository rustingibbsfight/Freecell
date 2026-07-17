import { Card } from './types'

export const TABLEAU_COLUMNS = 8

/**
 * Deal a deck into 8 tableau columns, round-robin (standard FreeCell layout).
 * With 52 cards the first four columns receive 7 cards and the last four
 * receive 6. Index 0 of each column is the bottom card; the last element is
 * the exposed, movable top card.
 */
export function deal(deck: readonly Card[]): Card[][] {
  const columns: Card[][] = Array.from({ length: TABLEAU_COLUMNS }, () => [])
  deck.forEach((card, i) => {
    columns[i % TABLEAU_COLUMNS].push(card)
  })
  return columns
}
