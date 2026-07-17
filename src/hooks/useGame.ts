import { useCallback, useMemo, useState } from 'react'
import { Card, GameState, Move, Position, Suit } from '../engine/types'
import {
  newGame,
  isLegalMove,
  applyMove,
  isWon,
  autoMoveToFoundations,
  foundationDestination,
} from '../engine/game'
import { isValidRun } from '../engine/rules'

/** A click coming from the board, described semantically. */
export type ClickTarget =
  | { kind: 'tableau-card'; col: number; index: number }
  | { kind: 'tableau-column'; col: number }
  | { kind: 'freecell'; index: number }
  | { kind: 'foundation'; suit: Suit }

interface Selection {
  from: Position
  count: number
  ids: string[]
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

export interface UseGame {
  state: GameState
  selectedIds: ReadonlySet<string>
  won: boolean
  message: string | null
  canUndo: boolean
  handleClick: (target: ClickTarget) => void
  handleDoubleClick: (target: ClickTarget) => void
  undo: () => void
  restart: () => void
  deal: (seed?: number) => void
  autoFinish: () => void
}

export function useGame(initialSeed?: number): UseGame {
  const [seed, setSeed] = useState(() => initialSeed ?? randomSeed())
  const [state, setState] = useState<GameState>(() => newGame(seed))
  const [history, setHistory] = useState<GameState[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const commit = useCallback((next: GameState) => {
    setHistory((h) => [...h, state])
    setState(next)
  }, [state])

  const push = useCallback((next: GameState, prev: GameState) => {
    setHistory((h) => [...h, prev])
    setState(next)
  }, [])

  /** The cards that would be picked up if the given target were selected. */
  const selectableRun = useCallback(
    (target: ClickTarget): Selection | null => {
      if (target.kind === 'freecell') {
        const card = state.freeCells[target.index]
        return card ? { from: { zone: 'freecell', index: target.index }, count: 1, ids: [card.id] } : null
      }
      if (target.kind === 'tableau-card') {
        const col = state.tableau[target.col]
        const run = col.slice(target.index)
        if (run.length === 0 || !isValidRun(run)) return null
        return {
          from: { zone: 'tableau', index: target.col },
          count: run.length,
          ids: run.map((c) => c.id),
        }
      }
      return null
    },
    [state],
  )

  const targetToPosition = (target: ClickTarget): Position | null => {
    switch (target.kind) {
      case 'tableau-card':
      case 'tableau-column':
        return { zone: 'tableau', index: target.col }
      case 'freecell':
        return { zone: 'freecell', index: target.index }
      case 'foundation':
        return { zone: 'foundation', suit: target.suit }
    }
  }

  const tryMove = useCallback(
    (from: Selection, to: Position): boolean => {
      const move: Move = { from: from.from, to, count: from.count }
      if (isLegalMove(state, move)) {
        push(applyMove(state, move), state)
        return true
      }
      return false
    },
    [state, push],
  )

  const handleClick = useCallback(
    (target: ClickTarget) => {
      setMessage(null)

      if (!selection) {
        const sel = selectableRun(target)
        if (sel) setSelection(sel)
        return
      }

      const dest = targetToPosition(target)
      if (!dest) {
        setSelection(null)
        return
      }

      // Clicking the exact selected source again deselects.
      const clickedSameSource =
        (dest.zone === 'tableau' &&
          selection.from.zone === 'tableau' &&
          dest.index === selection.from.index) ||
        (dest.zone === 'freecell' &&
          selection.from.zone === 'freecell' &&
          dest.index === selection.from.index)
      if (clickedSameSource) {
        setSelection(null)
        return
      }

      if (tryMove(selection, dest)) {
        setSelection(null)
        return
      }

      // Illegal: if the click lands on another selectable source, switch to it.
      const sel = selectableRun(target)
      if (sel) {
        setSelection(sel)
      } else {
        setSelection(null)
        setMessage('Not a legal move')
      }
    },
    [selection, selectableRun, tryMove],
  )

  const handleDoubleClick = useCallback(
    (target: ClickTarget) => {
      setMessage(null)
      setSelection(null)
      let from: Position | null = null
      let card: Card | undefined
      if (target.kind === 'freecell') {
        from = { zone: 'freecell', index: target.index }
        card = state.freeCells[target.index] ?? undefined
      } else if (target.kind === 'tableau-card') {
        const col = state.tableau[target.col]
        if (target.index === col.length - 1) {
          from = { zone: 'tableau', index: target.col }
          card = col[target.index]
        }
      }
      if (!from || !card) return
      const dest = foundationDestination(state, card)
      if (dest) push(applyMove(state, { from, to: dest }), state)
    },
    [state, push],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setState(prev)
      setSelection(null)
      setMessage(null)
      return h.slice(0, -1)
    })
  }, [])

  const deal = useCallback((newSeedArg?: number) => {
    const s = newSeedArg ?? randomSeed()
    setSeed(s)
    setState(newGame(s))
    setHistory([])
    setSelection(null)
    setMessage(null)
  }, [])

  const restart = useCallback(() => {
    setState(newGame(seed))
    setHistory([])
    setSelection(null)
    setMessage(null)
  }, [seed])

  const autoFinish = useCallback(() => {
    const next = autoMoveToFoundations(state)
    if (next !== state) commit(next)
    setSelection(null)
  }, [state, commit])

  const selectedIds = useMemo(
    () => new Set(selection?.ids ?? []),
    [selection],
  )

  return {
    state,
    selectedIds,
    won: isWon(state),
    message,
    canUndo: history.length > 0,
    handleClick,
    handleDoubleClick,
    undo,
    restart,
    deal,
    autoFinish,
  }
}
