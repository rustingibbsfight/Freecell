import { describe, it, expect } from 'vitest'
import { Card, GameState, Suit, Position } from '../types'
import { findHint, bestDestination } from '../game'

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

const key = (p: Position | null): string | null =>
  p === null ? null : p.zone === 'foundation' ? `foundation:${p.suit}` : `${p.zone}:${p.index}`

describe('bestDestination', () => {
  it('prefers the foundation for a single card that can go home', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 1)]
    s.tableau[1] = [card('spades', 2)] // A-hearts could also build here, but home wins
    const dest = bestDestination(s, { zone: 'tableau', index: 0 }, 1)
    expect(key(dest)).toBe('foundation:hearts')
  })

  it('builds down onto a non-empty column when it cannot go home', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 5)] // 5 cannot go to foundation (needs 4 first)
    s.tableau[3] = [card('spades', 6)] // legal build target (leftmost among legal)
    const dest = bestDestination(s, { zone: 'tableau', index: 0 }, 1)
    expect(key(dest)).toBe('tableau:3')
  })

  it('prefers a non-empty legal build over an empty column', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 5)]
    s.tableau[1] = [] // empty column available
    s.tableau[5] = [card('clubs', 6)] // legal non-empty build
    const dest = bestDestination(s, { zone: 'tableau', index: 0 }, 1)
    expect(key(dest)).toBe('tableau:5')
  })

  it('parks in an empty column when no home/build exists (before a free cell)', () => {
    const s = blankState()
    // A lone red 5 with no black 6 anywhere and no foundation progress.
    s.tableau[0] = [card('clubs', 9), card('hearts', 5)]
    // Fill every column except #2 with a non-accepting card, so #2 is the only empty one.
    for (let i = 1; i < 8; i++) s.tableau[i] = [card('spades', 9)]
    s.tableau[2] = [] // the only empty column
    const dest = bestDestination(s, { zone: 'tableau', index: 0 }, 1)
    expect(key(dest)).toBe('tableau:2')
  })

  it('falls back to a free cell as the last resort', () => {
    const s = blankState()
    // Fill all other columns so none are empty and none accept the card.
    const fillers: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
    for (let i = 0; i < 8; i++) {
      s.tableau[i] = [card(fillers[i % 4], 9)]
    }
    // Column 0 top is a red 5 that can't build on any black 6 (all are 9s) nor go home.
    s.tableau[0] = [card('clubs', 9), card('hearts', 5)]
    const dest = bestDestination(s, { zone: 'tableau', index: 0 }, 1)
    expect(key(dest)).toBe('freecell:0')
  })

  it('returns null when there is no legal move at all', () => {
    const s = blankState()
    // All free cells full, all columns full & non-accepting, no foundation move.
    s.freeCells = [card('clubs', 2), card('clubs', 3), card('clubs', 4), card('clubs', 5)]
    for (let i = 0; i < 8; i++) s.tableau[i] = [card('spades', 9)]
    s.tableau[0] = [card('spades', 9), card('hearts', 5)] // red 5, no black 6, no home
    const dest = bestDestination(s, { zone: 'tableau', index: 0 }, 1)
    expect(dest).toBeNull()
  })
})

describe('findHint', () => {
  it('returns a foundation move when one exists', () => {
    const s = blankState()
    s.tableau[0] = [card('spades', 7)]
    s.tableau[1] = [card('clubs', 1)] // ace can go home
    const hint = findHint(s)
    expect(hint).not.toBeNull()
    expect(key(hint!.to)).toBe('foundation:clubs')
  })

  it('returns a tableau build when no foundation move exists', () => {
    const s = blankState()
    s.tableau[0] = [card('hearts', 5)]
    s.tableau[1] = [card('spades', 6)] // red 5 -> black 6
    const hint = findHint(s)
    expect(hint).not.toBeNull()
    expect(hint!.to.zone).toBe('tableau')
  })

  it('returns null on a dead board with no useful move', () => {
    const s = blankState()
    // Every column holds a lone 9 (no aces to send home, no 8s/10s to build
    // with), free cells empty. Only parking moves exist — which findHint skips.
    const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
    for (let i = 0; i < 8; i++) s.tableau[i] = [card(suits[i % 4], 9)]
    expect(findHint(s)).toBeNull()
  })
})
