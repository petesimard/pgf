import { useEffect, useRef, useState } from 'react';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pencil, Eraser, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type Tool = 'pencil' | 'eraser';
type BrushSize = 2 | 5 | 10 | 20;

function ClientView({ player, gameState, sendAction }: ClientViewProps) {
  const state = gameState as AIDrawingState;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('pencil');
  const [brushSize, setBrushSize] = useState<BrushSize>(5);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const playerDrawing = state?.drawings[player.id];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 400;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (hasSubmitted || state?.phase !== 'drawing') return;

    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x: number, y: number;

    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || hasSubmitted || state?.phase !== 'drawing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x: number, y: number;

    if ('touches' in e) {
      e.preventDefault();
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.lineTo(x, y);
    ctx.strokeStyle = tool === 'pencil' ? '#000000' : '#ffffff';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');
    sendAction({
      type: 'submit-drawing',
      payload: { imageData },
    });
    setHasSubmitted(true);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center mb-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="border-4 border-border rounded-lg bg-white touch-none max-w-full h-auto"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ maxHeight: '50vh' }}
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

      {/* Tools */}
      {!hasSubmitted && (
        <div className="space-y-3">
          {/* Tool Selection */}
          <div className="flex gap-2">
            <Button
              variant={tool === 'pencil' ? 'default' : 'outline'}
              onClick={() => setTool('pencil')}
              className="flex-1 h-12"
            >
              <Pencil className="w-5 h-5 mr-2" />
              Pencil
            </Button>
            <Button
              variant={tool === 'eraser' ? 'default' : 'outline'}
              onClick={() => setTool('eraser')}
              className="flex-1 h-12"
            >
              <Eraser className="w-5 h-5 mr-2" />
              Eraser
            </Button>
          </div>

          {/* Size Selection */}
          <div className="flex gap-2">
            {([2, 5, 10, 20] as BrushSize[]).map((size) => (
              <Button
                key={size}
                variant={brushSize === size ? 'default' : 'outline'}
                onClick={() => setBrushSize(size)}
                className="flex-1 h-10 text-sm"
              >
                {size}px
              </Button>
            ))}
          </div>

          {/* Action Buttons */}
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
