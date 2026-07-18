import { describe, it, expect } from 'vitest'
import { Card, GameState, Suit, Move } from '../types'
import { isLegalMove, applyMove, legalDestinations } from '../game'

const card = (suit: Suit, rank: number): Card =>
  ({ suit, rank: rank as Card['rank'], id: `${suit}-${rank}` })

function blankState(): GameState {
  return {
    freeCells: [null, null, null, null],
    foundations: { clubs: 0, diamonds: 0, hearts: 0, spades: 0 },
    tableau: [[], [], [], [], [], [], [], []],
    seed: 0,
  }
}

describe('pulling a card back off a foundation', () => {
  it('can move the top foundation card onto a legal tableau column', () => {
    const s = blankState()
    s.foundations.hearts = 5 // hearts up to 5; top card is 5♥
    s.tableau[0] = [card('spades', 6)] // black 6 receives red 5
    const move: Move = {
      from: { zone: 'foundation', suit: 'hearts' },
      to: { zone: 'tableau', index: 0 },
    }
    expect(isLegalMove(s, move)).toBe(true)
    const next = applyMove(s, move)
    expect(next.foundations.hearts).toBe(4) // foundation drops by one
    expect(next.tableau[0].at(-1)).toEqual(card('hearts', 5))
    // input untouched (immutability)
    expect(s.foundations.hearts).toBe(5)
  })

  it('can move the top foundation card into an empty free cell', () => {
    const s = blankState()
    s.foundations.spades = 1 // top card A♠
    const move: Move = {
      from: { zone: 'foundation', suit: 'spades' },
      to: { zone: 'freecell', index: 2 },
    }
    expect(isLegalMove(s, move)).toBe(true)
    const next = applyMove(s, move)
    expect(next.foundations.spades).toBe(0)
    expect(next.freeCells[2]).toEqual(card('spades', 1))
  })

  it('rejects an illegal tableau target (same color / wrong rank)', () => {
    const s = blankState()
    s.foundations.hearts = 5
    s.tableau[0] = [card('diamonds', 6)] // same color -> illegal
    s.tableau[1] = [card('spades', 7)] // wrong rank -> illegal
    expect(
      isLegalMove(s, { from: { zone: 'foundation', suit: 'hearts' }, to: { zone: 'tableau', index: 0 } }),
    ).toBe(false)
    expect(
      isLegalMove(s, { from: { zone: 'foundation', suit: 'hearts' }, to: { zone: 'tableau', index: 1 } }),
    ).toBe(false)
  })

  it('rejects moving a foundation card onto another foundation', () => {
    const s = blankState()
    s.foundations.hearts = 5
    s.foundations.diamonds = 4
    expect(
      isLegalMove(s, { from: { zone: 'foundation', suit: 'hearts' }, to: { zone: 'foundation', suit: 'diamonds' } }),
    ).toBe(false)
    expect(
      isLegalMove(s, { from: { zone: 'foundation', suit: 'hearts' }, to: { zone: 'foundation', suit: 'hearts' } }),
    ).toBe(false)
  })

  it('rejects pulling from an empty foundation', () => {
    const s = blankState()
    s.tableau[0] = [card('spades', 6)]
    expect(
      isLegalMove(s, { from: { zone: 'foundation', suit: 'hearts' }, to: { zone: 'tableau', index: 0 } }),
    ).toBe(false)
  })

  it('legalDestinations reflects where a foundation card can go', () => {
    const s = blankState()
    s.foundations.hearts = 5
    s.tableau[0] = [card('spades', 6)] // legal build
    const dests = legalDestinations(s, { zone: 'foundation', suit: 'hearts' }, 1).map((p) =>
      p.zone === 'foundation' ? `foundation:${p.suit}` : `${p.zone}:${p.index}`,
    )
    expect(dests).toContain('tableau:0')
    expect(dests).toContain('freecell:0')
    // never suggests moving between foundations
    expect(dests.some((d) => d.startsWith('foundation:'))).toBe(false)
  })
})
