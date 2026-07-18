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
  legalTargetKeys: ReadonlySet<string>
  hintTargetKey: string | null
  onClick: (t: ClickTarget) => void
}

export function Foundations({ state, legalTargetKeys, hintTargetKey, onClick }: Props) {
  return (
    <div className="foundations" aria-label="foundations">
      {SUITS.map((suit) => {
        const rank = state.foundations[suit]
        const key = `foundation:${suit}`
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
