import { Card, GameState, Move, Position, SUITS } from './types'
import { createDeck, color } from './deck'
import { seededShuffle } from './shuffle'
import { deal } from './deal'
import {
  canMoveToFoundation,
  canMoveToFreeCell,
  canStackOnTableau,
  isValidRun,
} from './rules'
import { maxMovable } from './supermove'

/** Deal a fresh game from a numeric seed (reproducible). */
export function newGame(seed: number): GameState {
  const deck = seededShuffle(createDeck(), seed)
  return {
    freeCells: [null, null, null, null],
    foundations: { clubs: 0, diamonds: 0, hearts: 0, spades: 0 },
    tableau: deal(deck),
    seed,
  }
}

/** Number of empty free cells. */
export function freeCellCount(state: GameState): number {
  return state.freeCells.filter((c) => c === null).length
}

/** Number of empty tableau columns. */
export function emptyColumnCount(state: GameState): number {
  return state.tableau.filter((col) => col.length === 0).length
}

function topOf(column: Card[]): Card | undefined {
  return column[column.length - 1]
}

/** Deep-ish clone sufficient for immutable updates (cards themselves are frozen data). */
function cloneState(state: GameState): GameState {
  return {
    freeCells: state.freeCells.slice(),
    foundations: { ...state.foundations },
    tableau: state.tableau.map((col) => col.slice()),
    seed: state.seed,
  }
}

/** The ordered cards (bottom→top) that a move would pick up from its source. */
function movingCards(state: GameState, from: Position, count: number): Card[] | null {
  if (from.zone === 'tableau') {
    const col = state.tableau[from.index]
    if (count < 1 || count > col.length) return null
    return col.slice(col.length - count)
  }
  if (from.zone === 'freecell') {
    const c = state.freeCells[from.index]
    return c ? [c] : null
  }
  // Cards are never moved off a foundation.
  return null
}

/** Is `move` legal in `state`? Pure predicate — never throws. */
export function isLegalMove(state: GameState, move: Move): boolean {
  const { from, to } = move
  const count = move.count ?? 1

  if (from.zone === 'foundation') return false

  const cards = movingCards(state, from, count)
  if (!cards || cards.length === 0) return false

  // No-op / self moves.
  if (from.zone === 'tableau' && to.zone === 'tableau' && from.index === to.index) {
    return false
  }

  // Multi-card runs can only be dropped onto the tableau.
  if (cards.length > 1 && to.zone !== 'tableau') return false

  // The picked-up cards must themselves form a valid run.
  if (!isValidRun(cards)) return false

  const bottom = cards[0]

  switch (to.zone) {
    case 'foundation': {
      if (cards.length !== 1) return false
      if (bottom.suit !== to.suit) return false
      return canMoveToFoundation(bottom, state.foundations[to.suit])
    }
    case 'freecell': {
      if (cards.length !== 1) return false
      return canMoveToFreeCell(state.freeCells[to.index])
    }
    case 'tableau': {
      const destCol = state.tableau[to.index]
      if (!canStackOnTableau(bottom, topOf(destCol))) return false
      const capacity = maxMovable(
        freeCellCount(state),
        emptyColumnCount(state),
        destCol.length === 0,
      )
      return cards.length <= capacity
    }
  }
}

/** Apply a legal move, returning a new state. Throws on an illegal move. */
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move)) {
    throw new Error('Illegal move')
  }
  const { from, to } = move
  const count = move.count ?? 1
  const next = cloneState(state)

  // Remove the moving cards from the source.
  let moving: Card[]
  if (from.zone === 'tableau') {
    moving = next.tableau[from.index].splice(next.tableau[from.index].length - count)
  } else {
    // freecell
    moving = [next.freeCells[from.index]!]
    next.freeCells[from.index] = null
  }

  // Place them at the destination.
  switch (to.zone) {
    case 'foundation':
      next.foundations[to.suit] = moving[0].rank
      break
    case 'freecell':
      next.freeCells[to.index] = moving[0]
      break
    case 'tableau':
      next.tableau[to.index].push(...moving)
      break
  }

  return next
}

/** All 52 cards home. */
export function isWon(state: GameState): boolean {
  return SUITS.every((suit) => state.foundations[suit] === 13)
}

/** Foundation destination a single card could go to, if any. */
export function foundationDestination(state: GameState, card: Card): Position | null {
  if (canMoveToFoundation(card, state.foundations[card.suit])) {
    return { zone: 'foundation', suit: card.suit }
  }
  return null
}

/** Lowest foundation rank among the two suits of the opposite color. */
function minOppositeColorFoundation(state: GameState, card: Card): number {
  const oppositeSuits = SUITS.filter(
    (s) => color({ suit: s, rank: 1, id: '' }) !== color(card),
  )
  return Math.min(...oppositeSuits.map((s) => state.foundations[s]))
}

/**
 * A card is "safe" to auto-play to its foundation when it can never be needed
 * later to receive a card in the tableau: Aces and Twos always, otherwise when
 * both opposite-color foundations have reached at least rank - 1.
 */
function isSafeToAutoplay(state: GameState, card: Card): boolean {
  if (!canMoveToFoundation(card, state.foundations[card.suit])) return false
  if (card.rank <= 2) return true
  return minOppositeColorFoundation(state, card) >= card.rank - 1
}

/**
 * Repeatedly send safe cards (from tableau tops and free cells) to the
 * foundations until no more can move. Returns a new state.
 */
export function autoMoveToFoundations(state: GameState): GameState {
  let current = state
  let moved = true
  while (moved) {
    moved = false

    for (let i = 0; i < current.freeCells.length; i++) {
      const c = current.freeCells[i]
      if (c && isSafeToAutoplay(current, c)) {
        current = applyMove(current, {
          from: { zone: 'freecell', index: i },
          to: { zone: 'foundation', suit: c.suit },
        })
        moved = true
      }
    }

    for (let i = 0; i < current.tableau.length; i++) {
      const c = topOf(current.tableau[i])
      if (c && isSafeToAutoplay(current, c)) {
        current = applyMove(current, {
          from: { zone: 'tableau', index: i },
          to: { zone: 'foundation', suit: c.suit },
        })
        moved = true
      }
    }
  }
  return current
}
