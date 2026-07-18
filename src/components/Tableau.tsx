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

export function Tableau({
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
    <div className="tableau" aria-label="tableau">
      {state.tableau.map((col, colIndex) => {
        const key = `tableau:${colIndex}`
        const cls = [
          'column',
          'slot',
          legalTargetKeys.has(key) ? 'droppable' : '',
          hintTargetKey === key ? 'hint-target' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={colIndex}
            className={cls}
            data-drop={key}
            data-testid={`column-${colIndex}`}
            onClick={() => onClick({ kind: 'tableau-column', col: colIndex })}
          >
            {col.map((card, cardIndex) => (
              <CardView
                key={card.id}
                card={card}
                stacked={cardIndex < col.length - 1}
                selected={selectedIds.has(card.id)}
                dragging={dragging && selectedIds.has(card.id)}
                hint={hintSourceIds.has(card.id)}
                onClick={() => onClick({ kind: 'tableau-card', col: colIndex, index: cardIndex })}
                onDoubleClick={() =>
                  onDoubleClick({ kind: 'tableau-card', col: colIndex, index: cardIndex })
                }
                onPointerDown={(e) =>
                  onCardPointerDown({ kind: 'tableau-card', col: colIndex, index: cardIndex }, e)
                }
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
