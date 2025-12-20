import { useState, useEffect } from 'react';
import ClientGameScene from '@/components/shared/ClientGameScene';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

function ClientView({ player, players, gameState, sendAction, isGameMaster }: ClientViewProps) {
  const state = gameState as WordScrambleState;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(ROUND_TIME_SECONDS);

  // Initialize answers from server state
  useEffect(() => {
    if (state?.playerAnswers[player.id]) {
      setAnswers(state.playerAnswers[player.id]);
    } else {
      setAnswers({});
    }
  }, [state?.roundNumber, player.id, state?.playerAnswers]);

  // Countdown timer
  useEffect(() => {
    if (!state || state.phase !== 'playing') return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      const remaining = Math.max(0, ROUND_TIME_SECONDS - elapsed);
      setTimeRemaining(remaining);

      // Auto-trigger time up when timer reaches 0 (only for game master)
      if (remaining === 0 && isGameMaster) {
        sendAction({ type: 'time-up' });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [state?.startTime, state?.phase, isGameMaster, sendAction]);

  if (!state) {
    return (
      <div className="flex-1 flex flex-col p-4">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  const handleAnswerChange = (categoryIndex: number, value: string) => {
    const newAnswers = { ...answers, [categoryIndex]: value };
    setAnswers(newAnswers);

    // Send the answer to server
    sendAction({
      type: 'submit-answer',
      payload: { categoryIndex, answer: value }
    });
  };

  const handleNextRound = () => {
    sendAction({ type: 'next-round' });
  };

  const handleShowResults = () => {
    sendAction({ type: 'show-results' });
  };

  const handleTimeUp = () => {
    sendAction({ type: 'time-up' });
  };

  if (state.phase === 'playing') {
    return (
      <ClientGameScene players={players} scores={state.scores}>
        {/* Timer and Letter */}
        <Card className="p-4 mb-4 bg-card">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-muted-foreground">Round {state.roundNumber}</div>
            <div className={cn(
              "text-2xl font-extrabold",
              timeRemaining <= 10 ? "text-destructive animate-pulse" : "text-foreground"
            )}>
              {timeRemaining}s
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Letter:</div>
            <div className="text-6xl font-extrabold bg-gradient-to-r from-primary to-[#a855f7] bg-clip-text text-transparent">
              {state.letter}
            </div>
          </div>
        </Card>

        {/* Category Inputs */}
        <div className="space-y-3 mb-4 flex-1 overflow-y-auto">
          {state.categories.map((category, idx) => (
            <Card key={idx} className="p-3 bg-card">
              <div className="text-sm font-semibold text-muted-foreground mb-2">
                {idx + 1}. {category}
              </div>
              <Input
                type="text"
                placeholder={`Type answer starting with ${state.letter}...`}
                value={answers[idx] || ''}
                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                className="text-lg font-semibold"
                autoComplete="off"
              />
            </Card>
          ))}
        </div>

        {/* Game Master Controls */}
        {isGameMaster && (
          <div className="mt-4">
            <Button
              onClick={handleTimeUp}
              variant="destructive"
              className="w-full"
            >
              End Round Early
            </Button>
          </div>
        )}
      </ClientGameScene>
    );
  }

  if (state.phase === 'reviewing') {
    const myRoundScore = state.roundScores[player.id] || 0;

    return (
      <ClientGameScene players={players} scores={state.scores}>
        <Card className="p-6 mb-4 bg-card text-center">
          <div className="text-lg text-muted-foreground mb-2">
            Round {state.roundNumber} Complete!
          </div>
          <div className="text-5xl font-extrabold text-primary mb-2">
            +{myRoundScore}
          </div>
          <div className="text-sm text-muted-foreground">
            points this round
          </div>
        </Card>

        {/* My Answers Review */}
        <div className="space-y-2 mb-4 flex-1 overflow-y-auto">
          <div className="text-sm font-semibold text-muted-foreground mb-2">Your Answers:</div>
          {state.categories.map((category, idx) => {
            const answer = state.playerAnswers[player.id]?.[idx];
            const hasAnswer = answer && answer.trim();
            const startsWithLetter = hasAnswer && answer.trim().toLowerCase().startsWith(state.letter.toLowerCase());

            // Check if answer is unique
            const normalizedAnswer = hasAnswer ? answer.trim().toLowerCase() : '';
            const duplicateCount = normalizedAnswer ?
              Object.values(state.playerAnswers).filter(
                answers => answers[idx]?.trim().toLowerCase() === normalizedAnswer
              ).length : 0;
            const isUnique = duplicateCount === 1;

            return (
              <Card
                key={idx}
                className={cn(
                  "p-3",
                  !hasAnswer && "bg-muted/20",
                  hasAnswer && !startsWithLetter && "bg-destructive/20 border-destructive",
                  hasAnswer && startsWithLetter && !isUnique && "bg-warning/20 border-warning",
                  hasAnswer && startsWithLetter && isUnique && "bg-success/20 border-success"
                )}
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {idx + 1}. {category}
                </div>
                <div className="text-base font-bold">
                  {hasAnswer ? answer : '(no answer)'}
                </div>
                <div className="text-xs mt-1 text-muted-foreground">
                  {hasAnswer && startsWithLetter && isUnique && '✓ +1 point'}
                  {hasAnswer && startsWithLetter && !isUnique && '⚠ duplicate (0 points)'}
                  {hasAnswer && !startsWithLetter && '✗ invalid letter (0 points)'}
                  {!hasAnswer && '— no answer'}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Game Master Controls */}
        {isGameMaster && (
          <div className="space-y-2 mt-4">
            <Button
              onClick={handleShowResults}
              variant="secondary"
              className="w-full"
            >
              Show Final Scores
            </Button>
            <Button
              onClick={handleNextRound}
              className="w-full"
            >
              Start Next Round
            </Button>
          </div>
        )}
      </ClientGameScene>
    );
  }

  if (state.phase === 'results') {
    return (
      <ClientGameScene players={players} scores={state.scores}>
        <Card className="p-6 mb-4 bg-card text-center">
          <div className="text-2xl font-bold text-foreground mb-4">
            Final Standings
          </div>
          <div className="space-y-2">
            {Object.entries(state.scores)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, score], index) => {
                const p = players.find(player => player.id === playerId);
                const isMe = playerId === player.id;
                return (
                  <div
                    key={playerId}
                    className={cn(
                      "flex justify-between items-center p-3 rounded-lg",
                      isMe ? "bg-primary/20 border-2 border-primary" : "bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <span className={cn(
                        "font-semibold",
                        isMe && "text-primary"
                      )}>
                        {p?.name}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      {score}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Game Master Controls */}
        {isGameMaster && (
          <div className="mt-4">
            <Button
              onClick={handleNextRound}
              className="w-full"
            >
              Start Next Round
            </Button>
          </div>
        )}
      </ClientGameScene>
    );
  }

  return null;
}

export default ClientView;
