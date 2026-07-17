import { GameState } from '../engine/types'
import { CardView } from './CardView'
import { ClickTarget } from '../hooks/useGame'

interface Props {
  state: GameState
  selectedIds: ReadonlySet<string>
  onClick: (t: ClickTarget) => void
  onDoubleClick: (t: ClickTarget) => void
}

export function Tableau({ state, selectedIds, onClick, onDoubleClick }: Props) {
  return (
    <div className="tableau" aria-label="tableau">
      {state.tableau.map((col, colIndex) => (
        <div
          key={colIndex}
          className="column slot"
          data-testid={`column-${colIndex}`}
          onClick={() => onClick({ kind: 'tableau-column', col: colIndex })}
        >
          {col.map((card, cardIndex) => (
            <CardView
              key={card.id}
              card={card}
              stacked={cardIndex < col.length - 1}
              selected={selectedIds.has(card.id)}
              onClick={() =>
                onClick({ kind: 'tableau-card', col: colIndex, index: cardIndex })
              }
              onDoubleClick={() =>
                onDoubleClick({ kind: 'tableau-card', col: colIndex, index: cardIndex })
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}
