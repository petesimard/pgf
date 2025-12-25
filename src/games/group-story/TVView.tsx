import { useEffect, useState } from 'react';
import type { TVViewProps } from '../types';
import TVGameScene from '@/components/shared/GameScene';
import Countdown from '@/components/shared/Countdown';
import { Card } from '@/components/ui/card';

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

function TVView({ players, gameState, socket }: TVViewProps) {
  const state = gameState as GroupStoryState;
  const [localTimeRemaining, setLocalTimeRemaining] = useState(state?.timeRemaining || 0);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  // Sync local timer with server state
  useEffect(() => {
    if (state?.timeRemaining !== undefined) {
      setLocalTimeRemaining(state.timeRemaining);
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

  // Listen for story image from server
  useEffect(() => {
    if (!socket) return;

    const handleStoryImage = (data: { round: number; imageData: string }) => {
      console.log('[TVView] Received story image for round:', data.round);
      setCurrentImage(data.imageData);
    };

    socket.on('story:image', handleStoryImage);

    return () => {
      socket.off('story:image', handleStoryImage);
    };
  }, [socket]);


  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-2xl text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  // Answering Phase
  if (state.phase === 'answering') {
    return (
      <TVGameScene players={players} scores={{}} showScorebox={false}>
        <div className="p-6 space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-4">Round {state.currentRound}</h1>
            <h2 className="text-3xl text-muted-foreground">Answer Your Questions</h2>
          </div>

          <div className="flex justify-center mb-6">
            <Countdown timeRemaining={localTimeRemaining} label="Time Remaining" size="xl" />
          </div>
          
        </div>
      </TVGameScene>
    );
  }

  // Generating Phase
  if (state.phase === 'generating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-12 text-center max-w-2xl">
          <div className="w-20 h-20 border-[5px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-primary mb-4">Creating Your Story...</h2>
          <p className="text-xl text-muted-foreground">
            AI is weaving your answers into an epic tale
          </p>
        </Card>
      </div>
    );
  }

  // Displaying Phase
  if (state.phase === 'displaying' && state.currentStory) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <div className="max-[96vw] mx-auto w-full">
          <Card className="p-5 bg-card/95">
            <div className="relative">
              {/* Story Image - floated left */}
              {currentImage && (
                <img
                  src={`data:image/png;base64,${currentImage}`}
                  alt="Story illustration"
                  className="float-left mr-6 mb-4 max-w-[38%] rounded-xl shadow-2xl"
                />
              )}

              {/* Story Text - flows around image */}
              <p className="text-xl leading-relaxed text-foreground whitespace-pre-wrap">
                {state.currentStory.text}
              </p>

              {/* Clear float to ensure container height */}
              <div className="clear-both" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Error Phase
  if (state.phase === 'error') {
    const isEmptyAnswersError = state.errorMessage?.includes('empty answers');

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-12 text-center max-w-2xl border-destructive border-2">
          <div className="text-6xl mb-6">{isEmptyAnswersError ? '📝' : '⚠️'}</div>
          <h2 className="text-4xl font-bold text-destructive mb-4">
            {isEmptyAnswersError ? 'No Answers Provided' : 'Story Generation Failed'}
          </h2>
          <p className="text-xl text-muted-foreground mb-6">
            {state.errorMessage || 'An unknown error occurred'}
          </p>
          <p className="text-lg text-muted-foreground">
            {isEmptyAnswersError
              ? 'The Game Master can retry with new questions'
              : 'The Game Master can retry generation from their device'}
          </p>
        </Card>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-2xl text-muted-foreground">Unknown game state</p>
    </div>
  );
}

export default TVView;
