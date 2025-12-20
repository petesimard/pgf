import { useEffect, useRef, useState } from 'react';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Editor, Erase, Color4, PenTool } from 'js-draw';
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
  const [localTimeRemaining, setLocalTimeRemaining] = useState(state?.timeRemaining || 0);

  const playerDrawing = state?.drawings[player.id];

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

    // Add toolbar with custom controls
    const toolbar = editor.addToolbar();

    // Helper function to create icon elements
    const createIconElement = (iconType: string, size = 20, color?: string) => {
      const container = document.createElement('div');
      const svgPaths: Record<string, string> = {
        pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
        eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.5L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
        paintBucket: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
        minus: '<path d="M5 12h14"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        circle: '<circle cx="12" cy="12" r="10"/>',
      };

      container.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color || 'none'}" stroke="${color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${svgPaths[iconType] || ''}
        </svg>
      `;
      return container.firstElementChild as HTMLElement;
    };

    // Add line thickness controls
    toolbar.addActionButton(
      {
        label: 'Thinner',
        icon: createIconElement('minus'),
      },
      () => {
        const penTools = editor.toolController.getMatchingTools(PenTool);
        penTools.forEach(tool => {
          const currentThickness = tool.getThickness();
          tool.setThickness(Math.max(1, currentThickness - 2));
        });
      }
    );

    toolbar.addActionButton(
      {
        label: 'Thicker',
        icon: createIconElement('plus'),
      },
      () => {
        const penTools = editor.toolController.getMatchingTools(PenTool);
        penTools.forEach(tool => {
          const currentThickness = tool.getThickness();
          tool.setThickness(Math.min(50, currentThickness + 2));
        });
      }
    );

    // Add color picker buttons
    const colors = [
      { name: 'Black', value: Color4.black },
      { name: 'White', value: Color4.white },
      { name: 'Red', value: Color4.red },
      { name: 'Blue', value: Color4.blue },
      { name: 'Green', value: Color4.green },
      { name: 'Yellow', value: Color4.yellow },
      { name: 'Purple', value: Color4.purple },
      { name: 'Orange', value: Color4.orange },
    ];

    colors.forEach(({ name, value }) => {
      const rgbColor = `rgb(${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)})`;
      toolbar.addActionButton(
        {
          label: name,
          icon: createIconElement('circle', 20, rgbColor),
        },
        () => {
          const penTools = editor.toolController.getMatchingTools(PenTool);
          penTools.forEach(tool => {
            tool.setColor(value);
          });
        }
      );
    });

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
                localTimeRemaining <= 10 ? 'text-destructive animate-pulse' : 'text-success'
              )}
            >
              {localTimeRemaining}s
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
