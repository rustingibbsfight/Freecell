import { describe, it, expect } from 'vitest'
import { Card, GameState, Suit, Move } from '../types'
import {
  newGame,
  isLegalMove,
  applyMove,
  isWon,
  autoMoveToFoundations,
  emptyColumnCount,
  freeCellCount,
} from '../game'

const card = (suit: Suit, rank: number): Card =>
  ({ suit, rank: rank as Card['rank'], id: `${suit}-${rank}` })

/** An empty, well-formed state we can populate for targeted tests. */
function blankState(): GameState {
  return {
    freeCells: [null, null, null, null],
    foundations: { clubs: 0, diamonds: 0, hearts: 0, spades: 0 },
    tableau: [[], [], [], [], [], [], [], []],
    seed: 0,
  }
}

describe('newGame', () => {
  it('deals a full, legal starting position', () => {
    const s = newGame(42)
    expect(s.tableau.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
    expect(s.freeCells).toEqual([null, null, null, null])
    expect(s.foundations).toEqual({ clubs: 0, diamonds: 0, hearts: 0, spades: 0 })
    const ids = s.tableau.flat().map((c) => c.id)
    expect(new Set(ids).size).toBe(52)
    expect(s.seed).toBe(42)
  })

  it('is deterministic for a given seed', () => {
    expect(newGame(7)).toEqual(newGame(7))
  })
})

describe('counts', () => {
  it('counts empty free cells and empty columns', () => {
    const s = blankState()
    s.freeCells[0] = card('spades', 1)
    s.tableau[0] = [card('hearts', 5)]
    expect(freeCellCount(s)).toBe(3)
    expect(emptyColumnCount(s)).toBe(7)
  })
})

describe('applyMove — immutability & legality', () => {
  it('returns a new state and does not mutate the input', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 1)]
    const move: Move = { from: { zone: 'tableau', index: 0 }, to: { zone: 'foundation', suit: 'hearts' } }
    const next = applyMove(s, move)
    expect(next).not.toBe(s)
    expect(s.tableau[0]).toHaveLength(1) // original untouched
    expect(s.foundations.hearts).toBe(0)
    expect(next.foundations.hearts).toBe(1)
    expect(next.tableau[0]).toHaveLength(0)
  })

  it('throws on an illegal move', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 5)] // not an Ace
    const move: Move = { from: { zone: 'tableau', index: 0 }, to: { zone: 'foundation', suit: 'hearts' } }
    expect(isLegalMove(s, move)).toBe(false)
    expect(() => applyMove(s, move)).toThrow()
  })

  it('moves a card to a free cell and back to tableau', () => {
    const s = blankState()
    s.tableau[0] = [card('spades', 6), card('hearts', 5)]
    s.tableau[1] = [card('clubs', 8)]
    const toCell = applyMove(s, {
      from: { zone: 'tableau', index: 0 },
      to: { zone: 'freecell', index: 0 },
    })
    expect(toCell.freeCells[0]).toEqual(card('hearts', 5))
    expect(toCell.tableau[0]).toHaveLength(1)
    // hearts-5 (red) cannot stack on clubs-8; but spades-6 top can't either.
    // Move the 5 from the cell onto nothing valid -> instead onto an empty col.
    const back = applyMove(toCell, {
      from: { zone: 'freecell', index: 0 },
      to: { zone: 'tableau', index: 7 },
    })
    expect(back.freeCells[0]).toBeNull()
    expect(back.tableau[7]).toEqual([card('hearts', 5)])
  })

  it('rejects stacking same-color on tableau', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 6)]
    s.tableau[1] = [card('diamonds', 5)]
    const move: Move = {
      from: { zone: 'tableau', index: 1 },
      to: { zone: 'tableau', index: 0 },
    }
    expect(isLegalMove(s, move)).toBe(false)
  })
})

describe('supermove application', () => {
  it('moves a valid multi-card run when free cells allow it', () => {
    const s = blankState()
    // Column 0 top run: 8red,7black,6red (valid), on top of a black 9 base.
    s.tableau[0] = [card('spades', 9), card('hearts', 8), card('spades', 7), card('diamonds', 6)]
    // Column 1: a black 9 to receive the red 8 run head.
    s.tableau[1] = [card('clubs', 9)]
    // 4 free cells + 0 empty columns => can move up to 5 cards. Run is 3.
    const move: Move = {
      from: { zone: 'tableau', index: 0 },
      to: { zone: 'tableau', index: 1 },
      count: 3,
    }
    expect(isLegalMove(s, move)).toBe(true)
    const next = applyMove(s, move)
    expect(next.tableau[0]).toEqual([card('spades', 9)])
    expect(next.tableau[1].map((c) => c.id)).toEqual([
      'clubs-9', 'hearts-8', 'spades-7', 'diamonds-6',
    ])
  })

  it('rejects a supermove larger than capacity allows', () => {
    const s = blankState()
    s.freeCells = [card('spades', 1), card('spades', 2), card('spades', 3), card('spades', 4)] // 0 free
    s.tableau[0] = [card('hearts', 8), card('spades', 7)] // run of 2
    s.tableau[1] = [card('diamonds', 9)]
    // 0 free cells, 0 empty columns => max movable is 1, but we ask for 2.
    const move: Move = {
      from: { zone: 'tableau', index: 0 },
      to: { zone: 'tableau', index: 1 },
      count: 2,
    }
    expect(isLegalMove(s, move)).toBe(false)
  })

  it('rejects moving an invalid (non-sequential) run', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 8), card('spades', 3)] // not a run
    s.tableau[1] = [card('clubs', 9)]
    const move: Move = {
      from: { zone: 'tableau', index: 0 },
      to: { zone: 'tableau', index: 1 },
      count: 2,
    }
    expect(isLegalMove(s, move)).toBe(false)
  })
})

describe('isWon', () => {
  it('is false for a fresh game', () => {
    expect(isWon(newGame(1))).toBe(false)
  })

  it('is true only when every foundation reaches the King', () => {
    const s = blankState()
    s.foundations = { clubs: 13, diamonds: 13, hearts: 13, spades: 13 }
    expect(isWon(s)).toBe(true)
    s.foundations.spades = 12
    expect(isWon(s)).toBe(false)
  })
})

describe('autoMoveToFoundations', () => {
  it('sweeps safe cards up to the foundations', () => {
    const s = blankState()
    s.tableau[0] = [card('clubs', 1)]
    s.tableau[1] = [card('diamonds', 1)]
    s.freeCells[0] = card('hearts', 1)
    const next = autoMoveToFoundations(s)
    expect(next.foundations.clubs).toBe(1)
    expect(next.foundations.diamonds).toBe(1)
    expect(next.foundations.hearts).toBe(1)
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.freeCells[0]).toBeNull()
  })

  it('completes an easily-finishable board to a win', () => {
    // Each suit stacked King(bottom)..Ace(top) in its own column: fully solvable
    // by repeated safe foundation moves.
    const s = blankState()
    const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
    suits.forEach((suit, i) => {
      s.tableau[i] = []
      for (let rank = 13; rank >= 1; rank--) s.tableau[i].push(card(suit, rank))
    })
    const finished = autoMoveToFoundations(s)
    expect(isWon(finished)).toBe(true)
  })
})
