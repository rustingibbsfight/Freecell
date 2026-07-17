import { useGame } from '../hooks/useGame'
import { FreeCells } from './FreeCells'
import { Foundations } from './Foundations'
import { Tableau } from './Tableau'

interface BoardProps {
  /** Optional fixed seed, mainly for tests / reproducible games. */
  seed?: number
}

export function Board({ seed }: BoardProps) {
  const game = useGame(seed)

  return (
    <div className="board">
      <header className="toolbar">
        <h1>FreeCell</h1>
        <div className="controls">
          <button onClick={() => game.deal()}>New Game</button>
          <button onClick={game.restart}>Restart</button>
          <button onClick={game.undo} disabled={!game.canUndo}>
            Undo
          </button>
          <button onClick={game.autoFinish}>Auto-finish</button>
        </div>
      </header>

      <div className="top-row">
        <FreeCells
          state={game.state}
          selectedIds={game.selectedIds}
          onClick={game.handleClick}
          onDoubleClick={game.handleDoubleClick}
        />
        <Foundations state={game.state} onClick={game.handleClick} />
      </div>

      <Tableau
        state={game.state}
        selectedIds={game.selectedIds}
        onClick={game.handleClick}
        onDoubleClick={game.handleDoubleClick}
      />

      <div className="status" role="status" aria-live="polite">
        {game.won ? (
          <span className="win-banner">🎉 You win! 🎉</span>
        ) : (
          game.message && <span className="message">{game.message}</span>
        )}
      </div>
    </div>
  )
}
