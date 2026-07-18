import { describe, it, expect } from 'vitest'
import { Card, GameState, Suit, Position } from '../types'
import { legalDestinations } from '../game'

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

const key = (p: Position): string =>
  p.zone === 'foundation' ? `foundation:${p.suit}` : `${p.zone}:${p.index}`

describe('legalDestinations', () => {
  it('lists every legal target for a single card', () => {
    const s = blankState()
    // hearts A on top of column 0; empty foundations/cells; some columns empty.
    s.tableau[0] = [card('hearts', 1)]
    s.tableau[1] = [card('spades', 2)] // A-hearts can go onto black 2
    const dests = legalDestinations(s, { zone: 'tableau', index: 0 }, 1).map(key)
    // Foundation (hearts, empty -> ace ok)
    expect(dests).toContain('foundation:hearts')
    // Onto black 2 in column 1
    expect(dests).toContain('tableau:1')
    // Any empty free cell
    expect(dests).toContain('freecell:0')
    // Empty columns (2..7) accept anything
    expect(dests).toContain('tableau:2')
    // Not onto itself
    expect(dests).not.toContain('tableau:0')
  })

  it('excludes illegal tableau targets (same color / wrong rank)', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 5)]
    s.tableau[1] = [card('diamonds', 6)] // same color -> illegal
    s.tableau[2] = [card('spades', 6)] // opposite color, one higher -> legal
    const dests = legalDestinations(s, { zone: 'tableau', index: 0 }, 1).map(key)
    expect(dests).not.toContain('tableau:1')
    expect(dests).toContain('tableau:2')
  })

  it('returns only tableau targets for a multi-card run', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 8), card('spades', 7)] // valid run of 2
    s.tableau[1] = [card('clubs', 9)] // black 9 receives the red 8
    const dests = legalDestinations(s, { zone: 'tableau', index: 0 }, 2).map(key)
    expect(dests).toContain('tableau:1')
    expect(dests.every((d) => d.startsWith('tableau:'))).toBe(true)
  })
})
