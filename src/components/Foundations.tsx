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
  onClick: (t: ClickTarget) => void
}

export function Foundations({ state, onClick }: Props) {
  return (
    <div className="foundations" aria-label="foundations">
      {SUITS.map((suit) => {
        const rank = state.foundations[suit]
        return (
          <div
            key={suit}
            className={`foundation slot ${suit}`}
            aria-label={`${suit} foundation`}
            onClick={() => onClick({ kind: 'foundation', suit })}
          >
            {rank > 0 ? (
              <CardView
                card={{ suit, rank: rank as never, id: `${suit}-${rank}` }}
                onClick={() => onClick({ kind: 'foundation', suit })}
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
