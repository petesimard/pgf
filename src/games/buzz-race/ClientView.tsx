import ScoreBox from '@/components/shared/ScoreBox';
import type { ClientViewProps } from '../types';

interface BuzzRaceState {
  currentPlayerId: string | null;
  scores: Record<string, number>;
  roundNumber: number;
  lastBuzzResult: { playerId: string; correct: boolean; playerName: string } | null;
}

function ClientView({ player, players, gameState, sendAction }: ClientViewProps) {
  const state = gameState as BuzzRaceState;

  if (!state) {
    return (
      <div className="buzz-client">
        <div className="waiting">
          <div className="spinner"></div>
          <h2>Loading game...</h2>
        </div>
      </div>
    );
  }

  const currentPlayer = players.find((p) => p.id === state.currentPlayerId);
  const isMyTurn = state.currentPlayerId === player.id;
  const myScore = state.scores[player.id] || 0;

  const handleBuzz = () => {
    sendAction({ type: 'buzz' });
  };

  return (
    <div className="buzz-client">
      {/* Status */}
      <div className={`buzz-status ${isMyTurn ? 'your-turn' : ''}`}>
        <div className="current">Current Player:</div>
        <div className="current-name">
          {isMyTurn ? 'YOUR TURN!' : currentPlayer?.name || '...'}
        </div>
      </div>

      {/* Buzz Button */}
      <div className="buzz-button-container">
        <button className="buzz-button" onClick={handleBuzz}>
          BUZZ!
        </button>
      </div>

      {/* Your Score */}
      <ScoreBox players={players} scores={state.scores} />
    </div>
  );
}

export default ClientView;
