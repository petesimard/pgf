import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import TVGameScene from '../../components/shared/GameScene';
import { cn } from '@/lib/utils';

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
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  return (
    <TVGameScene players={players} scores={state.scores}>
      {/* Current Player Display */}
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-3xl text-muted-foreground mb-4">BUZZ NOW!</div>
        <div className="text-9xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent text-center animate-pulse">
          {currentPlayer?.name || '...'}
        </div>
      </div>

      {/* Result Animation */}
      {showResult && lastResult && (
        <div
          className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-16 py-8 rounded-2xl text-3xl font-bold animate-fadeOut z-[100]",
            lastResult.correct ? "bg-success text-white" : "bg-destructive text-white"
          )}
        >
          {lastResult.playerName}: {lastResult.correct ? '+1' : '-1'}
        </div>
      )}
    </TVGameScene>
  );
}

export default TVView;
