import { describe, it, expect } from 'vitest'
import { maxMovable } from '../supermove'

describe('maxMovable', () => {
  it('is (1 + freeCells) with no empty columns', () => {
    expect(maxMovable(0, 0)).toBe(1)
    expect(maxMovable(4, 0)).toBe(5)
    expect(maxMovable(2, 0)).toBe(3)
  })

  it('doubles for each empty column', () => {
    expect(maxMovable(0, 1)).toBe(2) // (1) * 2^1
    expect(maxMovable(0, 2)).toBe(4) // (1) * 2^2
    expect(maxMovable(4, 2)).toBe(20) // (5) * 2^2
  })

  it('classic full board: 4 free + 4 empty columns', () => {
    expect(maxMovable(4, 4)).toBe(80) // (5) * 16
  })

  it('when moving INTO an empty column, that column does not count', () => {
    // 0 free cells, 1 empty column, but the target IS the empty column.
    expect(maxMovable(0, 1, true)).toBe(1) // (1) * 2^0
    // 2 free cells, 3 empty, moving onto one of them -> uses 2 empties.
    expect(maxMovable(2, 3, true)).toBe(12) // (3) * 2^2
  })

  it('never returns less than 1', () => {
    expect(maxMovable(0, 0, true)).toBe(1)
  })
})
