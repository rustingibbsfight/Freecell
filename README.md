# FreeCell

A clone of the classic **FreeCell** solitaire card game, built **test-driven** with
**React + Vite + TypeScript** and tested with **Vitest**.

The design keeps a clean line between a **pure game engine** (no React, no DOM — just
data and rules) and a **thin React UI** on top. Every rule of the game lives in the
engine and is covered by tests written before the implementation.

## Play

```bash
npm install
npm run dev      # open the printed localhost URL
```

- **Click** a card (or a valid descending, alternating-color run) to select it, then
  **click a destination** — a free cell, a foundation, or another tableau column.
- **Double-click** a card to send it straight to its foundation if the move is legal.
- Toolbar: **New Game**, **Restart** (same deal), **Undo**, **Auto-finish** (sweeps
  safe cards home).
- Win by moving all 52 cards to the four foundations, each built up Ace→King by suit.

## Rules implemented

- 52 cards dealt into 8 columns: 7,7,7,7,6,6,6,6.
- 4 free cells (one card each) and 4 foundations (one per suit, Ace→King).
- A card moves onto a tableau column only if the target is the **opposite color and one
  rank higher**; empty columns accept anything.
- **Supermoves**: a valid run of N cards can move as a unit when
  `N ≤ (1 + freeCells) × 2^(emptyColumns)` (a target empty column doesn't count).

## Develop / test

```bash
npm test          # run the full Vitest suite once
npm run test:watch
npm run build     # typecheck + production build
```

## Project layout

```
src/
  engine/          Pure, framework-free game logic (fully unit-tested)
    types.ts       Card, Suit, Rank, GameState, Move
    deck.ts        createDeck, color helpers
    shuffle.ts     deterministic seeded shuffle (reproducible games)
    deal.ts        deal into 8 tableau columns
    rules.ts       move-legality predicates + valid-run detection
    supermove.ts   maximum movable-run size
    game.ts        newGame, isLegalMove, applyMove (immutable), isWon, auto-finish
    __tests__/     tests written first, red → green
  hooks/useGame.ts React state: selection, undo stack, seed; delegates rules to engine
  components/       CardView, FreeCells, Foundations, Tableau, Board (presentation only)
```

The engine never mutates state — `applyMove` returns a new `GameState`, which makes
Undo trivial and React re-renders predictable. Games are seeded, so any deal is
reproducible and every test is deterministic.
