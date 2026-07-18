import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGame } from '../useGame'

/** Index of the exposed (movable) card in a tableau column. */
const topIndexOf = (len: number) => len - 1

describe('useGame — selection & highlighting', () => {
  it('selecting a card exposes it and computes legal targets (free cells always accept it)', () => {
    const { result } = renderHook(() => useGame(1))
    const col0 = result.current.state.tableau[0]
    const i = topIndexOf(col0.length)

    expect(result.current.legalTargetKeys.size).toBe(0)
    act(() => result.current.handleClick({ kind: 'tableau-card', col: 0, index: i }))

    expect(result.current.selectedIds.has(col0[i].id)).toBe(true)
    // A lone card can always move to any empty free cell.
    expect(result.current.legalTargetKeys.has('freecell:0')).toBe(true)
  })

  it('clicking the selected source again deselects', () => {
    const { result } = renderHook(() => useGame(1))
    const i = topIndexOf(result.current.state.tableau[0].length)
    act(() => result.current.handleClick({ kind: 'tableau-card', col: 0, index: i }))
    expect(result.current.selectedIds.size).toBeGreaterThan(0)
    act(() => result.current.handleClick({ kind: 'tableau-column', col: 0 }))
    expect(result.current.selectedIds.size).toBe(0)
  })
})

describe('useGame — smart double-click', () => {
  it('moves the card off its column and undoes as a single step (with auto-play)', () => {
    const { result } = renderHook(() => useGame(1))
    const col0 = result.current.state.tableau[0]
    const i = topIndexOf(col0.length)
    const movedId = col0[i].id

    act(() => result.current.handleDoubleClick({ kind: 'tableau-card', col: 0, index: i }))
    expect(result.current.state.tableau[0].some((c) => c.id === movedId)).toBe(false)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.state.tableau[0][i]?.id).toBe(movedId)
    expect(result.current.canUndo).toBe(false)
  })
})

describe('useGame — drag & drop', () => {
  it('startDrag selects and marks dragging; dropOn performs the move', () => {
    const { result } = renderHook(() => useGame(1))
    const col0 = result.current.state.tableau[0]
    const i = topIndexOf(col0.length)
    const movedId = col0[i].id

    act(() => result.current.startDrag({ kind: 'tableau-card', col: 0, index: i }))
    expect(result.current.dragging).toBe(true)
    expect(result.current.selectedIds.has(movedId)).toBe(true)

    act(() => result.current.dropOn({ kind: 'freecell', index: 0 }))
    expect(result.current.dragging).toBe(false)
    // The card left column 0 (it now sits in the free cell, or auto-played home).
    expect(result.current.state.tableau[0].some((c) => c.id === movedId)).toBe(false)
    expect(result.current.canUndo).toBe(true)
  })

  it('cancelDrag clears the drag without moving anything', () => {
    const { result } = renderHook(() => useGame(1))
    const before = result.current.state
    const i = topIndexOf(before.tableau[0].length)
    act(() => result.current.startDrag({ kind: 'tableau-card', col: 0, index: i }))
    act(() => result.current.cancelDrag())
    expect(result.current.dragging).toBe(false)
    expect(result.current.state).toBe(before)
    expect(result.current.canUndo).toBe(false)
  })
})

describe('useGame — hint', () => {
  it('showHint highlights a source and a target, or reports none', () => {
    const { result } = renderHook(() => useGame(1))
    act(() => result.current.showHint())
    const hinted = result.current.hintSourceIds.size > 0 && result.current.hintTargetKey !== null
    const none = result.current.message === 'No moves available'
    expect(hinted || none).toBe(true)
  })
})
