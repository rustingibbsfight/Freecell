import { describe, it, expect } from 'vitest'
import { createDeck, color, isRed, isBlack } from '../deck'
import { SUITS, RANKS } from '../types'

describe('createDeck', () => {
  it('creates exactly 52 cards', () => {
    expect(createDeck()).toHaveLength(52)
  })

  it('contains every suit/rank combination exactly once', () => {
    const deck = createDeck()
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const matches = deck.filter((c) => c.suit === suit && c.rank === rank)
        expect(matches).toHaveLength(1)
      }
    }
  })

  it('gives every card a unique id', () => {
    const ids = createDeck().map((c) => c.id)
    expect(new Set(ids).size).toBe(52)
  })
})

describe('color helpers', () => {
  it('maps hearts and diamonds to red', () => {
    expect(color({ suit: 'hearts', rank: 1, id: 'hearts-1' })).toBe('red')
    expect(color({ suit: 'diamonds', rank: 1, id: 'diamonds-1' })).toBe('red')
  })

  it('maps clubs and spades to black', () => {
    expect(color({ suit: 'clubs', rank: 1, id: 'clubs-1' })).toBe('black')
    expect(color({ suit: 'spades', rank: 1, id: 'spades-1' })).toBe('black')
  })

  it('isRed / isBlack are consistent complements', () => {
    const red = { suit: 'hearts', rank: 5, id: 'hearts-5' } as const
    const black = { suit: 'spades', rank: 5, id: 'spades-5' } as const
    expect(isRed(red)).toBe(true)
    expect(isBlack(red)).toBe(false)
    expect(isBlack(black)).toBe(true)
    expect(isRed(black)).toBe(false)
  })
})
