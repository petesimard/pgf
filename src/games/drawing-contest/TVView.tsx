import type { TVViewProps } from '../types';
import TVGameScene from '../../components/shared/GameScene';

interface DrawingContestState {
  // TODO: Define your game state (must match server state)
}

function TVView({ players, gameState }: TVViewProps) {
  const state = gameState as DrawingContestState;

  if (!state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  return (
    <TVGameScene players={players} scores={{}}>
      {/* TODO: Implement your TV view */}
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-6xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent text-center">
          Drawing Contest TV View
        </div>
        <div className="text-2xl text-muted-foreground mt-4">
          Game content goes here
        </div>
      </div>
    </TVGameScene>
  );
}

export default TVView;
