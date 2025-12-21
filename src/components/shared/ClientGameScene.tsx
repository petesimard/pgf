import type { Player } from '../../types';
import ScoreBox from './ScoreBox';

interface ClientGameSceneProps {
  players: Player[];
  scores: Record<string, number>;
  children: React.ReactNode;
  showScorebox?: boolean;
}

function ClientGameScene({ players, scores, children, showScorebox = false }: ClientGameSceneProps) {
  return (
    <div className="h-full flex flex-col p-4">
      {/* Game Content - takes all available space except scorebox */}
      <div className="flex-1 min-h-0">
        {children}
      </div>

      {/* ScoreBox - fixed at bottom */}
      {showScorebox && (
        <div className="flex-shrink-0">
          <ScoreBox players={players} scores={scores} />
        </div>
      )}
    </div>
  );
}

export default ClientGameScene;
