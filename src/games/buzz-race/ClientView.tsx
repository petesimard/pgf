import ScoreBox from '@/components/shared/ScoreBox';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BuzzRaceState {
  currentPlayerId: string | null;
  scores: Record<string, number>;
  roundNumber: number;
  lastBuzzResult: { playerId: string; correct: boolean; playerName: string } | null;
}

function ClientView({ player, players, gameState, sendAction }: ClientViewProps) {
  const state = gameState as BuzzRaceState;

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

  const currentPlayer = players.find((p) => p.id === state.currentPlayerId);
  const isMyTurn = state.currentPlayerId === player.id;

  const handleBuzz = () => {
    sendAction({ type: 'buzz' });
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Status */}
      <Card
        className={cn(
          "text-center p-4 bg-card rounded-xl mb-4",
          isMyTurn && "bg-gradient-to-br from-success/20 to-success/10 border-2 border-success"
        )}
      >
        <div className="text-xl text-muted-foreground">Current Player:</div>
        <div className={cn(
          "text-3xl font-bold mt-1",
          isMyTurn ? "text-success" : "text-primary"
        )}>
          {isMyTurn ? 'YOUR TURN!' : currentPlayer?.name || '...'}
        </div>
      </Card>

      {/* Buzz Button */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Button
          onClick={handleBuzz}
          className="w-[200px] h-[200px] rounded-full border-0 bg-gradient-to-br from-destructive to-[#dc2626] text-white text-5xl font-extrabold shadow-[0_10px_30px_rgba(239,68,68,0.4)] hover:shadow-[0_15px_40px_rgba(239,68,68,0.5)] active:scale-95 transition-all uppercase"
        >
          BUZZ!
        </Button>
      </div>

      {/* Scoreboard */}
      <ScoreBox players={players} scores={state.scores} />
    </div>
  );
}

export default ClientView;
