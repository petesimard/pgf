import type { Player } from '../../types';

interface PlayerListProps {
  players: Player[];
  showScores?: boolean;
  scores?: Record<string, number>;
}

function PlayerList({ players, showScores = false, scores = {} }: PlayerListProps) {
  if (players.length === 0) return null;

  return (
    <div className="player-list">
      <h2>Players ({players.filter((p) => p.connected).length})</h2>
      <div className="player-grid">
        {players.map((player) => (
          <div
            key={player.id}
            className={`player-card ${player.isGameMaster ? 'game-master' : ''} ${!player.connected ? 'disconnected' : ''}`}
          >
            <div className="player-avatar">
              {player.name.charAt(0).toUpperCase()}
            </div>
            <span className="player-name">{player.name}</span>
            {player.isGameMaster && <span className="gm-badge">GM</span>}
            {showScores && (
              <span className={`score ${(scores[player.id] || 0) < 0 ? 'negative' : ''}`}>
                {scores[player.id] || 0}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlayerList;
