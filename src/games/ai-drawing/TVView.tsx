import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import TVGameScene from '@/components/shared/GameScene';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AIDrawingState {
  word: string;
  timeRemaining: number;
  drawings: Record<
    string,
    {
      playerId: string;
      playerName: string;
      imageData: string;
      submitted: boolean;
    }
  >;
  phase: 'drawing' | 'judging' | 'results';
  results: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    reason: string;
  }> | null;
}

function TVView({ players, gameState }: TVViewProps) {
  const state = gameState as AIDrawingState;
  const [localTimeRemaining, setLocalTimeRemaining] = useState(state?.timeRemaining || 0);

  // Sync local timer with server state
  useEffect(() => {
    if (state?.timeRemaining !== undefined) {
      setLocalTimeRemaining(state.timeRemaining);
    }
  }, [state?.timeRemaining]);

  // Client-side countdown
  useEffect(() => {
    if (state?.phase !== 'drawing') return;

    const interval = setInterval(() => {
      setLocalTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.phase]);

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

  const totalPlayers = Object.keys(state.drawings).length;
  const submittedCount = Object.values(state.drawings).filter((d) => d.submitted).length;

  if (state.phase === 'judging') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <Card className="text-center p-16 bg-card rounded-2xl max-w-2xl">
          <div className="w-24 h-24 border-[6px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-8"></div>
          <div className="text-6xl font-bold text-primary mb-4">AI is Judging...</div>
          <div className="text-2xl text-muted-foreground">
            Analyzing all the masterpieces and ranking them
          </div>
        </Card>
      </div>
    );
  }

  if (state.phase === 'results' && state.results) {
    return (
      <div className="min-h-screen flex flex-col p-8 bg-background">
        <div className="text-center mb-8">
          <h1 className="text-7xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent mb-4">
            🏆 Final Results 🏆
          </h1>
          <div className="text-3xl text-muted-foreground">
            The word was: <span className="font-bold text-primary">{state.word}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto w-full">
          {state.results.map((result, index) => (
            <Card
              key={result.playerId}
              className={cn(
                'p-8 rounded-2xl border-4 transform transition-all',
                index === 0 &&
                  'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-400 scale-105 shadow-2xl',
                index === 1 && 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-400',
                index === 2 && 'bg-gradient-to-r from-amber-100 to-amber-50 border-amber-600',
                index > 2 && 'bg-card border-border'
              )}
            >
              <div className="flex items-start gap-6">
                <div
                  className={cn(
                    'text-6xl font-extrabold w-20 h-20 flex items-center justify-center rounded-full shrink-0',
                    index === 0 && 'bg-yellow-400 text-white shadow-lg',
                    index === 1 && 'bg-gray-400 text-white shadow-lg',
                    index === 2 && 'bg-amber-600 text-white shadow-lg',
                    index > 2 && 'bg-muted text-muted-foreground'
                  )}
                >
                  {result.rank}
                </div>
                <div className="flex-1">
                  <div className="text-5xl font-bold mb-3 text-foreground">
                    {index === 0 && '🥇 '}
                    {index === 1 && '🥈 '}
                    {index === 2 && '🥉 '}
                    {result.playerName}
                  </div>
                  <div className="text-2xl text-muted-foreground italic leading-relaxed">
                    "{result.reason}"
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TVGameScene players={players} scores={{}}>
      <div className="flex flex-col items-center justify-center h-full p-8">
        {/* Word Display */}
        <div className="text-center mb-12">
          <div className="text-5xl text-muted-foreground mb-6">Draw this word:</div>
          <div className="text-[12rem] font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent leading-tight">
            {state.word}
          </div>
        </div>

        {/* Timer */}
        <div className="text-center mb-12">
          <div className="text-4xl text-muted-foreground mb-2">Time Remaining</div>
          <div
            className={cn(
              'text-9xl font-extrabold transition-colors',
              localTimeRemaining <= 10
                ? 'text-destructive animate-pulse'
                : 'text-success'
            )}
          >
            {localTimeRemaining}s
          </div>
        </div>

        {/* Progress */}
        <Card className="p-8 bg-card/80 rounded-2xl min-w-[500px]">
          <div className="text-center">
            <div className="text-3xl text-muted-foreground mb-4">Submissions</div>
            <div className="text-6xl font-bold text-primary">
              {submittedCount} / {totalPlayers}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {Object.values(state.drawings).map((drawing) => (
                <div
                  key={drawing.playerId}
                  className={cn(
                    'p-3 rounded-lg text-xl font-medium transition-all',
                    drawing.submitted
                      ? 'bg-success/20 text-success border-2 border-success'
                      : 'bg-muted text-muted-foreground border-2 border-transparent'
                  )}
                >
                  {drawing.submitted && '✓ '}
                  {drawing.playerName}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </TVGameScene>
  );
}

export default TVView;
