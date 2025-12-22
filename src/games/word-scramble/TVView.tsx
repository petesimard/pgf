import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import TVGameScene from '../../components/shared/GameScene';
import Countdown from '@/components/shared/Countdown';
import { Card } from '@/components/ui/card';
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
  categoryHistory: CategoryResult[];
  scores: Record<string, number>;
}

function TVView({ players, gameState }: TVViewProps) {
  const state = gameState as WordScrambleState;
  const [timeRemaining, setTimeRemaining] = useState(0);

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

  if (!state || !state.letters || !state.categories) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  const currentLetter = state.letters[state.currentCategoryIndex];
  const currentCategory = state.categories[state.currentCategoryIndex];
  const activePlayers = players.filter(p => p.isActive);

  // Submitting Phase
  if (state.phase === 'submitting') {
    const submittedCount = Object.keys(state.submissions).length;
    const totalPlayers = activePlayers.length;

    return (
      <TVGameScene players={players} scores={state.scores}>
        <div className="flex flex-col items-center justify-center h-full p-8">
          {/* Timer */}
          <Countdown
            timeRemaining={timeRemaining}
            size="lg"
            className="mb-8"
          />

          {/* Letter */}
          <div className="text-3xl text-muted-foreground mb-4">Letter:</div>
          <div className="text-[12rem] font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent mb-8">
            {currentLetter}
          </div>

          {/* Category */}
          <Card className="p-8 bg-card/90 backdrop-blur mb-8">
            <div className="text-center">
              <div className="text-2xl text-muted-foreground mb-2">
                Category {state.currentCategoryIndex + 1} of {state.categories.length}
              </div>
              <div className="text-5xl font-extrabold text-foreground">
                {currentCategory}
              </div>
            </div>
          </Card>

          {/* Submission Status */}
          <div className="text-3xl font-bold text-muted-foreground">
            {submittedCount} / {totalPlayers} submitted
          </div>

          {/* Player submission indicators */}
          <div className="flex flex-wrap gap-4 mt-6 justify-center max-w-4xl">
            {activePlayers.map(player => (
              <div
                key={player.id}
                className={cn(
                  "px-4 py-2 rounded-lg font-semibold transition-all",
                  state.submissions[player.id]
                    ? "bg-success/20 border-2 border-success"
                    : "bg-muted/20 border-2 border-muted"
                )}
              >
                {player.name}
                {state.submissions[player.id] && " ✓"}
              </div>
            ))}
          </div>
        </div>
      </TVGameScene>
    );
  }

  // Revealing Phase
  if (state.phase === 'revealing') {
    const isAllRevealed = state.currentRevealIndex >= state.revealOrder.length;

    if (isAllRevealed || state.revealOrder.length === 0) {
      return (
        <TVGameScene players={players} scores={state.scores}>
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="text-6xl font-extrabold text-foreground mb-8">
              All Answers Revealed!
            </div>
            <div className="text-3xl text-muted-foreground mb-12">
              Category {state.currentCategoryIndex + 1} of {state.categories.length}: {currentCategory}
            </div>

            {/* Show summary of all answers */}
            <div className="max-w-4xl w-full">
              <Card className="p-6 bg-card/90">
                <div className="grid gap-3">
                  {state.revealOrder.map(playerId => {
                    const player = players.find(p => p.id === playerId);
                    const answer = state.submissions[playerId];
                    return (
                      <div key={playerId} className="flex justify-between items-center p-3 bg-muted/20 rounded">
                        <span className="font-semibold text-xl">{player?.name}</span>
                        <span className="text-2xl font-bold">{answer}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="text-2xl text-muted-foreground mt-8">
              Waiting for Game Master to continue...
            </div>
          </div>
        </TVGameScene>
      );
    }

    const currentPlayerId = state.revealOrder[state.currentRevealIndex];
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentAnswer = state.submissions[currentPlayerId];

    return (
      <TVGameScene players={players} scores={state.scores}>
        <div className="flex flex-col items-center justify-center h-full p-8">
          {/* Progress */}
          <div className="text-2xl text-muted-foreground mb-8">
            Revealing {state.currentRevealIndex + 1} of {state.revealOrder.length}
          </div>

          {/* Category reminder */}
          <div className="text-3xl text-muted-foreground mb-2">
            {currentCategory} ({currentLetter})
          </div>

          {/* Player name */}
          <div className="text-5xl font-extrabold text-primary mb-8">
            {currentPlayer?.name}
          </div>

          {/* Answer */}
          <Card className="p-12 bg-card/90 backdrop-blur mb-8">
            <div className="text-7xl font-extrabold text-foreground text-center">
              {currentAnswer}
            </div>
          </Card>

          {/* Timer */}
          <Countdown
            timeRemaining={timeRemaining}
            size="md"
            className="mb-4"
          />

          <div className="text-xl text-muted-foreground">
            Auto-advancing in {timeRemaining}s...
          </div>
        </div>
      </TVGameScene>
    );
  }

  // Voting Phase
  if (state.phase === 'voting') {
    const challengedPlayer = players.find(p => p.id === state.challengedPlayerId);
    const eligibleVoters = activePlayers.filter(p => p.id !== state.challengedPlayerId);
    const voteCount = Object.keys(state.votes).length;
    const upVotes = Object.values(state.votes).filter(v => v === 'up').length;
    const downVotes = Object.values(state.votes).filter(v => v === 'down').length;

    // Show result if voting is complete
    if (state.challengeResult) {
      return (
        <TVGameScene players={players} scores={state.scores}>
          <div className="flex flex-col items-center justify-center h-full p-8">
            {/* Result Header */}
            <div className={cn(
              "text-9xl font-extrabold mb-12 animate-pulse",
              state.challengeResult.accepted ? "text-success" : "text-destructive"
            )}>
              {state.challengeResult.accepted ? "ACCEPTED" : "REJECTED"}
            </div>

            {/* Challenged Answer */}
            <div className="text-3xl text-muted-foreground mb-4">
              {currentCategory} ({currentLetter})
            </div>

            <div className="text-4xl font-bold text-foreground mb-6">
              {challengedPlayer?.name}
            </div>

            <Card className={cn(
              "p-10 backdrop-blur mb-8 border-2",
              state.challengeResult.accepted ? "bg-success/10 border-success" : "bg-destructive/10 border-destructive"
            )}>
              <div className="text-6xl font-extrabold text-foreground text-center">
                "{state.challengedAnswer}"
              </div>
            </Card>

            {/* Final vote counts */}
            <div className="flex gap-12 text-4xl font-bold">
              <div>
                👍 {state.challengeResult.upVotes}
              </div>
              <div>
                👎 {state.challengeResult.downVotes}
              </div>
            </div>
          </div>
        </TVGameScene>
      );
    }

    // Still voting
    return (
      <TVGameScene players={players} scores={state.scores}>
        <div className="flex flex-col items-center justify-center h-full p-8">
          {/* Challenge Header */}
          <div className="text-6xl font-extrabold text-destructive mb-8 animate-pulse">
            CHALLENGE!
          </div>

          {/* Challenged Answer */}
          <div className="text-3xl text-muted-foreground mb-4">
            {currentCategory} ({currentLetter})
          </div>

          <div className="text-4xl font-bold text-foreground mb-6">
            {challengedPlayer?.name}
          </div>

          <Card className="p-10 bg-destructive/10 backdrop-blur border-destructive mb-8">
            <div className="text-6xl font-extrabold text-foreground text-center">
              "{state.challengedAnswer}"
            </div>
          </Card>

          {/* Vote Status */}
          <div className="text-3xl font-bold text-muted-foreground mb-4">
            {voteCount} / {eligibleVoters.length} voted
          </div>

          {/* Vote counts (shown during voting) */}
          <div className="flex gap-8 mb-8">
            <div className="text-2xl font-semibold">
              👍 {upVotes}
            </div>
            <div className="text-2xl font-semibold">
              👎 {downVotes}
            </div>
          </div>

          {/* Timer */}
          <Countdown
            timeRemaining={timeRemaining}
            size="lg"
          />
        </div>
      </TVGameScene>
    );
  }

  // Results Phase
  if (state.phase === 'results') {
    const sortedPlayers = activePlayers
      .map(p => ({
        player: p,
        score: state.scores[p.id] || 0
      }))
      .sort((a, b) => b.score - a.score);

    return (
      <TVGameScene players={players} scores={state.scores}>
        <div className="p-8 h-full overflow-y-auto">
          <div className="text-center mb-8">
            <div className="text-6xl font-extrabold text-foreground mb-4">
              Final Results
            </div>
            <div className="text-3xl text-muted-foreground">
              Round {state.roundNumber}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="max-w-3xl mx-auto mb-12">
            <Card className="p-8 bg-card/90">
              <div className="grid gap-4">
                {sortedPlayers.map(({ player, score }, index) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center gap-6 p-4 rounded-lg",
                      index === 0 && "bg-primary/20 border-2 border-primary",
                      index === 1 && "bg-muted/20",
                      index === 2 && "bg-muted/10"
                    )}
                  >
                    <div className={cn(
                      "text-5xl font-extrabold w-16 text-center",
                      index === 0 && "text-primary"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 text-3xl font-bold">
                      {player.name}
                    </div>
                    <div className="text-4xl font-extrabold text-primary">
                      {score}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Category Breakdown */}
          <div className="max-w-6xl mx-auto">
            <div className="text-3xl font-bold text-center mb-6">Category Breakdown</div>
            <div className="grid gap-6">
              {state.categoryHistory.map((categoryResult) => (
                <Card key={categoryResult.categoryIndex} className="p-6 bg-card/80">
                  <div className="text-2xl font-bold text-primary mb-4">
                    {categoryResult.category} ({categoryResult.letter})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {categoryResult.answers.map((answer) => (
                      <div
                        key={answer.playerId}
                        className={cn(
                          "p-3 rounded-lg border-2",
                          !answer.answer.trim() && "bg-muted/20 border-muted",
                          answer.answer.trim() && !answer.wasAccepted && "bg-destructive/20 border-destructive",
                          answer.wasAccepted && answer.pointsEarned === 0 && "bg-warning/20 border-warning",
                          answer.wasAccepted && answer.pointsEarned > 0 && "bg-success/20 border-success"
                        )}
                      >
                        <div className="text-sm font-semibold text-muted-foreground mb-1">
                          {answer.playerName}
                        </div>
                        <div className="text-lg font-bold">
                          {answer.answer || '—'}
                        </div>
                        <div className="text-xs mt-1 text-muted-foreground">
                          {answer.wasChallenged && '⚠ Challenged'}
                          {answer.wasAccepted && answer.pointsEarned > 0 && ` +${answer.pointsEarned}`}
                          {answer.wasAccepted && answer.pointsEarned === 0 && ' duplicate'}
                          {!answer.wasAccepted && ' rejected'}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </TVGameScene>
    );
  }

  return null;
}

export default TVView;
