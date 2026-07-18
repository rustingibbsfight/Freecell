import { PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import { Card, Suit } from '../engine/types'
import { isValidRun } from '../engine/rules'
import { useGame, ClickTarget } from '../hooks/useGame'
import { CardView } from './CardView'
import { FreeCells } from './FreeCells'
import { Foundations } from './Foundations'
import { Tableau } from './Tableau'

interface BoardProps {
  /** Optional fixed seed, mainly for tests / reproducible games. */
  seed?: number
}

const DRAG_THRESHOLD = 6 // px before a press becomes a drag

interface GhostState {
  cards: Card[]
  x: number
  y: number
}

function parseDropKey(key: string): ClickTarget {
  const [zone, val] = key.split(':')
  if (zone === 'freecell') return { kind: 'freecell', index: Number(val) }
  if (zone === 'foundation') return { kind: 'foundation', suit: val as Suit }
  return { kind: 'tableau-column', col: Number(val) }
}

export function Board({ seed }: BoardProps) {
  const game = useGame(seed)

  // Always read the freshest game inside long-lived pointer handlers.
  const gameRef = useRef(game)
  gameRef.current = game

  const [ghost, setGhost] = useState<GhostState | null>(null)
  const justDragged = useRef(false)

  /** Cards a drag from this target would carry (bottom→top). */
  const cardsForTarget = (target: ClickTarget): Card[] => {
    const g = gameRef.current
    if (target.kind === 'freecell') {
      const c = g.state.freeCells[target.index]
      return c ? [c] : []
    }
    if (target.kind === 'tableau-card') {
      const run = g.state.tableau[target.col].slice(target.index)
      return isValidRun(run) ? run : []
    }
    return []
  }

  const onCardPointerDown = (target: ClickTarget, e: ReactPointerEvent) => {
    if (e.button !== 0) return // primary button / touch only
    const cards = cardsForTarget(target)
    if (cards.length === 0) return

    justDragged.current = false
    const start = { x: e.clientX, y: e.clientY }
    let moved = false

    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) {
        return
      }
      if (!moved) {
        moved = true
        gameRef.current.startDrag(target)
      }
      setGhost({ cards, x: ev.clientX, y: ev.clientY })
    }

    const finish = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      if (!moved) return // a tap: let the click handler run
      justDragged.current = true
      setGhost(null)
      const dropEl = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest('[data-drop]')
      const key = dropEl?.getAttribute('data-drop')
      if (key) gameRef.current.dropOn(parseDropKey(key))
      else gameRef.current.cancelDrag()
    }

    const cancel = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      setGhost(null)
      gameRef.current.cancelDrag()
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
  }

  // Swallow the click that a browser fires immediately after a drag-drop.
  const handleClick = (target: ClickTarget) => {
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    game.handleClick(target)
  }

  const zoneProps = {
    state: game.state,
    selectedIds: game.selectedIds,
    hintSourceIds: game.hintSourceIds,
    legalTargetKeys: game.legalTargetKeys,
    hintTargetKey: game.hintTargetKey,
    dragging: game.dragging,
    onClick: handleClick,
    onDoubleClick: game.handleDoubleClick,
    onCardPointerDown,
  }

  return (
    <div className="board">
      <header className="toolbar">
        <h1>FreeCell</h1>
        <div className="controls">
          <button onClick={() => game.deal()}>New Game</button>
          <button onClick={game.restart}>Restart</button>
          <button onClick={game.undo} disabled={!game.canUndo}>
            Undo
          </button>
          <button onClick={game.showHint}>Hint</button>
          <button onClick={game.autoFinish}>Auto-finish</button>
        </div>
      </header>

      <div className="top-row">
        <FreeCells {...zoneProps} />
        <Foundations
          state={game.state}
          legalTargetKeys={game.legalTargetKeys}
          hintTargetKey={game.hintTargetKey}
          onClick={handleClick}
        />
      </div>

      <Tableau {...zoneProps} />

      <div className="status" role="status" aria-live="polite">
        {game.won ? (
          <span className="win-banner">🎉 You win! 🎉</span>
        ) : (
          game.message && <span className="message">{game.message}</span>
        )}
      </div>

      {ghost && (
        <div
          className="drag-ghost"
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden="true"
        >
          {ghost.cards.map((card, i) => (
            <div key={card.id} className="ghost-card" style={{ marginTop: i === 0 ? 0 : -78 }}>
              <CardView card={card} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
