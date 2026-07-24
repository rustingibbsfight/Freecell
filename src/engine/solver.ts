import { GameState, Move, SUITS } from './types'
import { canMoveToFoundation, canStackOnTableau } from './rules'
import { maxMovable } from './supermove'
import {
  applyMove,
  autoMoveToFoundations,
  isWon,
  freeCellCount,
  emptyColumnCount,
  movableRunLength,
} from './game'

/**
 * A lookahead FreeCell solver used to power the "Hint" feature.
 *
 * It searches the move graph with weighted A* — sending cards home, unburying
 * the next-needed cards, and using free cells / empty columns as staging — so a
 * hint reflects a real plan several moves deep rather than the first legal move
 * (which caused two-card ping-pong loops). Auto-play is applied to every
 * successor, mirroring how the game actually behaves after each move.
 */

// ---------------------------------------------------------------------------
// Move generation
// ---------------------------------------------------------------------------

/**
 * All *useful* legal moves from `state`. Empty columns and empty free cells are
 * interchangeable, so only one representative of each is emitted. Relocating an
 * entire pile onto an empty column is pruned — it makes no progress and is the
 * classic source of hint loops.
 */
export function generateMoves(state: GameState): Move[] {
  const moves: Move[] = []
  const firstEmptyCell = state.freeCells.findIndex((c) => c === null)
  const free = freeCellCount(state)
  const empties = emptyColumnCount(state)

  // Free-cell sources.
  state.freeCells.forEach((c, i) => {
    if (!c) return
    if (canMoveToFoundation(c, state.foundations[c.suit])) {
      moves.push({ from: { zone: 'freecell', index: i }, to: { zone: 'foundation', suit: c.suit }, count: 1 })
    }
    let addedEmpty = false
    state.tableau.forEach((col, j) => {
      if (col.length === 0) {
        if (!addedEmpty) {
          moves.push({ from: { zone: 'freecell', index: i }, to: { zone: 'tableau', index: j }, count: 1 })
          addedEmpty = true
        }
      } else if (canStackOnTableau(c, col[col.length - 1])) {
        moves.push({ from: { zone: 'freecell', index: i }, to: { zone: 'tableau', index: j }, count: 1 })
      }
    })
  })

  // Tableau sources.
  state.tableau.forEach((col, i) => {
    if (col.length === 0) return
    const runLen = movableRunLength(col)
    const top = col[col.length - 1]

    if (canMoveToFoundation(top, state.foundations[top.suit])) {
      moves.push({ from: { zone: 'tableau', index: i }, to: { zone: 'foundation', suit: top.suit }, count: 1 })
    }
    if (firstEmptyCell !== -1) {
      moves.push({ from: { zone: 'tableau', index: i }, to: { zone: 'freecell', index: firstEmptyCell }, count: 1 })
    }

    let addedEmpty = false
    state.tableau.forEach((tcol, j) => {
      if (j === i) return
      const targetEmpty = tcol.length === 0
      if (targetEmpty && addedEmpty) return

      const cap = maxMovable(free, empties, targetEmpty)
      let count = 0
      if (targetEmpty) {
        count = Math.min(runLen, cap)
        // Skip relocating a whole pile onto an empty column (no progress).
        if (count === col.length) count = 0
      } else {
        for (let k = 1; k <= Math.min(runLen, cap); k++) {
          if (canStackOnTableau(col[col.length - k], tcol[tcol.length - 1])) {
            count = k
            break
          }
        }
      }
      if (count > 0) {
        moves.push({ from: { zone: 'tableau', index: i }, to: { zone: 'tableau', index: j }, count })
        if (targetEmpty) addedEmpty = true
      }
    })
  })

  return moves
}

// ---------------------------------------------------------------------------
// Heuristic & canonical hashing
// ---------------------------------------------------------------------------

/** Lower is closer to a win. */
function heuristic(state: GameState): number {
  let h = 0
  for (const s of SUITS) h += 13 - state.foundations[s] // cards not yet home

  // Depth of each next-needed card in the tableau (how much digging it needs).
  for (const s of SUITS) {
    const need = state.foundations[s] + 1
    if (need > 13) continue
    for (const col of state.tableau) {
      const idx = col.findIndex((c) => c.suit === s && c.rank === need)
      if (idx !== -1) {
        h += (col.length - 1 - idx) * 2
        break
      }
    }
  }

  // Blockers: a card sitting on top of a lower same-suit card in the same column
  // must be moved before that (sooner-needed) card can go home.
  for (const col of state.tableau) {
    for (let b = 1; b < col.length; b++) {
      for (let a = 0; a < b; a++) {
        if (col[a].suit === col[b].suit && col[a].rank < col[b].rank) {
          h += 1
          break
        }
      }
    }
  }

  h += state.freeCells.filter(Boolean).length // free cells are a scarce resource
  h -= emptyColumnCount(state) // empty columns are valuable maneuvering room
  return h
}

/** Column and free-cell order don't matter — canonicalize so we dedupe them. */
function canonicalKey(state: GameState): string {
  const foundations = SUITS.map((s) => state.foundations[s]).join(',')
  const cells = state.freeCells
    .map((c) => (c ? `${c.suit[0]}${c.rank}` : '-'))
    .sort()
    .join(',')
  const cols = state.tableau
    .map((col) => col.map((c) => `${c.suit[0]}${c.rank}`).join('.'))
    .sort()
    .join('|')
  return `${foundations} ${cells} ${cols}`
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface Node {
  state: GameState
  key: string
  g: number
  h: number
  parent: number
  move: Move | null
}

/** Binary min-heap of (node index, priority). */
class MinHeap {
  private a: { i: number; p: number }[] = []
  size(): number {
    return this.a.length
  }
  push(i: number, p: number): void {
    const a = this.a
    a.push({ i, p })
    let c = a.length - 1
    while (c > 0) {
      const par = (c - 1) >> 1
      if (a[par].p <= a[c].p) break
      ;[a[par], a[c]] = [a[c], a[par]]
      c = par
    }
  }
  pop(): { i: number; p: number } {
    const a = this.a
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let c = 0
      for (;;) {
        const l = 2 * c + 1
        const r = 2 * c + 2
        let m = c
        if (l < a.length && a[l].p < a[m].p) m = l
        if (r < a.length && a[r].p < a[m].p) m = r
        if (m === c) break
        ;[a[m], a[c]] = [a[c], a[m]]
        c = m
      }
    }
    return top
  }
}

export interface SolveOptions {
  maxNodes?: number
  maxMs?: number
  /** Weight on the heuristic (>1 trades optimality for speed). */
  weight?: number
}

export interface SolveResult {
  solved: boolean
  moves: Move[]
}

function reconstruct(nodes: Node[], idx: number): Move[] {
  const out: Move[] = []
  let cur = idx
  while (cur > 0) {
    const n = nodes[cur]
    if (n.move) out.push(n.move)
    cur = n.parent
  }
  return out.reverse()
}

/**
 * Search for a winning line. Returns the full move sequence when solved; when it
 * can't solve within the budget it returns the path to the most promising state
 * found (still real progress), or an empty list if there are no legal moves.
 */
export function solve(state: GameState, opts: SolveOptions = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 100000
  const maxMs = opts.maxMs ?? 800
  const weight = opts.weight ?? 6
  const startedAt = performance.now()

  if (isWon(state)) return { solved: true, moves: [] }

  const root: Node = { state, key: canonicalKey(state), g: 0, h: heuristic(state), parent: -1, move: null }
  const nodes: Node[] = [root]
  const heap = new MinHeap()
  heap.push(0, weight * root.h)
  const visited = new Set<string>()

  let bestChild = -1 // most promising non-root node (for a progress hint)
  let expanded = 0

  while (heap.size() > 0) {
    if (expanded >= maxNodes || performance.now() - startedAt > maxMs) break
    const { i: idx } = heap.pop()
    const node = nodes[idx]
    if (visited.has(node.key)) continue
    visited.add(node.key)
    expanded++

    if (isWon(node.state)) return { solved: true, moves: reconstruct(nodes, idx) }

    for (const move of generateMoves(node.state)) {
      let next: GameState
      try {
        next = autoMoveToFoundations(applyMove(node.state, move))
      } catch {
        continue
      }
      const key = canonicalKey(next)
      if (visited.has(key)) continue
      const h = heuristic(next)
      const ni = nodes.length
      nodes.push({ state: next, key, g: node.g + 1, h, parent: idx, move })
      heap.push(ni, node.g + 1 + weight * h)
      if (isWon(next)) return { solved: true, moves: reconstruct(nodes, ni) }
      if (bestChild === -1 || h < nodes[bestChild].h) bestChild = ni
    }
  }

  return { solved: false, moves: bestChild === -1 ? [] : reconstruct(nodes, bestChild) }
}

// ---------------------------------------------------------------------------
// Hint
// ---------------------------------------------------------------------------

export interface StrategicHint {
  move: Move
  /** True when the suggested move is the first step of a full solution. */
  winning: boolean
}

/**
 * The first move of a strategic plan: a winning line if one is found within the
 * budget, otherwise the first step toward the most promising reachable state.
 * Returns null only when the board has no legal move at all.
 */
export function findStrategicHint(state: GameState): StrategicHint | null {
  if (isWon(state)) return null
  const res = solve(state)
  if (res.moves.length > 0) return { move: res.moves[0], winning: res.solved }
  return null
}
