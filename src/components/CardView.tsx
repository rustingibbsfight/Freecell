import { Card, Suit } from '../engine/types'
import { color } from '../engine/deck'

const SUIT_GLYPH: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

const RANK_LABEL: Record<number, string> = {
  1: 'A',
  11: 'J',
  12: 'Q',
  13: 'K',
}

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank)
}

interface CardViewProps {
  card: Card
  selected?: boolean
  stacked?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
}

export function CardView({ card, selected, stacked, onClick, onDoubleClick }: CardViewProps) {
  const cls = [
    'card',
    color(card),
    selected ? 'selected' : '',
    stacked ? 'stacked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      role="button"
      aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick?.()
      }}
    >
      <span className="corner top">
        {rankLabel(card.rank)}
        {SUIT_GLYPH[card.suit]}
      </span>
      <span className="pip">{SUIT_GLYPH[card.suit]}</span>
      <span className="corner bottom">
        {rankLabel(card.rank)}
        {SUIT_GLYPH[card.suit]}
      </span>
    </div>
  )
}
