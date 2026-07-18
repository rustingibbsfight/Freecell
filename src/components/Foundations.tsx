import { PointerEvent } from 'react'
import { GameState, Suit, SUITS } from '../engine/types'
import { CardView, rankLabel } from './CardView'
import { ClickTarget } from '../hooks/useGame'

const SUIT_GLYPH: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

interface Props {
  state: GameState
  selectedIds: ReadonlySet<string>
  legalTargetKeys: ReadonlySet<string>
  hintTargetKey: string | null
  dragging: boolean
  onClick: (t: ClickTarget) => void
  onCardPointerDown: (t: ClickTarget, e: PointerEvent) => void
}

export function Foundations({
  state,
  selectedIds,
  legalTargetKeys,
  hintTargetKey,
  dragging,
  onClick,
  onCardPointerDown,
}: Props) {
  return (
    <div className="foundations" aria-label="foundations">
      {SUITS.map((suit) => {
        const rank = state.foundations[suit]
        const key = `foundation:${suit}`
        const id = `${suit}-${rank}`
        const cls = [
          'foundation',
          'slot',
          suit,
          legalTargetKeys.has(key) ? 'droppable' : '',
          hintTargetKey === key ? 'hint-target' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={suit}
            className={cls}
            data-drop={key}
            aria-label={`${suit} foundation`}
            onClick={() => onClick({ kind: 'foundation', suit })}
          >
            {rank > 0 ? (
              <CardView
                card={{ suit, rank: rank as never, id }}
                selected={selectedIds.has(id)}
                dragging={dragging && selectedIds.has(id)}
                onClick={() => onClick({ kind: 'foundation', suit })}
                onPointerDown={(e) => onCardPointerDown({ kind: 'foundation', suit }, e)}
              />
            ) : (
              <span className="foundation-ghost">{SUIT_GLYPH[suit]}</span>
            )}
            {rank > 0 && <span className="visually-hidden">{rankLabel(rank)}</span>}
          </div>
        )
      })}
    </div>
  )
}
