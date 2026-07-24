import { Card, GameState, Move, Position, Rank, SUITS } from './types'
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
  // Foundation: the single exposed top card can be pulled back into play.
  if (count === 1) {
    const rank = state.foundations[from.suit]
    if (rank === 0) return null
    return [{ suit: from.suit, rank, id: `${from.suit}-${rank}` }]
  }
  return null
}

/** Decrement a foundation rank by one (0 stays 0). */
function prevRank(rank: Rank | 0): Rank | 0 {
  return (rank === 0 ? 0 : rank - 1) as Rank | 0
}

/** Is `move` legal in `state`? Pure predicate — never throws. */
export function isLegalMove(state: GameState, move: Move): boolean {
  const { from, to } = move
  const count = move.count ?? 1

  // A card may be pulled back off a foundation, but never onto another foundation.
  if (from.zone === 'foundation' && to.zone === 'foundation') return false

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
  } else if (from.zone === 'freecell') {
    moving = [next.freeCells[from.index]!]
    next.freeCells[from.index] = null
  } else {
    // Foundation: pull the exposed top card back into play.
    const rank = next.foundations[from.suit] as Rank
    moving = [{ suit: from.suit, rank, id: `${from.suit}-${rank}` }]
    next.foundations[from.suit] = prevRank(rank)
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

/** Every candidate destination position on the board. */
function allDestinations(state: GameState): Position[] {
  const out: Position[] = []
  for (let i = 0; i < state.freeCells.length; i++) out.push({ zone: 'freecell', index: i })
  for (const suit of SUITS) out.push({ zone: 'foundation', suit })
  for (let i = 0; i < state.tableau.length; i++) out.push({ zone: 'tableau', index: i })
  return out
}

/** All positions a card/run at `from` can legally move to. */
export function legalDestinations(
  state: GameState,
  from: Position,
  count = 1,
): Position[] {
  return allDestinations(state).filter((to) => isLegalMove(state, { from, to, count }))
}

/**
 * The single smartest legal target for a card/run at `from`, or null if there
 * is no legal move. Ranking: foundation (send home) → build onto a non-empty
 * tableau column (leftmost) → park in an empty column (leftmost) → free cell.
 */
export function bestDestination(
  state: GameState,
  from: Position,
  count = 1,
): Position | null {
  const dests = legalDestinations(state, from, count)

  const foundation = dests.find((d) => d.zone === 'foundation')
  if (foundation) return foundation

  const tableauByIndex = (empty: boolean): Position | undefined =>
    dests
      .filter(
        (d): d is Extract<Position, { zone: 'tableau' }> =>
          d.zone === 'tableau' && state.tableau[d.index].length === 0 === empty,
      )
      .sort((a, b) => a.index - b.index)[0]

  const build = tableauByIndex(false)
  if (build) return build

  const park = tableauByIndex(true)
  if (park) return park

  const freeCell = dests
    .filter((d): d is Extract<Position, { zone: 'freecell' }> => d.zone === 'freecell')
    .sort((a, b) => a.index - b.index)[0]
  return freeCell ?? null
}

/** Length of the longest valid movable run at the top of a column. */
export function movableRunLength(col: Card[]): number {
  if (col.length === 0) return 0
  let len = 1
  for (let i = col.length - 1; i >= 1; i--) {
    const lower = col[i]
    const upper = col[i - 1]
    if (color(lower) !== color(upper) && lower.rank === upper.rank - 1) len++
    else break
  }
  return len
}

/** Movable sources: each free-cell card, and each valid top-run of each column. */
function movableSources(state: GameState): { from: Position; count: number }[] {
  const sources: { from: Position; count: number }[] = []
  for (let i = 0; i < state.freeCells.length; i++) {
    if (state.freeCells[i]) sources.push({ from: { zone: 'freecell', index: i }, count: 1 })
  }
  for (let i = 0; i < state.tableau.length; i++) {
    const run = movableRunLength(state.tableau[i])
    // Larger runs first so a build hint prefers relocating a whole sequence.
    for (let k = run; k >= 1; k--) {
      sources.push({ from: { zone: 'tableau', index: i }, count: k })
    }
  }
  return sources
}

/**
 * Suggest one genuinely useful legal move (never a "parking" move to a free cell
 * or empty column). Prefers sending a card home, then building onto another
 * column. Returns null when no such move exists.
 */
export function findHint(state: GameState): Move | null {
  const sources = movableSources(state)

  // Pass 1: a card that can go home.
  for (const { from, count } of sources) {
    if (count !== 1) continue
    const home = legalDestinations(state, from, 1).find((d) => d.zone === 'foundation')
    if (home) return { from, to: home, count: 1 }
  }

  // Pass 2: a card/run that builds onto a non-empty tableau column.
  for (const { from, count } of sources) {
    const build = legalDestinations(state, from, count).find(
      (d) => d.zone === 'tableau' && state.tableau[d.index].length > 0,
    )
    if (build) return { from, to: build, count }
  }

  return null
}
