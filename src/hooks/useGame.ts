import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameState, Position, Suit } from '../engine/types'
import {
  newGame,
  isLegalMove,
  applyMove,
  isWon,
  autoMoveToFoundations,
  bestDestination,
  legalDestinations,
} from '../engine/game'
import { findStrategicHint, StrategicHint } from '../engine/solver'
import { isValidRun } from '../engine/rules'

/** A click/drop target coming from the board, described semantically. */
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

interface Hint {
  sourceIds: string[]
  targetKey: string
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

/** Stable string key for a destination position (used for highlighting). */
export function positionKey(p: Position): string {
  return p.zone === 'foundation' ? `foundation:${p.suit}` : `${p.zone}:${p.index}`
}

export interface UseGame {
  state: GameState
  selectedIds: ReadonlySet<string>
  legalTargetKeys: ReadonlySet<string>
  hintSourceIds: ReadonlySet<string>
  hintTargetKey: string | null
  dragging: boolean
  animate: boolean
  won: boolean
  message: string | null
  canUndo: boolean
  handleClick: (target: ClickTarget) => void
  handleDoubleClick: (target: ClickTarget) => void
  startDrag: (target: ClickTarget) => void
  dropOn: (target: ClickTarget) => void
  cancelDrag: () => void
  showHint: () => void
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
  const [dragging, setDragging] = useState(false)
  const [hint, setHint] = useState<Hint | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // True when the latest state change is a move worth animating (vs a deal/undo).
  const [animate, setAnimate] = useState(false)
  // Hint solving runs off the main thread (Web Worker) — silently, with no UI
  // busy state. hintReq guards against applying a stale/superseded result.
  const workerRef = useRef<Worker | null>(null)
  const hintReq = useRef(0)

  const push = useCallback((next: GameState, prev: GameState) => {
    setHistory((h) => [...h, prev])
    setState(next)
    setAnimate(true)
  }, [])

  /** Card ids that a source position would pick up. */
  const movingIds = useCallback(
    (from: Position, count: number): string[] => {
      if (from.zone === 'tableau') {
        const col = state.tableau[from.index]
        return col.slice(col.length - count).map((c) => c.id)
      }
      if (from.zone === 'freecell') {
        const c = state.freeCells[from.index]
        return c ? [c.id] : []
      }
      return []
    },
    [state],
  )

  /** The cards that would be picked up if the given target were selected. */
  const selectableRun = useCallback(
    (target: ClickTarget): Selection | null => {
      if (target.kind === 'freecell') {
        const card = state.freeCells[target.index]
        return card
          ? { from: { zone: 'freecell', index: target.index }, count: 1, ids: [card.id] }
          : null
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
      if (target.kind === 'foundation') {
        // The exposed top foundation card can be picked up and pulled back.
        const rank = state.foundations[target.suit]
        if (rank === 0) return null
        return {
          from: { zone: 'foundation', suit: target.suit },
          count: 1,
          ids: [`${target.suit}-${rank}`],
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

  /**
   * Apply a move, then auto-play safe cards to the foundations, recording the
   * whole thing as a single undo step. Returns whether the move was legal.
   */
  const performMove = useCallback(
    (from: Position, to: Position, count: number): boolean => {
      const move = { from, to, count }
      if (!isLegalMove(state, move)) return false
      const moved = applyMove(state, move)
      // Don't auto-play after a pull-back, or the card would fly right back home.
      const finalState = from.zone === 'foundation' ? moved : autoMoveToFoundations(moved)
      push(finalState, state)
      setHint(null)
      hintReq.current++ // cancel any in-flight hint for the old board
      return true
    },
    [state, push],
  )

  const handleClick = useCallback(
    (target: ClickTarget) => {
      setMessage(null)
      setHint(null)

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

      if (performMove(selection.from, dest, selection.count)) {
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
    [selection, selectableRun, performMove],
  )

  /** Double-click / smart-move: send a card or run to its single best legal spot. */
  const handleDoubleClick = useCallback(
    (target: ClickTarget) => {
      setMessage(null)
      setHint(null)
      setSelection(null)

      let from: Position | null = null
      let count = 1
      if (target.kind === 'freecell') {
        if (!state.freeCells[target.index]) return
        from = { zone: 'freecell', index: target.index }
      } else if (target.kind === 'tableau-card') {
        const col = state.tableau[target.col]
        const run = col.slice(target.index)
        if (run.length === 0 || !isValidRun(run)) return
        from = { zone: 'tableau', index: target.col }
        count = run.length
      }
      if (!from) return

      const dest = bestDestination(state, from, count)
      if (dest) performMove(from, dest, count)
    },
    [state, performMove],
  )

  const startDrag = useCallback(
    (target: ClickTarget) => {
      const sel = selectableRun(target)
      if (!sel) return
      setMessage(null)
      setHint(null)
      setSelection(sel)
      setDragging(true)
    },
    [selectableRun],
  )

  const dropOn = useCallback(
    (target: ClickTarget) => {
      setDragging(false)
      if (!selection) return
      const dest = targetToPosition(target)
      if (dest) performMove(selection.from, dest, selection.count)
      setSelection(null)
    },
    [selection, performMove],
  )

  const cancelDrag = useCallback(() => {
    setDragging(false)
    setSelection(null)
  }, [])

  const applyHintResult = useCallback(
    (h: StrategicHint | null) => {
      if (!h) {
        setHint(null)
        setMessage('No moves available')
        return
      }
      setMessage(null)
      setHint({
        sourceIds: movingIds(h.move.from, h.move.count ?? 1),
        targetKey: positionKey(h.move.to),
      })
    },
    [movingIds],
  )

  /** Lazily create the hint worker; returns null where Workers aren't available. */
  const getWorker = useCallback((): Worker | null => {
    if (typeof Worker === 'undefined') return null
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(new URL('../engine/hint.worker.ts', import.meta.url), {
          type: 'module',
        })
      } catch {
        return null
      }
    }
    return workerRef.current
  }, [])

  useEffect(() => () => workerRef.current?.terminate(), [])

  const showHint = useCallback(() => {
    setSelection(null)
    const worker = getWorker()
    if (!worker) {
      // No Worker (tests / unsupported): solve synchronously.
      applyHintResult(findStrategicHint(state))
      return
    }
    const reqId = ++hintReq.current
    setHint(null)
    setMessage(null)
    const onMessage = (e: MessageEvent<{ reqId: number; hint: StrategicHint | null }>) => {
      if (e.data.reqId !== hintReq.current) return // superseded by a newer request/move
      worker.removeEventListener('message', onMessage)
      applyHintResult(e.data.hint)
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ reqId, state })
  }, [state, getWorker, applyHintResult])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setState(prev)
      setSelection(null)
      setDragging(false)
      setHint(null)
      setMessage(null)
      setAnimate(false)
      hintReq.current++
      return h.slice(0, -1)
    })
  }, [])

  const resetTo = useCallback((next: GameState) => {
    setState(next)
    setHistory([])
    setSelection(null)
    setDragging(false)
    setHint(null)
    setMessage(null)
    setAnimate(false)
    hintReq.current++
  }, [])

  const deal = useCallback(
    (newSeedArg?: number) => {
      const s = newSeedArg ?? randomSeed()
      setSeed(s)
      resetTo(newGame(s))
    },
    [resetTo],
  )

  const restart = useCallback(() => resetTo(newGame(seed)), [seed, resetTo])

  const autoFinish = useCallback(() => {
    const next = autoMoveToFoundations(state)
    if (next !== state) push(next, state)
    setSelection(null)
    setHint(null)
  }, [state, push])

  const selectedIds = useMemo(() => new Set(selection?.ids ?? []), [selection])

  const legalTargetKeys = useMemo(() => {
    if (!selection) return new Set<string>()
    return new Set(
      legalDestinations(state, selection.from, selection.count).map(positionKey),
    )
  }, [state, selection])

  const hintSourceIds = useMemo(() => new Set(hint?.sourceIds ?? []), [hint])

  return {
    state,
    selectedIds,
    legalTargetKeys,
    hintSourceIds,
    hintTargetKey: hint?.targetKey ?? null,
    dragging,
    animate,
    won: isWon(state),
    message,
    canUndo: history.length > 0,
    handleClick,
    handleDoubleClick,
    startDrag,
    dropOn,
    cancelDrag,
    showHint,
    undo,
    restart,
    deal,
    autoFinish,
  }
}
