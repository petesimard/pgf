import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import TVGameScene from '../../components/shared/GameScene';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WordScrambleState {
  letter: string;
  categories: string[];
  roundNumber: number;
  phase: 'playing' | 'reviewing' | 'results';
  startTime: number;
  playerAnswers: Record<string, Record<number, string>>;
  scores: Record<string, number>;
  roundScores: Record<string, number>;
}

const ROUND_TIME_SECONDS = 90;

function TVView({ players, gameState }: TVViewProps) {
  const state = gameState as WordScrambleState;
  const [timeRemaining, setTimeRemaining] = useState(ROUND_TIME_SECONDS);

  // Countdown timer
  useEffect(() => {
    if (!state || state.phase !== 'playing') return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      const remaining = Math.max(0, ROUND_TIME_SECONDS - elapsed);
      setTimeRemaining(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [state?.startTime, state?.phase]);

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

  if (state.phase === 'playing') {
    return (
      <TVGameScene players={players} scores={state.scores}>
        <div className="flex flex-col items-center justify-center h-full p-8">
          {/* Timer */}
          <div className={cn(
            "text-6xl font-extrabold mb-8",
            timeRemaining <= 10 ? "text-destructive animate-pulse" : "text-muted-foreground"
          )}>
            {timeRemaining}s
          </div>

          {/* Letter */}
          <div className="text-3xl text-muted-foreground mb-4">Letter:</div>
          <div className="text-[12rem] font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent mb-12">
            {state.letter}
          </div>

          {/* Categories */}
          <div className="w-full max-w-4xl grid grid-cols-1 gap-4">
            {state.categories.map((category, idx) => (
              <Card key={idx} className="p-6 bg-card/80 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-primary w-12">
                    {idx + 1}
                  </div>
                  <div className="text-3xl font-semibold text-foreground">
                    {category}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </TVGameScene>
    );
  }

  if (state.phase === 'reviewing' || state.phase === 'results') {
    return (
      <TVGameScene players={players} scores={state.scores}>
        <div className="p-8 h-full overflow-y-auto">
          <div className="text-center mb-8">
            <div className="text-5xl font-extrabold text-foreground mb-2">
              Round {state.roundNumber} - Letter {state.letter}
            </div>
            <div className="text-2xl text-muted-foreground">
              {state.phase === 'reviewing' ? 'Review Answers' : 'Final Scores'}
            </div>
          </div>

          {/* Answer Grid */}
          {state.phase === 'reviewing' && (
            <div className="max-w-7xl mx-auto">
              <div className="grid gap-8">
                {state.categories.map((category, categoryIdx) => (
                  <Card key={categoryIdx} className="p-6 bg-card/80 backdrop-blur">
                    <div className="text-2xl font-bold text-primary mb-4">
                      {categoryIdx + 1}. {category}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {players
                        .filter(p => p.isActive)
                        .map((player) => {
                          const answer = state.playerAnswers[player.id]?.[categoryIdx];
                          const hasAnswer = answer && answer.trim();
                          const startsWithLetter = hasAnswer && answer.trim().toLowerCase().startsWith(state.letter.toLowerCase());

                          // Count how many players gave the same answer
                          const normalizedAnswer = hasAnswer ? answer.trim().toLowerCase() : '';
                          const duplicateCount = normalizedAnswer ?
                            Object.values(state.playerAnswers).filter(
                              answers => answers[categoryIdx]?.trim().toLowerCase() === normalizedAnswer
                            ).length : 0;
                          const isUnique = duplicateCount === 1;

                          return (
                            <div
                              key={player.id}
                              className={cn(
                                "p-3 rounded-lg border-2",
                                !hasAnswer && "bg-muted/20 border-muted",
                                hasAnswer && !startsWithLetter && "bg-destructive/20 border-destructive",
                                hasAnswer && startsWithLetter && !isUnique && "bg-warning/20 border-warning",
                                hasAnswer && startsWithLetter && isUnique && "bg-success/20 border-success"
                              )}
                            >
                              <div className="text-sm font-semibold text-muted-foreground mb-1">
                                {player.name}
                              </div>
                              <div className="text-lg font-bold">
                                {hasAnswer ? answer : '—'}
                              </div>
                              <div className="text-xs mt-1 text-muted-foreground">
                                {hasAnswer && startsWithLetter && isUnique && '+1'}
                                {hasAnswer && startsWithLetter && !isUnique && 'duplicate'}
                                {hasAnswer && !startsWithLetter && 'invalid'}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Round Scores */}
          {state.phase === 'reviewing' && Object.keys(state.roundScores).length > 0 && (
            <div className="max-w-2xl mx-auto mt-8">
              <Card className="p-6 bg-card/90">
                <div className="text-2xl font-bold text-center mb-4">Round Scores</div>
                <div className="grid gap-2">
                  {Object.entries(state.roundScores)
                    .sort(([, a], [, b]) => b - a)
                    .map(([playerId, score]) => {
                      const player = players.find(p => p.id === playerId);
                      return (
                        <div key={playerId} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                          <span className="font-semibold">{player?.name}</span>
                          <span className="text-xl font-bold text-primary">+{score}</span>
                        </div>
                      );
                    })}
                </div>
              </Card>
            </div>
          )}
        </div>
      </TVGameScene>
    );
  }

  return null;
}

export default TVView;
