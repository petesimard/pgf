import ClientGameScene from '@/components/shared/ClientGameScene';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DrawingContestState {
  // TODO: Define your game state (must match server state)
}

function ClientView({ player, players, gameState, sendAction }: ClientViewProps) {
  const state = gameState as DrawingContestState;

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

  const handleAction = () => {
    // TODO: Send game actions to server
    sendAction({ type: 'your-action' });
  };

  return (
    <ClientGameScene players={players} scores={{}}>
      {/* TODO: Implement your client view */}
      <Card className="text-center p-4 bg-card rounded-xl mb-4">
        <div className="text-xl text-muted-foreground">Player Controls</div>
        <div className="text-3xl font-bold mt-1 text-primary">
          {player.name}
        </div>
      </Card>

      <div className="flex-1 flex items-center justify-center p-8">
        <Button
          onClick={handleAction}
          className="w-[200px] h-[200px] rounded-full text-3xl font-extrabold"
        >
          ACTION
        </Button>
      </div>
    </ClientGameScene>
  );
}

export default ClientView;
