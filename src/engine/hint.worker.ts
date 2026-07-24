// Runs the (potentially several-hundred-ms) hint solver off the main thread so
// tapping "Hint" never freezes the UI. It receives a GameState, computes a
// strategic hint, and posts the result back tagged with the request id.
import { findStrategicHint } from './solver'
import type { GameState } from './types'

interface HintRequest {
  reqId: number
  state: GameState
}

// In a worker, `self` is the worker global scope; type it minimally to avoid
// pulling in the webworker lib (which would clash with the DOM lib elsewhere).
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<HintRequest>) => void) | null
  postMessage: (message: unknown) => void
}

ctx.onmessage = (e) => {
  const { reqId, state } = e.data
  const hint = findStrategicHint(state)
  ctx.postMessage({ reqId, hint })
}
