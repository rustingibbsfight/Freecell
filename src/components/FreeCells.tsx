import { PointerEvent } from 'react'
import { GameState } from '../engine/types'
import { CardView } from './CardView'
import { ClickTarget } from '../hooks/useGame'

interface Props {
  state: GameState
  selectedIds: ReadonlySet<string>
  hintSourceIds: ReadonlySet<string>
  legalTargetKeys: ReadonlySet<string>
  hintTargetKey: string | null
  dragging: boolean
  onClick: (t: ClickTarget) => void
  onDoubleClick: (t: ClickTarget) => void
  onCardPointerDown: (t: ClickTarget, e: PointerEvent) => void
}

export function FreeCells({
  state,
  selectedIds,
  hintSourceIds,
  legalTargetKeys,
  hintTargetKey,
  dragging,
  onClick,
  onDoubleClick,
  onCardPointerDown,
}: Props) {
  return (
    <div className="freecells" aria-label="free cells">
      {state.freeCells.map((card, i) => {
        const key = `freecell:${i}`
        const cls = [
          'cell',
          'slot',
          legalTargetKeys.has(key) ? 'droppable' : '',
          hintTargetKey === key ? 'hint-target' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={i}
            className={cls}
            data-drop={key}
            onClick={() => onClick({ kind: 'freecell', index: i })}
          >
            {card && (
              <CardView
                card={card}
                selected={selectedIds.has(card.id)}
                dragging={dragging && selectedIds.has(card.id)}
                hint={hintSourceIds.has(card.id)}
                onClick={() => onClick({ kind: 'freecell', index: i })}
                onDoubleClick={() => onDoubleClick({ kind: 'freecell', index: i })}
                onPointerDown={(e) => onCardPointerDown({ kind: 'freecell', index: i }, e)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
