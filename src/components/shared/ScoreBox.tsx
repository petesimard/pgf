import type { Player } from '../../types';
import PlayerScore from './PlayerScore';

interface ScoreBoxProps {
  players: Player[];
  scores: Record<string, number>;
}

function ScoreBox({ players, scores }: ScoreBoxProps) {
  // Sort players by score (only show active players)
  const sortedPlayers = [...players]
    .filter((p) => p.connected && p.isActive)
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  return (
    <div className="flex flex-wrap gap-4 p-6 bg-card justify-center">
      {sortedPlayers.map((player) => {
        const score = scores[player.id] || 0;
        return <PlayerScore key={player.id} player={player} score={score} />;
      })}
    </div>
  );
}

export default ScoreBox;
