import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import ScoreBox from '../../components/shared/ScoreBox';

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

  return (
    <div className="buzz-game-tv">
      {/* Scoreboard */}
      <ScoreBox players={players} scores={state.scores} />

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
