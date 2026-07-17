import { Card, Rank } from './types'
import { color } from './deck'

/**
 * Legality predicates for the three destinations a card can reach.
 * These are the single source of truth for FreeCell rules; both the engine's
 * `applyMove` and the UI consult them.
 */

/** Can `card` land on a foundation whose current top rank is `foundationRank`? */
export function canMoveToFoundation(card: Card, foundationRank: Rank | 0): boolean {
  return card.rank === foundationRank + 1
}

/** Can a card move into a free cell holding `occupant` (null = empty)? */
export function canMoveToFreeCell(occupant: Card | null): boolean {
  return occupant === null
}

/**
 * Can `card` be placed on a tableau column whose current top card is `onto`?
 * An empty column (`onto === undefined`) accepts any card. Otherwise the card
 * must be the opposite color and exactly one rank lower than `onto`.
 */
export function canStackOnTableau(card: Card, onto: Card | undefined): boolean {
  if (onto === undefined) return true
  return color(card) !== color(onto) && card.rank === onto.rank - 1
}

/**
 * Is `cards` (ordered bottom→top) a valid movable run? A run is valid when each
 * card is one rank lower than and the opposite color of the card beneath it.
 */
export function isValidRun(cards: readonly Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const lower = cards[i]
    const upper = cards[i - 1]
    if (color(lower) === color(upper) || lower.rank !== upper.rank - 1) {
      return false
    }
  }
  return true
}
