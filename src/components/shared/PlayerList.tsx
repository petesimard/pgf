import type { Player } from '../../types';

interface PlayerListProps {
  players: Player[];
  showScores?: boolean;
  scores?: Record<string, number>;
}

function PlayerList({ players, showScores = false, scores = {} }: PlayerListProps) {
  if (players.length === 0) return null;

  const activePlayers = players.filter((p) => p.connected && p.isActive).length;
  const waitingPlayers = players.filter((p) => p.connected && !p.isActive).length;

  return (
    <div className="player-list">
      <h2>
        Players ({activePlayers}
        {waitingPlayers > 0 && ` + ${waitingPlayers} waiting`})
      </h2>
      <div className="player-grid">
        {players.map((player) => (
          <div
            key={player.id}
            className={`player-card ${player.isGameMaster ? 'game-master' : ''} ${!player.connected ? 'disconnected' : ''} ${!player.isActive ? 'waiting' : ''}`}
          >
            <div className="player-avatar">
              {player.name.charAt(0).toUpperCase()}
            </div>
            <span className="player-name">{player.name}</span>
            {player.isGameMaster && <span className="gm-badge">GM</span>}
            {!player.isActive && player.connected && <span className="waiting-badge">Waiting</span>}
            {showScores && player.isActive && (
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
