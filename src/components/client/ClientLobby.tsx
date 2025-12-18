import type { GameSession, Player, GameDefinition } from '../../types';
import PlayerList from '../shared/PlayerList';

interface ClientLobbyProps {
  session: GameSession;
  player: Player;
  games: GameDefinition[];
  onSelectGame: (gameId: string) => void;
  onStartGame: () => void;
  error: string | null;
}

function ClientLobby({ session, player, games, onSelectGame, onStartGame, error }: ClientLobbyProps) {
  const activePlayers = session.players.filter((p) => p.connected && p.isActive).length;
  const selectedGame = games.find((g) => g.id === session.currentGameId);
  const canStart = selectedGame && activePlayers >= selectedGame.minPlayers;

  return (
    <div className="client-container">
      <div className="client-header">
        <h1>Lobby</h1>
        <p>Welcome, <strong>{player.name}</strong>!</p>
        {player.isGameMaster && (
          <span className="gm-badge" style={{ marginLeft: '0.5rem' }}>Game Master</span>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Game Master Controls */}
      {player.isGameMaster && (
        <div className="game-selection">
          <h3>Select a Game</h3>
          <div className="game-list">
            {games.map((game) => (
              <div
                key={game.id}
                className={`game-option ${session.currentGameId === game.id ? 'selected' : ''}`}
                onClick={() => onSelectGame(game.id)}
              >
                <h3>{game.name}</h3>
                <p>{game.description}</p>
                <p className="player-req">
                  {game.minPlayers}-{game.maxPlayers} players
                </p>
              </div>
            ))}
          </div>

          {selectedGame && (
            <button
              className="btn btn-success"
              onClick={onStartGame}
              disabled={!canStart}
              style={{ width: '100%', marginTop: '1rem' }}
            >
              {canStart
                ? `Start ${selectedGame.name}`
                : `Need ${selectedGame.minPlayers - activePlayers} more player(s)`}
            </button>
          )}
        </div>
      )}

      {/* Non-GM waiting view */}
      {!player.isGameMaster && (
        <div className="waiting" style={{ marginTop: '2rem' }}>
          <h2>Waiting for Game Master</h2>
          {session.currentGameId && (
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              Selected: <strong style={{ color: 'var(--primary-color)' }}>{selectedGame?.name}</strong>
            </p>
          )}
        </div>
      )}

      <PlayerList players={session.players} />
    </div>
  );
}

export default ClientLobby;
