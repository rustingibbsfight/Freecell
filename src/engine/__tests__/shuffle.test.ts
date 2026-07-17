import { describe, it, expect } from 'vitest'
import { createDeck } from '../deck'
import { seededShuffle } from '../shuffle'

describe('seededShuffle', () => {
  it('is deterministic: same seed produces the same order', () => {
    const a = seededShuffle(createDeck(), 12345)
    const b = seededShuffle(createDeck(), 12345)
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })

  it('produces different orders for different seeds', () => {
    const a = seededShuffle(createDeck(), 1)
    const b = seededShuffle(createDeck(), 2)
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id))
  })

  it('is a permutation: preserves every card exactly once', () => {
    const original = createDeck()
    const shuffled = seededShuffle(original, 99)
    expect(shuffled).toHaveLength(52)
    expect(new Set(shuffled.map((c) => c.id))).toEqual(
      new Set(original.map((c) => c.id)),
    )
  })

  it('does not mutate the input deck', () => {
    const original = createDeck()
    const snapshot = original.map((c) => c.id)
    seededShuffle(original, 7)
    expect(original.map((c) => c.id)).toEqual(snapshot)
  })

  it('actually reorders the deck (not the identity)', () => {
    const original = createDeck()
    const shuffled = seededShuffle(original, 424242)
    expect(shuffled.map((c) => c.id)).not.toEqual(original.map((c) => c.id))
  })
})
