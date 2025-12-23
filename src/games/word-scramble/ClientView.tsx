import { useState, useEffect, useRef } from 'react';
import type { ClientViewProps } from '../types';
import ClientGameScene from '@/components/shared/ClientGameScene';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Countdown from '@/components/shared/Countdown';
import { cn } from '@/lib/utils';

interface PlayerAnswer {
  playerId: string;
  playerName: string;
  answer: string;
  wasAccepted: boolean;
  pointsEarned: number;
  wasChallenged: boolean;
  challengeVotes?: {
    up: number;
    down: number;
    rejected: boolean;
  };
}

interface CategoryResult {
  categoryIndex: number;
  letter: string;
  category: string;
  answers: PlayerAnswer[];
}

interface WordScrambleState {
  letters: string[];
  categories: string[];
  submissionTimeSeconds: number;
  revealTimeSeconds: number;
  votingTimeSeconds: number;
  currentCategoryIndex: number;
  roundNumber: number;
  phase: 'submitting' | 'revealing' | 'voting' | 'results';
  submissionStartTime: number;
  submissions: Record<string, string>;
  revealOrder: string[];
  currentRevealIndex: number;
  revealStartTime: number;
  challengedPlayerId: string | null;
  challengedAnswer: string | null;
  votes: Record<string, 'up' | 'down'>;
  votingStartTime: number;
  challengeResult: {
    accepted: boolean;
    upVotes: number;
    downVotes: number;
  } | null;
  rejectedPlayerIds: string[];  // Track rejected answers for current category
  challengedPlayerIds: string[]; // Track all challenged players (accepted or rejected)
  categoryHistory: CategoryResult[];
  scores: Record<string, number>;
}

function ClientView({ player, players, gameState, sendAction }: ClientViewProps) {
  const state = gameState as WordScrambleState;
  const [answer, setAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGameMaster = player.isGameMaster;

  // Countdown timer - different for each phase
  useEffect(() => {
    if (!state) return;

    const interval = setInterval(() => {
      let elapsed = 0;
      let duration = 0;

      if (state.phase === 'submitting') {
        elapsed = Math.floor((Date.now() - state.submissionStartTime) / 1000);
        duration = state.submissionTimeSeconds;
      } else if (state.phase === 'revealing') {
        elapsed = Math.floor((Date.now() - state.revealStartTime) / 1000);
        duration = state.revealTimeSeconds;
      } else if (state.phase === 'voting') {
        elapsed = Math.floor((Date.now() - state.votingStartTime) / 1000);
        duration = state.votingTimeSeconds;
      }

      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [state?.phase, state?.submissionStartTime, state?.revealStartTime, state?.votingStartTime, state?.submissionTimeSeconds, state?.revealTimeSeconds, state?.votingTimeSeconds]);

  // Reset answer field and focus input when new category starts
  useEffect(() => {
    if (state?.phase === 'submitting') {
      setAnswer('');
      // Focus the input to show keyboard on mobile
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [state?.currentCategoryIndex, state?.phase]);

  if (!state || !state.letters || !state.categories) {
    return (
      <ClientGameScene players={players} scores={{}}>
        <Card className="p-6">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </Card>
      </ClientGameScene>
    );
  }

  const currentLetter = state.letters[state.currentCategoryIndex];
  const currentCategory = state.categories[state.currentCategoryIndex];
  const myAnswer = state.submissions[player.id];
  const hasSubmitted = myAnswer !== undefined;

  // Submitting Phase
  if (state.phase === 'submitting') {
    return (
      <ClientGameScene players={players} scores={state.scores}>
        <div className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              {/* Timer */}
              <Countdown timeRemaining={timeRemaining} size="sm" />

              {/* Category Info */}
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">
                  Category {state.currentCategoryIndex + 1} of {state.categories.length}
                </div>
                <div className="text-2xl font-bold text-foreground mb-2">
                  {currentCategory}
                </div>
                <div className="text-5xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
                  {currentLetter}
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (answer.trim()) {
                    sendAction({ type: 'submit-answer', payload: { answer: answer.trim() } });
                  }
                }}>
                  <Input
                    ref={inputRef}
                    placeholder={`Answer starting with ${currentLetter}...`}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={hasSubmitted}
                    className="text-lg"
                    autoFocus
                  />
                </form>
                {hasSubmitted && (
                  <div className="text-sm text-success font-semibold text-center">
                    ✓ Answer submitted: {myAnswer}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* GM Controls */}
          {isGameMaster && (
            <div className="space-y-2">
              <Button
                onClick={() => sendAction({ type: 'submission-complete' })}
                className="w-full"
                variant="secondary"
              >
                End Submission Early
              </Button>
              <Button
                onClick={() => sendAction({ type: 'reroll-letter' })}
                className="w-full"
                variant="outline"
              >
                🎲 Reroll Letter
              </Button>
            </div>
          )}
        </div>
      </ClientGameScene>
    );
  }

  // Revealing Phase
  if (state.phase === 'revealing') {
    const isAllRevealed = state.currentRevealIndex >= state.revealOrder.length;
    const currentPlayerId = state.revealOrder[state.currentRevealIndex];
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentAnswer = state.submissions[currentPlayerId];
    const isMyAnswer = currentPlayerId === player.id;
    const isLastCategory = state.currentCategoryIndex >= state.categories.length - 1;

    if (isAllRevealed || state.revealOrder.length === 0) {
      return (
        <ClientGameScene players={players} scores={state.scores}>
          <div className="space-y-4">
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="text-2xl font-bold text-foreground">
                  All Answers Revealed!
                </div>
                <div className="text-muted-foreground">
                  Category {state.currentCategoryIndex + 1} of {state.categories.length}
                </div>
              </div>
            </Card>

            {/* Show my answer with points */}
            <Card className="p-4 bg-primary/10">
              <div className="text-sm text-muted-foreground mb-1">Your answer:</div>
              <div className="text-xl font-bold mb-2">{myAnswer || '(no answer)'}</div>
              {myAnswer && (() => {
                // Check if I was rejected by challenge
                const wasRejected = Array.isArray(state.rejectedPlayerIds) && state.rejectedPlayerIds.includes(player.id);

                // Calculate points for my answer
                const words = myAnswer.trim().split(/\s+/);
                const validWords = words.filter(word => {
                  for (const char of word) {
                    if (/[a-zA-Z]/.test(char)) {
                      return char.toLowerCase() === currentLetter.toLowerCase();
                    }
                  }
                  return false;
                });
                const points = validWords.length * 10;

                // Check if my answer is a duplicate
                const normalized = myAnswer.trim().toLowerCase();
                const duplicateCount = state.revealOrder.filter(pid =>
                  state.submissions[pid]?.trim().toLowerCase() === normalized
                ).length;
                const isDuplicate = duplicateCount > 1;
                const finalPoints = wasRejected ? 0 : (isDuplicate ? 0 : points);

                return (
                  <div className={cn(
                    "text-lg font-extrabold",
                    finalPoints > 0 ? "text-success" : wasRejected ? "text-destructive" : "text-warning"
                  )}>
                    {wasRejected ? 'Rejected - 0 points' : isDuplicate ? 'Duplicate - 0 points' : `${finalPoints} points`}
                  </div>
                );
              })()}
            </Card>

            {/* GM Controls */}
            {isGameMaster && (
              <div className="space-y-2">
                {!isLastCategory ? (
                  <Button
                    onClick={() => sendAction({ type: 'next-category' })}
                    className="w-full"
                  >
                    Next Category ({state.currentCategoryIndex + 2}/{state.categories.length})
                  </Button>
                ) : (
                  <Button
                    onClick={() => sendAction({ type: 'show-results' })}
                    className="w-full"
                  >
                    Show Final Results
                  </Button>
                )}
              </div>
            )}

            {!isGameMaster && (
              <div className="text-center text-muted-foreground text-sm">
                Waiting for Game Master...
              </div>
            )}
          </div>
        </ClientGameScene>
      );
    }

    return (
      <ClientGameScene players={players} scores={state.scores}>
        <div className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              {/* Progress */}
              <div className="text-center text-sm text-muted-foreground">
                Revealing {state.currentRevealIndex + 1} of {state.revealOrder.length}
              </div>

              {/* Category */}
              <div className="text-center text-lg text-muted-foreground">
                {currentCategory} ({currentLetter})
              </div>

              {/* Current Reveal */}
              <div className={cn(
                "p-6 rounded-lg border-2 text-center",
                isMyAnswer && "bg-primary/20 border-primary"
              )}>
                <div className="text-xl font-bold mb-2">{currentPlayer?.name}</div>
                <div className="text-3xl font-extrabold">{currentAnswer}</div>
              </div>

              {/* Timer */}
              <div className="text-center">
                <Countdown timeRemaining={timeRemaining} size="sm" />
                <div className="text-xs text-muted-foreground mt-1">
                  Auto-advancing...
                </div>
              </div>
            </div>
          </Card>

          {/* Challenge Button */}
          {!isMyAnswer && (
            <Button
              onClick={() => sendAction({ type: 'challenge-answer' })}
              className="w-full"
              variant="destructive"
              size="lg"
            >
              Challenge
            </Button>
          )}

          {/* GM Controls */}
          {isGameMaster && (
            <Button
              onClick={() => sendAction({ type: 'next-reveal' })}
              className="w-full"
              variant="secondary"
            >
              Next
            </Button>
          )}

          {/* Show my answer */}
          {!isMyAnswer && (
            <Card className="p-3 bg-muted/20">
              <div className="text-xs text-muted-foreground mb-1">Your answer:</div>
              <div className="text-lg font-semibold">{myAnswer || '(no answer)'}</div>
            </Card>
          )}
        </div>
      </ClientGameScene>
    );
  }

  // Voting Phase
  if (state.phase === 'voting') {
    const challengedPlayer = players.find(p => p.id === state.challengedPlayerId);
    const isChallengedPlayer = state.challengedPlayerId === player.id;
    const hasVoted = state.votes[player.id] !== undefined;
    const myVote = state.votes[player.id];
    const eligibleVoters = players.filter(p => p.isActive && p.id !== state.challengedPlayerId);
    const voteCount = Object.keys(state.votes).length;

    // Show result if voting is complete
    if (state.challengeResult) {
      return (
        <ClientGameScene players={players} scores={state.scores}>
          <div className="space-y-4">
            <Card className={cn(
              "p-6 border-2",
              state.challengeResult.accepted ? "bg-success/20 border-success" : "bg-destructive/20 border-destructive"
            )}>
              <div className="space-y-4">
                {/* Result Header */}
                <div className={cn(
                  "text-5xl font-extrabold text-center animate-pulse",
                  state.challengeResult.accepted ? "text-success" : "text-destructive"
                )}>
                  {state.challengeResult.accepted ? "ACCEPTED" : "REJECTED"}
                </div>

                {/* Challenged Answer */}
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">
                    {currentCategory} ({currentLetter})
                  </div>
                  <div className="text-lg font-bold mb-2">{challengedPlayer?.name}</div>
                  <div className="text-2xl font-extrabold">"{state.challengedAnswer}"</div>
                </div>

                {/* Final vote counts */}
                <div className="flex gap-8 justify-center text-2xl font-bold">
                  <div>👍 {state.challengeResult.upVotes}</div>
                  <div>👎 {state.challengeResult.downVotes}</div>
                </div>
              </div>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              Returning to reveals...
            </div>
          </div>
        </ClientGameScene>
      );
    }

    // Still voting
    return (
      <ClientGameScene players={players} scores={state.scores}>
        <div className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              {/* Challenge Header */}
              <div className="text-center">
                <div className="text-2xl font-extrabold text-destructive mb-4">
                  CHALLENGE!
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {currentCategory} ({currentLetter})
                </div>
              </div>

              {/* Challenged Answer */}
              <div className="p-6 bg-destructive/10 rounded-lg border-2 border-destructive text-center">
                <div className="text-xl font-bold mb-2">{challengedPlayer?.name}</div>
                <div className="text-3xl font-extrabold">"{state.challengedAnswer}"</div>
              </div>

              {/* Timer */}
              <div className="text-center">
                <Countdown timeRemaining={timeRemaining} size="md" />
              </div>

              {/* Vote Status */}
              <div className="text-center text-sm text-muted-foreground">
                {voteCount} / {eligibleVoters.length} voted
              </div>
            </div>
          </Card>

          {/* Voting Buttons */}
          {!isChallengedPlayer && !hasVoted && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => sendAction({ type: 'vote', payload: { vote: 'up' } })}
                className="h-20 text-3xl"
                variant="default"
              >
                👍
                <span className="ml-2 text-lg">Accept</span>
              </Button>
              <Button
                onClick={() => sendAction({ type: 'vote', payload: { vote: 'down' } })}
                className="h-20 text-3xl"
                variant="destructive"
              >
                👎
                <span className="ml-2 text-lg">Reject</span>
              </Button>
            </div>
          )}

          {hasVoted && (
            <Card className="p-4 bg-success/20 border-success">
              <div className="text-center font-semibold">
                You voted: {myVote === 'up' ? '👍 Accept' : '👎 Reject'}
              </div>
              <div className="text-center text-sm text-muted-foreground mt-1">
                Waiting for other votes...
              </div>
            </Card>
          )}

          {isChallengedPlayer && (
            <Card className="p-4 bg-warning/20 border-warning">
              <div className="text-center font-semibold text-foreground">
                This is your answer!
              </div>
              <div className="text-center text-sm text-muted-foreground mt-1">
                You cannot vote on your own answer
              </div>
            </Card>
          )}
        </div>
      </ClientGameScene>
    );
  }

  // Results Phase
  if (state.phase === 'results') {
    const myScore = state.scores[player.id] || 0;
    const sortedPlayers = players
      .filter(p => p.isActive)
      .map(p => ({
        player: p,
        score: state.scores[p.id] || 0
      }))
      .sort((a, b) => b.score - a.score);

    const myRank = sortedPlayers.findIndex(p => p.player.id === player.id) + 1;

    return (
      <ClientGameScene players={players} scores={state.scores}>
        <div className="space-y-4">
          {/* My Score */}
          <Card className="p-6 bg-primary/20 border-primary">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Your Score</div>
              <div className="text-5xl font-extrabold text-primary mb-2">{myScore}</div>
              <div className="text-lg font-semibold">
                {myRank === 1 ? '🏆 1st Place!' :
                  myRank === 2 ? '🥈 2nd Place' :
                    myRank === 3 ? '🥉 3rd Place' :
                      `${myRank}th Place`}
              </div>
            </div>
          </Card>

          {/* Category History */}
          <div className="space-y-3">
            <div className="text-lg font-bold text-center">Your Answers</div>
            {state.categoryHistory.map((category) => {
              const myAnswerResult = category.answers.find(a => a.playerId === player.id);
              return (
                <Card key={category.categoryIndex} className="p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-muted-foreground">
                      {category.category} ({category.letter})
                    </div>
                    <div className="text-xl font-bold">
                      {myAnswerResult?.answer || '(no answer)'}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn(
                        "font-semibold",
                        myAnswerResult?.wasAccepted && myAnswerResult.pointsEarned > 0 && "text-success",
                        myAnswerResult?.wasAccepted && myAnswerResult.pointsEarned === 0 && "text-warning",
                        !myAnswerResult?.wasAccepted && "text-destructive"
                      )}>
                        {myAnswerResult?.wasChallenged && '⚠ Challenged '}
                        {myAnswerResult?.wasAccepted && myAnswerResult.pointsEarned > 0 && `+${myAnswerResult.pointsEarned} pt`}
                        {myAnswerResult?.wasAccepted && myAnswerResult.pointsEarned === 0 && 'Duplicate'}
                        {!myAnswerResult?.wasAccepted && 'Rejected'}
                        {!myAnswerResult && 'No answer'}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* GM Controls */}
          {isGameMaster && (
            <Button
              onClick={() => sendAction({ type: 'next-round' })}
              className="w-full"
              size="lg"
            >
              Start Next Round
            </Button>
          )}

          {!isGameMaster && (
            <div className="text-center text-muted-foreground text-sm">
              Waiting for Game Master...
            </div>
          )}
        </div>
      </ClientGameScene>
    );
  }

  return null;
}

export default ClientView;
