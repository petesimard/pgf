import type { Player } from '../../types';
import ScoreBox from './ScoreBox';

interface GameSceneProps {
  players: Player[];
  scores: Record<string, number>;
  children: React.ReactNode;
}

function TVGameScene({ players, scores, children }: GameSceneProps) {
  return (
    <div className="w-full h-screen flex flex-col">
      {/* Game Content - takes all available space except scorebox */}
      <div className="flex-1 min-h-0">
        {children}
      </div>

      {/* ScoreBox - fixed at bottom */}
      <div className="flex-shrink-0">
        <ScoreBox players={players} scores={scores} />
      </div>
    </div>
  );
}

export default TVGameScene;
