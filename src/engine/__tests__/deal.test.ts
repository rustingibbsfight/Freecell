import { describe, it, expect } from 'vitest'
import { createDeck } from '../deck'
import { deal } from '../deal'

describe('deal', () => {
  const columns = deal(createDeck())

  it('produces exactly 8 tableau columns', () => {
    expect(columns).toHaveLength(8)
  })

  it('deals column sizes 7,7,7,7,6,6,6,6', () => {
    expect(columns.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
  })

  it('places all 52 cards exactly once across the columns', () => {
    const ids = columns.flat().map((c) => c.id)
    expect(ids).toHaveLength(52)
    expect(new Set(ids).size).toBe(52)
  })

  it('deals round-robin across columns (first 8 cards go to distinct columns)', () => {
    const deck = createDeck()
    const cols = deal(deck)
    // Round-robin: the first card of each column is the first 8 cards dealt.
    expect(cols.map((c) => c[0].id)).toEqual(deck.slice(0, 8).map((c) => c.id))
  })
})
