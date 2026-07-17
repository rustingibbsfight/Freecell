// Core domain types for the FreeCell engine.
// The engine is pure: no React, no DOM, no I/O. Everything here is data.

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export type Color = 'red' | 'black'

/** Rank 1..13, where 1 = Ace and 13 = King. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

export interface Card {
  suit: Suit
  rank: Rank
  /** Stable identifier, e.g. "hearts-13". Unique within a deck. */
  id: string
}

/**
 * Game state. Immutable by convention: engine functions return new states
 * rather than mutating their inputs.
 *
 * - `freeCells`: length 4, each holds one Card or null.
 * - `foundations`: top rank reached per suit (0 = empty, 13 = complete King).
 * - `tableau`: 8 columns of face-up cards, index 0 = bottom, last = top/movable.
 */
export interface GameState {
  freeCells: (Card | null)[]
  foundations: Record<Suit, Rank | 0>
  tableau: Card[][]
  /** Seed the game was dealt from, for restart/reproducibility. */
  seed: number
}

/** Where a card (or run) currently lives / is going. */
export type Position =
  | { zone: 'freecell'; index: number }
  | { zone: 'foundation'; suit: Suit }
  | { zone: 'tableau'; index: number }

/**
 * A move request. `count` is the number of cards moved as a unit from the top
 * of a tableau column (a supermove); it defaults to 1 for single-card moves
 * and is only meaningful when `from.zone === 'tableau'`.
 */
export interface Move {
  from: Position
  to: Position
  count?: number
}
