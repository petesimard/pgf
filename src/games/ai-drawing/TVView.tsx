import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import TVGameScene from '@/components/shared/GameScene';
import Countdown from '@/components/shared/Countdown';
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
      imageData?: string; // Optional - not sent to clients
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
  currentResultIndex: number; // -1 means none revealed yet
}

function TVView({ players, gameState, socket }: TVViewProps) {
  const state = gameState as AIDrawingState;
  const [localTimeRemaining, setLocalTimeRemaining] = useState(state?.timeRemaining || 0);
  const [drawingImages, setDrawingImages] = useState<Record<string, string>>({});

  // Debug logging
  useEffect(() => {
    console.log('[TVView] State update:', {
      phase: state?.phase,
      hasResults: !!state?.results,
      resultsLength: state?.results?.length,
    });
  }, [state?.phase, state?.results]);

  // Listen for individual drawing images
  useEffect(() => {
    if (!socket) return;

    const handleDrawingImage = (data: { playerId: string; imageData: string }) => {
      console.log('[TVView] Received drawing image for player:', data.playerId);
      setDrawingImages((prev) => ({
        ...prev,
        [data.playerId]: data.imageData,
      }));
    };

    socket.on('drawing:image', handleDrawingImage);

    return () => {
      socket.off('drawing:image', handleDrawingImage);
    };
  }, [socket]);

  // Clear images when game restarts
  useEffect(() => {
    if (state?.phase === 'drawing') {
      setDrawingImages({});
    }
  }, [state?.phase]);

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center p-6 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-10 h-10 border-[3px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  const totalPlayers = Object.keys(state.drawings).length;
  const submittedCount = Object.values(state.drawings).filter((d) => d.submitted).length;

  if (state.phase === 'judging') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Card className="text-center p-12 bg-card rounded-2xl max-w-2xl">
          <div className="w-20 h-20 border-[5px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-5xl font-bold text-primary mb-3">AI is Judging...</div>
          <div className="text-xl text-muted-foreground">
            Analyzing all the masterpieces and ranking them
          </div>
        </Card>
      </div>
    );
  }

  if (state.phase === 'results' && state.results) {
    const currentIndex = state.currentResultIndex;
    const allRevealed = currentIndex >= state.results.length - 1;

    // Show waiting message if no results revealed yet
    if (currentIndex < 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
          <Card className="text-center p-12 bg-card rounded-2xl max-w-2xl">
            <div className="text-5xl font-bold text-primary mb-3">Results are ready!</div>
            <div className="text-xl text-muted-foreground">
              Preparing to reveal the rankings...
            </div>
          </Card>
        </div>
      );
    }

    // Clamp currentIndex to valid range
    const safeIndex = Math.min(currentIndex, state.results.length - 1);
    const currentResult = state.results[safeIndex];

    // Safety check - if still no result, show waiting message
    if (!currentResult) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
          <Card className="text-center p-12 bg-card rounded-2xl max-w-2xl">
            <div className="text-5xl font-bold text-primary mb-3">Loading results...</div>
          </Card>
        </div>
      );
    }

    const resultIndex = safeIndex; // 0-based index for styling

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center mb-6">
          <h1 className="text-6xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent mb-3">
            🏆 {allRevealed ? 'Final Results' : 'Revealing Results'} 🏆
          </h1>
          <div className="text-2xl text-muted-foreground mb-1.5">
            The word was: <span className="font-bold text-primary">{state.word}</span>
          </div>
          <div className="text-xl text-muted-foreground">
            {allRevealed
              ? 'All results revealed!'
              : `Revealing ${currentIndex + 1} of ${state.results.length}`}
          </div>
        </div>

        <Card
          className={cn(
            'p-10 rounded-2xl border-4 transform transition-all max-w-4xl w-full animate-in fade-in zoom-in duration-700',
            resultIndex === 0 &&
              'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-400 shadow-2xl',
            resultIndex === 1 && 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-400 shadow-xl',
            resultIndex === 2 && 'bg-gradient-to-r from-amber-100 to-amber-50 border-amber-600 shadow-xl',
            resultIndex > 2 && 'bg-card border-border shadow-lg'
          )}
        >
          <div className="flex items-start gap-6">
            <div
              className={cn(
                'text-7xl font-extrabold w-28 h-28 flex items-center justify-center rounded-full shrink-0',
                resultIndex === 0 && 'bg-yellow-400 text-white shadow-lg',
                resultIndex === 1 && 'bg-gray-400 text-white shadow-lg',
                resultIndex === 2 && 'bg-amber-600 text-white shadow-lg',
                resultIndex > 2 && 'bg-muted text-muted-foreground'
              )}
            >
              {currentResult.rank}
            </div>
            <div className="flex-1">
              <div className="text-5xl font-bold mb-5 text-foreground">
                {resultIndex === 0 && '🥇 '}
                {resultIndex === 1 && '🥈 '}
                {resultIndex === 2 && '🥉 '}
                {currentResult.playerName}
              </div>
              {drawingImages[currentResult.playerId] && (
                <div className="mb-5 flex justify-center">
                  <img
                    src={drawingImages[currentResult.playerId]}
                    alt={`${currentResult.playerName}'s drawing`}
                    className="max-w-md max-h-64 rounded-lg border-2 border-border shadow-md object-contain bg-white"
                  />
                </div>
              )}
              <div className="text-2xl text-muted-foreground italic leading-relaxed">
                "{currentResult.reason}"
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <TVGameScene players={players} scores={{}} showScorebox={false}>
      <div className="flex flex-col items-center justify-start h-full p-6 pt-3">
        {/* Word Display */}
        <div className="text-center mb-6">
          <div className="text-xl text-muted-foreground mb-1.5">Draw this word:</div>
          <div className="text-6xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent leading-tight">
            {state.word}
          </div>
        </div>

        {/* Timer */}
        <Countdown
          timeRemaining={localTimeRemaining}
          label="Time Remaining"
          size="xl"
          className="mb-6"
        />

        {/* Progress */}
        <Card className="p-6 bg-card/80 rounded-2xl min-w-[400px]">
          <div className="text-center">
            <div className="text-2xl text-muted-foreground mb-3">Submissions</div>
            <div className="text-5xl font-bold text-primary">
              {submittedCount} / {totalPlayers}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {Object.values(state.drawings).map((drawing) => (
                <div
                  key={drawing.playerId}
                  className={cn(
                    'p-2.5 rounded-lg text-lg font-medium transition-all',
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
