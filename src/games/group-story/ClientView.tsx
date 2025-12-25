import { useEffect, useState, useRef } from 'react';
import type { ClientViewProps } from '../types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Countdown from '@/components/shared/Countdown';
import { Check, AlertCircle } from 'lucide-react';

interface GroupStoryState {
  phase: 'answering' | 'generating' | 'displaying' | 'error';
  questions: Array<{ playerId: string; question: string }>;
  answers: Record<string, string>;
  currentStory: { text: string; imagePrompt: string } | null;
  storyHistory: Array<{ text: string; imagePrompt: string; round: number }>;
  currentRound: number;
  timeRemaining: number;
  errorMessage?: string;
}

function ClientView({ player, gameState, sendAction, endGame }: ClientViewProps) {
  const state = gameState as GroupStoryState;
  const [answer, setAnswer] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [localTimeRemaining, setLocalTimeRemaining] = useState(0);
  const hasStartedTimer = useRef(false);

  const isGameMaster = player.isGameMaster;
  const myQuestion = state?.questions.find((q) => q.playerId === player.id);
  const hasAnswered = state?.answers && state.answers[player.id] !== undefined;

  // Sync local timer with server state
  useEffect(() => {
    if (state?.timeRemaining !== undefined && state.timeRemaining > 0) {
      setLocalTimeRemaining(state.timeRemaining);
      hasStartedTimer.current = true;
    }
  }, [state?.timeRemaining]);

  // Client-side countdown for smooth animation
  useEffect(() => {
    if (state?.phase !== 'answering') return;

    const interval = setInterval(() => {
      setLocalTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.phase]);

  // Reset submission state when phase changes
  useEffect(() => {
    if (state?.phase === 'answering') {
      setHasSubmitted(false);
      setAnswer('');
      hasStartedTimer.current = false;
    }
  }, [state?.phase]);

  // Auto-submit on timer expiry
  useEffect(() => {
    if (state?.phase !== 'answering') return;
    if (localTimeRemaining !== 0) return;
    if (hasSubmitted || hasAnswered) return;
    if (!hasStartedTimer.current) return; // Only auto-submit if timer actually started

    console.log('[ClientView] Auto-submitting answer due to timer');
    handleSubmit();
  }, [localTimeRemaining, state?.phase, hasSubmitted, hasAnswered]);

  const handleSubmit = () => {
    if (hasSubmitted || hasAnswered) return;

    console.log('[ClientView] Submitting answer:', answer);
    sendAction({
      type: 'submit-answer',
      payload: { answer: answer.trim() || '' },
    });
    setHasSubmitted(true);
  };

  const handleNextRound = () => {
    console.log('[ClientView] GM starting next round');
    sendAction({ type: 'next-round' });
  };

  const handleRetry = () => {
    console.log('[ClientView] GM retrying generation');
    sendAction({ type: 'retry-generation' });
  };

  const handleRetryQuestions = () => {
    console.log('[ClientView] GM retrying questions');
    sendAction({ type: 'retry-questions' });
  };

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xl text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  // Answering Phase
  if (state.phase === 'answering') {
    return (
      <div className="flex-1 flex flex-col p-4">
        <Card className="p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Your Question</h2>
            <Countdown timeRemaining={localTimeRemaining} label="" size="sm" />
          </div>

          <p className="text-xl text-muted-foreground mb-6">
            {myQuestion?.question || 'Waiting for question...'}
          </p>

          {!hasAnswered ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-4 border-2 rounded-lg text-lg min-h-[120px] mb-4 bg-background text-foreground focus:border-primary focus:outline-none"
                maxLength={200}
                disabled={hasSubmitted}
              />

              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">{answer.length}/200 characters</span>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!answer.trim() || hasSubmitted}
                className="w-full h-14 text-lg"
              >
                {hasSubmitted ? 'Submitting...' : 'Submit Answer'}
              </Button>
            </>
          ) : (
            <Card className="p-6 bg-green-500/10 border-green-500 border-2">
              <div className="flex items-center gap-3 text-green-500 mb-3">
                <Check className="w-6 h-6" />
                <span className="text-xl font-bold">Answer Submitted!</span>
              </div>
              <p className="text-lg text-foreground">
                Your answer: <span className="font-medium">"{state.answers[player.id]}"</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Waiting for other players...
              </p>
            </Card>
          )}
        </Card>
      </div>
    );
  }

  // Generating Phase
  if (state.phase === 'generating') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary mb-2">Creating Story...</h2>
          <p className="text-muted-foreground">AI is working its magic</p>
        </Card>
      </div>
    );
  }

  // Displaying Phase
  if (state.phase === 'displaying') {
    return (
      <div className="flex-1 flex flex-col p-4">
        <Card className="p-8 text-center mb-6">
          <div className="text-5xl mb-4">📖</div>
          <h2 className="text-2xl font-bold text-primary mb-4">Story Complete!</h2>
          <p className="text-lg text-muted-foreground">
            Check the TV to see the illustrated story
          </p>
        </Card>

        {/* GM Controls */}
        {isGameMaster && (
          <div className="space-y-3">
            <Button onClick={handleNextRound} className="w-full h-14 text-lg bg-primary">
              Continue Story
            </Button>

            {endGame && (
              <Button onClick={endGame} variant="destructive" className="w-full h-14 text-lg">
                End Game
              </Button>
            )}
          </div>
        )}

        {/* Non-GM message */}
        {!isGameMaster && (
          <Card className="p-4 bg-muted">
            <p className="text-center text-muted-foreground">
              Waiting for Game Master to continue or end the game...
            </p>
          </Card>
        )}
      </div>
    );
  }

  // Error Phase
  if (state.phase === 'error') {
    // Check if error is due to empty answers
    const isEmptyAnswersError = state.errorMessage?.includes('empty answers');

    return (
      <div className="flex-1 flex flex-col p-4">
        <Card className="p-8 mb-6 border-destructive border-2">
          <div className="text-center mb-6">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-destructive mb-2">
              {isEmptyAnswersError ? 'No Answers Provided' : 'Generation Failed'}
            </h2>
            <p className="text-muted-foreground">{state.errorMessage || 'Unknown error'}</p>
          </div>
        </Card>

        {/* GM Retry Button */}
        {isGameMaster && (
          <div className="space-y-3">
            {isEmptyAnswersError ? (
              <Button onClick={handleRetryQuestions} className="w-full h-14 text-lg bg-primary">
                Retry Questions
              </Button>
            ) : (
              <Button onClick={handleRetry} className="w-full h-14 text-lg bg-primary">
                Retry Generation
              </Button>
            )}

            {endGame && (
              <Button onClick={endGame} variant="destructive" className="w-full h-14 text-lg">
                End Game
              </Button>
            )}
          </div>
        )}

        {/* Non-GM message */}
        {!isGameMaster && (
          <Card className="p-4 bg-muted">
            <p className="text-center text-muted-foreground">
              Waiting for Game Master to retry or end the game...
            </p>
          </Card>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <p className="text-xl text-muted-foreground">Unknown game state</p>
    </div>
  );
}

export default ClientView;
