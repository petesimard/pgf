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
  rejectedPlayerIds: string[];  // Track rejected answers for current category
  challengedPlayerIds: string[]; // Track all challenged players (accepted or rejected)
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center p-6 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-10 h-10 border-[3px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <h2 className="text-sm text-muted-foreground font-extrabold">Loading game...</h2>
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
        <div className="flex flex-col items-center justify-center h-full p-6">
          {/* Timer */}
          <Countdown
            timeRemaining={timeRemaining}
            size="lg"
            className="mb-6"
          />

          {/* Letter */}
          <div className="text-2xl text-muted-foreground mb-3">Letter:</div>
          <div className="text-[9.6rem] font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent mb-6">
            {currentLetter}
          </div>

          {/* Category */}
          <Card className="p-6 bg-card/90 backdrop-blur mb-6">
            <div className="text-center">
              <div className="text-lg text-muted-foreground mb-2">
                Category {state.currentCategoryIndex + 1} of {state.categories.length}
              </div>
              <div className="text-4xl font-extrabold text-foreground">
                {currentCategory}
              </div>
            </div>
          </Card>

          {/* Submission Status */}
          <div className="text-2xl font-bold text-muted-foreground">
            {submittedCount} / {totalPlayers} submitted
          </div>

          {/* Player submission indicators */}
          <div className="flex flex-wrap gap-3 mt-5 justify-center max-w-4xl">
            {activePlayers.map(player => (
              <div
                key={player.id}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all",
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
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="text-5xl font-extrabold text-foreground mb-6">
              All Answers Revealed!
            </div>
            <div className="text-2xl text-muted-foreground mb-10">
              Category {state.currentCategoryIndex + 1} of {state.categories.length}: {currentCategory}
            </div>

            {/* Show summary of all answers */}
            <div className="max-w-4xl w-full">
              <Card className="p-5 bg-card/90">
                <div className="grid gap-2.5">
                  {state.revealOrder.map(playerId => {
                    const player = players.find(p => p.id === playerId);
                    const answer = state.submissions[playerId];

                    // Check if this player was rejected by challenge
                    const wasRejected = state.rejectedPlayerIds?.includes(playerId) || false;

                    // Calculate points for this answer
                    const words = answer?.trim().split(/\s+/) || [];
                    const validWords = words.filter(word => {
                      for (const char of word) {
                        if (/[a-zA-Z]/.test(char)) {
                          return char.toLowerCase() === currentLetter.toLowerCase();
                        }
                      }
                      return false;
                    });
                    const points = validWords.length * 10;

                    // Check if this answer is a duplicate
                    const normalized = answer?.trim().toLowerCase() || '';
                    const duplicateCount = state.revealOrder.filter(pid =>
                      state.submissions[pid]?.trim().toLowerCase() === normalized
                    ).length;
                    const isDuplicate = duplicateCount > 1;
                    const finalPoints = wasRejected ? 0 : (isDuplicate ? 0 : points);

                    return (
                      <div key={playerId} className="flex justify-between items-center p-2.5 bg-muted/20 rounded">
                        <span className="font-semibold text-lg">{player?.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold">{answer}</span>
                          <span className={cn(
                            "text-base font-extrabold px-2.5 py-0.5 rounded",
                            finalPoints > 0 ? "text-success bg-success/20" : wasRejected ? "text-destructive bg-destructive/20" : "text-warning bg-warning/20"
                          )}>
                            {wasRejected ? 'Rejected (0 pts)' : isDuplicate ? 'Duplicate (0 pts)' : `${finalPoints} pts`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
            <div className="text-lg text-muted-foreground mt-6">
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
        <div className="flex flex-col items-center justify-center h-full p-6">
          {/* Progress */}
          <div className="text-lg text-muted-foreground mb-6">
            Revealing {state.currentRevealIndex + 1} of {state.revealOrder.length}
          </div>

          {/* Category reminder */}
          <div className="text-2xl text-muted-foreground mb-2">
            {currentCategory} ({currentLetter})
          </div>

          {/* Player name */}
          <div className="text-4xl font-extrabold text-primary mb-6">
            {currentPlayer?.name}
          </div>

          {/* Answer */}
          <Card className="p-10 bg-card/90 backdrop-blur mb-6">
            <div className="text-6xl font-extrabold text-foreground text-center">
              {currentAnswer}
            </div>
          </Card>

          {/* Timer */}
          <Countdown
            timeRemaining={timeRemaining}
            size="md"
            className="mb-3"
          />

          <div className="text-base text-muted-foreground">
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
          <div className="flex flex-col items-center justify-center h-full p-6">
            {/* Result Header */}
            <div className={cn(
              "text-7xl font-extrabold mb-10 animate-pulse",
              state.challengeResult.accepted ? "text-success" : "text-destructive"
            )}>
              {state.challengeResult.accepted ? "ACCEPTED" : "REJECTED"}
            </div>

            {/* Challenged Answer */}
            <div className="text-2xl text-muted-foreground mb-3">
              {currentCategory} ({currentLetter})
            </div>

            <div className="text-3xl font-bold text-foreground mb-5">
              {challengedPlayer?.name}
            </div>

            <Card className={cn(
              "p-8 backdrop-blur mb-6 border-2",
              state.challengeResult.accepted ? "bg-success/10 border-success" : "bg-destructive/10 border-destructive"
            )}>
              <div className="text-5xl font-extrabold text-foreground text-center">
                "{state.challengedAnswer}"
              </div>
            </Card>

            {/* Final vote counts */}
            <div className="flex gap-10 text-3xl font-bold">
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
        <div className="flex flex-col items-center justify-center h-full p-6">
          {/* Challenge Header */}
          <div className="text-5xl font-extrabold text-destructive mb-6 animate-pulse">
            CHALLENGE!
          </div>

          {/* Challenged Answer */}
          <div className="text-2xl text-muted-foreground mb-3">
            {currentCategory} ({currentLetter})
          </div>

          <div className="text-3xl font-bold text-foreground mb-5">
            {challengedPlayer?.name}
          </div>

          <Card className="p-8 bg-destructive/10 backdrop-blur border-destructive mb-6">
            <div className="text-5xl font-extrabold text-foreground text-center">
              "{state.challengedAnswer}"
            </div>
          </Card>

          {/* Vote Status */}
          <div className="text-2xl font-bold text-muted-foreground mb-3">
            {voteCount} / {eligibleVoters.length} voted
          </div>

          {/* Vote counts (shown during voting) */}
          <div className="flex gap-6 mb-6">
            <div className="text-lg font-semibold">
              👍 {upVotes}
            </div>
            <div className="text-lg font-semibold">
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
        <div className="p-6 h-full overflow-y-auto">
          <div className="text-center mb-6">
            <div className="text-5xl font-extrabold text-foreground mb-3">
              Final Results
            </div>
            <div className="text-2xl text-muted-foreground">
              Round {state.roundNumber}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="max-w-3xl mx-auto mb-10">
            <Card className="p-6 bg-card/90">
              <div className="grid gap-3">
                {sortedPlayers.map(({ player, score }, index) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center gap-5 p-3 rounded-lg",
                      index === 0 && "bg-primary/20 border-2 border-primary",
                      index === 1 && "bg-muted/20",
                      index === 2 && "bg-muted/10"
                    )}
                  >
                    <div className={cn(
                      "text-4xl font-extrabold w-14 text-center",
                      index === 0 && "text-primary"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 text-2xl font-bold">
                      {player.name}
                    </div>
                    <div className="text-3xl font-extrabold text-primary">
                      {score}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Category Breakdown */}
          <div className="max-w-6xl mx-auto">
            <div className="text-2xl font-bold text-center mb-5">Category Breakdown</div>
            <div className="grid gap-5">
              {state.categoryHistory.map((categoryResult) => (
                <Card key={categoryResult.categoryIndex} className="p-5 bg-card/80">
                  <div className="text-xl font-bold text-primary mb-3">
                    {categoryResult.category} ({categoryResult.letter})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {categoryResult.answers.map((answer) => (
                      <div
                        key={answer.playerId}
                        className={cn(
                          "p-2.5 rounded-lg border-2",
                          !answer.answer.trim() && "bg-muted/20 border-muted",
                          answer.answer.trim() && !answer.wasAccepted && "bg-destructive/20 border-destructive",
                          answer.wasAccepted && answer.pointsEarned === 0 && "bg-warning/20 border-warning",
                          answer.wasAccepted && answer.pointsEarned > 0 && "bg-success/20 border-success"
                        )}
                      >
                        <div className="text-xs font-semibold text-muted-foreground mb-0.5">
                          {answer.playerName}
                        </div>
                        <div className="text-base font-bold">
                          {answer.answer || '—'}
                        </div>
                        <div className="text-[10px] mt-0.5 text-muted-foreground">
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
