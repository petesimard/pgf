import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';

interface BuzzRaceState {
  currentPlayerId: string | null;
  scores: Record<string, number>;
  roundNumber: number;
  lastBuzzResult: { playerId: string; correct: boolean; playerName: string } | null;
}

function TVView({ players, gameState }: TVViewProps) {
  const state = gameState as BuzzRaceState;
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<BuzzRaceState['lastBuzzResult']>(null);

  const currentPlayer = players.find((p) => p.id === state?.currentPlayerId);

  // Show result animation when lastBuzzResult changes
  useEffect(() => {
    if (state?.lastBuzzResult && state.lastBuzzResult !== lastResult) {
      setLastResult(state.lastBuzzResult);
      setShowResult(true);
      const timer = setTimeout(() => setShowResult(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [state?.lastBuzzResult, lastResult]);

  if (!state) {
    return (
      <div className="tv-container">
        <div className="waiting">
          <div className="spinner"></div>
          <h2>Loading game...</h2>
        </div>
      </div>
    );
  }

  // Sort players by score (only show active players)
  const sortedPlayers = [...players]
    .filter((p) => p.connected && p.isActive)
    .sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));

  return (
    <div className="buzz-game-tv">
      {/* Scoreboard */}
      <div className="scoreboard">
        {sortedPlayers.map((player) => {
          const score = state.scores[player.id] || 0;
          return (
            <div key={player.id} className={`score-item ${score < 0 ? 'negative' : ''}`}>
              <span className="name">{player.name}</span>
              <span className="score">{score}</span>
            </div>
          );
        })}
      </div>

      {/* Current Player Display */}
      <div className="current-player-display">
        <div className="label">BUZZ NOW!</div>
        <div className="name">{currentPlayer?.name || '...'}</div>
      </div>

      {/* Result Animation */}
      {showResult && lastResult && (
        <div className={`buzz-result ${lastResult.correct ? 'correct' : 'wrong'}`}>
          {lastResult.playerName}: {lastResult.correct ? '+1' : '-1'}
        </div>
      )}
    </div>
  );
}

export default TVView;
