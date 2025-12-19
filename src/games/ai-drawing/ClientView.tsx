import { useEffect, useRef, useState } from 'react';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Editor, Erase, Color4 } from 'js-draw';
import 'js-draw/Editor.css';

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

function ClientView({ player, gameState, sendAction }: ClientViewProps) {
  const state = gameState as AIDrawingState;
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const playerDrawing = state?.drawings[player.id];

  useEffect(() => {
    const container = containerRef.current;
    if (!container || editorRef.current) return;

    // Create js-draw editor with white background
    const editor = new Editor(container, {
      wheelEventsEnabled: false,
    });

    // Set white background color
    editor.dispatch(
      editor.setBackgroundStyle({
        color: Color4.white,
        autoresize: true,
      }),
      false // Don't add to history
    );

    editorRef.current = editor;

    return () => {
      if (editorRef.current) {
        editorRef.current.remove();
        editorRef.current = null;
      }
    };
  }, []);

  const handleSubmit = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Export as PNG
    const imageData = editor.toDataURL();
    sendAction({
      type: 'submit-drawing',
      payload: { imageData },
    });
    setHasSubmitted(true);
  };

  const handleClear = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Get all components and erase them
    const allComponents = editor.image.getAllComponents();
    if (allComponents.length > 0) {
      editor.dispatch(new Erase(allComponents));
    }
  };

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

  if (state.phase === 'judging') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Card className="text-center p-8 bg-card rounded-xl">
          <div className="w-16 h-16 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-2xl font-bold text-primary mb-2">AI is judging...</div>
          <div className="text-muted-foreground">Please wait while the AI reviews all drawings</div>
        </Card>
      </div>
    );
  }

  if (state.phase === 'results') {
    const myResult = state.results?.find((r) => r.playerId === player.id);
    return (
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <Card className="p-6 bg-card rounded-xl mb-4">
          <div className="text-center mb-4">
            <div className="text-2xl font-bold text-primary mb-2">Results</div>
            {myResult && (
              <div className="text-lg">
                <span className="font-bold">Your rank: #{myResult.rank}</span>
              </div>
            )}
          </div>

          {state.results && state.results.length > 0 && (
            <div className="space-y-3">
              {state.results.map((result, index) => (
                <div
                  key={result.playerId}
                  className={cn(
                    'p-4 rounded-lg border-2',
                    result.playerId === player.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full',
                        index === 0 && 'bg-yellow-500 text-white',
                        index === 1 && 'bg-gray-400 text-white',
                        index === 2 && 'bg-amber-700 text-white',
                        index > 2 && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {result.rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{result.playerName}</div>
                      <div className="text-sm text-muted-foreground italic">{result.reason}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      {/* Header with word and timer */}
      <Card className="p-4 mb-4 bg-card rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Draw this:</div>
            <div className="text-3xl font-bold text-primary">{state.word}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Time Left</div>
            <div
              className={cn(
                'text-3xl font-bold',
                state.timeRemaining <= 10 ? 'text-destructive animate-pulse' : 'text-success'
              )}
            >
              {state.timeRemaining}s
            </div>
          </div>
        </div>
      </Card>

      {/* Drawing Canvas */}
      <div className="flex-1 flex items-center justify-center mb-4">
        <div className="relative aspect-square w-full" style={{ maxHeight: '50vh', maxWidth: '50vh' }}>
          <div
            ref={containerRef}
            className="border-4 border-border rounded-lg bg-white overflow-hidden w-full h-full"
          />
          {hasSubmitted && (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <div className="bg-success text-white px-6 py-3 rounded-lg font-bold text-xl flex items-center gap-2">
                <Check className="w-6 h-6" />
                Submitted!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {!hasSubmitted && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClear} className="flex-1 h-12">
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={playerDrawing?.submitted}
            className="flex-1 h-12 bg-success hover:bg-success/90"
          >
            <Check className="w-5 h-5 mr-2" />
            Submit
          </Button>
        </div>
      )}

      {/* Submission Status */}
      {playerDrawing?.submitted && (
        <Card className="p-4 bg-success/10 border-success rounded-xl mt-2">
          <div className="text-center text-success font-bold">
            ✓ Drawing submitted! Waiting for other players...
          </div>
        </Card>
      )}
    </div>
  );
}

export default ClientView;
