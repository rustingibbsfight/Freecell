import { PointerEvent as ReactPointerEvent, useLayoutEffect, useRef, useState } from 'react'
import { Card, Rank, Suit } from '../engine/types'
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

  // FLIP animation: after each move, slide every card that changed position from
  // its old spot to its new one — this also animates the auto-advance flights.
  const prevRects = useRef<Map<string, DOMRect>>(new Map())
  const animateRef = useRef(game.animate)
  animateRef.current = game.animate

  useLayoutEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-card-id]'))
    const next = new Map<string, DOMRect>()
    for (const el of nodes) next.set(el.dataset.cardId!, el.getBoundingClientRect())

    if (animateRef.current && !reduce && typeof Element.prototype.animate === 'function') {
      for (const el of nodes) {
        const id = el.dataset.cardId!
        const prev = prevRects.current.get(id)
        if (!prev) continue
        const rect = next.get(id)!
        const dx = prev.left - rect.left
        const dy = prev.top - rect.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
        el.style.zIndex = '60'
        const anim = el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 240, easing: 'cubic-bezier(.2,.7,.3,1)' },
        )
        const clear = () => {
          el.style.zIndex = ''
        }
        anim.onfinish = clear
        anim.oncancel = clear
      }
    }
    prevRects.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.state])

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
    if (target.kind === 'foundation') {
      const rank = g.state.foundations[target.suit]
      return rank > 0
        ? [{ suit: target.suit, rank: rank as Rank, id: `${target.suit}-${rank}` }]
        : []
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
          selectedIds={game.selectedIds}
          legalTargetKeys={game.legalTargetKeys}
          hintTargetKey={game.hintTargetKey}
          dragging={game.dragging}
          onClick={handleClick}
          onCardPointerDown={onCardPointerDown}
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
          {ghost.cards.map((card) => (
            <div key={card.id} className="ghost-card">
              <CardView card={card} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
