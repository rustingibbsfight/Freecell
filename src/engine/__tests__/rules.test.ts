import { describe, it, expect } from 'vitest'
import { Card, Suit } from '../types'
import {
  canMoveToFoundation,
  canMoveToFreeCell,
  canStackOnTableau,
  isValidRun,
} from '../rules'

const card = (suit: Suit, rank: number): Card =>
  ({ suit, rank: rank as Card['rank'], id: `${suit}-${rank}` })

describe('canMoveToFoundation', () => {
  it('accepts an Ace onto an empty foundation of its suit', () => {
    expect(canMoveToFoundation(card('hearts', 1), 0)).toBe(true)
  })

  it('rejects a non-Ace onto an empty foundation', () => {
    expect(canMoveToFoundation(card('hearts', 2), 0)).toBe(false)
  })

  it('accepts the next rank up (same suit)', () => {
    expect(canMoveToFoundation(card('hearts', 6), 5)).toBe(true)
  })

  it('rejects skipping a rank', () => {
    expect(canMoveToFoundation(card('hearts', 7), 5)).toBe(false)
  })

  it('rejects moving onto a completed (King) foundation', () => {
    expect(canMoveToFoundation(card('hearts', 13), 13)).toBe(false)
  })
})

describe('canMoveToFreeCell', () => {
  it('accepts a card into an empty cell', () => {
    expect(canMoveToFreeCell(null)).toBe(true)
  })

  it('rejects a card into an occupied cell', () => {
    expect(canMoveToFreeCell(card('spades', 4))).toBe(false)
  })
})

describe('canStackOnTableau', () => {
  it('accepts any card onto an empty column', () => {
    expect(canStackOnTableau(card('spades', 5), undefined)).toBe(true)
  })

  it('accepts opposite color, one rank lower', () => {
    // red 5 onto black 6
    expect(canStackOnTableau(card('hearts', 5), card('spades', 6))).toBe(true)
    // black 9 onto red 10
    expect(canStackOnTableau(card('clubs', 9), card('diamonds', 10))).toBe(true)
  })

  it('rejects same color', () => {
    expect(canStackOnTableau(card('hearts', 5), card('diamonds', 6))).toBe(false)
    expect(canStackOnTableau(card('spades', 5), card('clubs', 6))).toBe(false)
  })

  it('rejects wrong rank (not exactly one lower)', () => {
    expect(canStackOnTableau(card('hearts', 5), card('spades', 7))).toBe(false)
    expect(canStackOnTableau(card('hearts', 7), card('spades', 6))).toBe(false)
  })
})

describe('isValidRun', () => {
  it('accepts a single card', () => {
    expect(isValidRun([card('hearts', 7)])).toBe(true)
  })

  it('accepts a descending alternating-color run', () => {
    // 8red, 7black, 6red
    expect(
      isValidRun([card('hearts', 8), card('spades', 7), card('diamonds', 6)]),
    ).toBe(true)
  })

  it('rejects a run with a same-color adjacency', () => {
    expect(
      isValidRun([card('hearts', 8), card('diamonds', 7)]),
    ).toBe(false)
  })

  it('rejects a run that is not strictly descending by one', () => {
    expect(
      isValidRun([card('hearts', 8), card('spades', 6)]),
    ).toBe(false)
  })

  it('rejects an ascending run', () => {
    expect(
      isValidRun([card('hearts', 6), card('spades', 7)]),
    ).toBe(false)
  })
})
