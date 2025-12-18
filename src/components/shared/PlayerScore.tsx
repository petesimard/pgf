import type { Player } from '../../types';

interface PlayerScoreProps {
  player: Player;
  score: number;
}

function PlayerScore({ player, score }: PlayerScoreProps) {
  return (
    <div className={`score-item ${score < 0 ? 'negative' : ''}`}>
      <span className="name">{player.name}</span>
      <span className="score">{score}</span>
    </div>
  );
}

export default PlayerScore;
