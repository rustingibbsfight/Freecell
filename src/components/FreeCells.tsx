import { GameState } from '../engine/types'
import { CardView } from './CardView'
import { ClickTarget } from '../hooks/useGame'

interface Props {
  state: GameState
  selectedIds: ReadonlySet<string>
  onClick: (t: ClickTarget) => void
  onDoubleClick: (t: ClickTarget) => void
}

export function FreeCells({ state, selectedIds, onClick, onDoubleClick }: Props) {
  return (
    <div className="freecells" aria-label="free cells">
      {state.freeCells.map((card, i) => (
        <div
          key={i}
          className="cell slot"
          onClick={() => onClick({ kind: 'freecell', index: i })}
        >
          {card && (
            <CardView
              card={card}
              selected={selectedIds.has(card.id)}
              onClick={() => onClick({ kind: 'freecell', index: i })}
              onDoubleClick={() => onDoubleClick({ kind: 'freecell', index: i })}
            />
          )}
        </div>
      ))}
    </div>
  )
}
