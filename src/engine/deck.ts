import { Card, Color, Suit, SUITS, RANKS } from './types'

/** Build a fresh, ordered 52-card deck (suit-major, Ace..King). */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${suit}-${rank}` })
    }
  }
  return deck
}

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['hearts', 'diamonds'])

export function color(card: Card): Color {
  return RED_SUITS.has(card.suit) ? 'red' : 'black'
}

export function isRed(card: Card): boolean {
  return color(card) === 'red'
}

export function isBlack(card: Card): boolean {
  return color(card) === 'black'
}
