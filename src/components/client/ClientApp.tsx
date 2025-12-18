import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import JoinForm from './JoinForm';
import ClientLobby from './ClientLobby';
import ClientGameContainer from './ClientGameContainer';

function ClientApp() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { connected, session, games, playerId, error, joinSession, selectGame, startGame, endGame, sendAction, toggleQR } = useSocket();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  if (!connected) {
    return (
      <div className="client-container">
        <div className="waiting">
          <div className="spinner"></div>
          <h2>Connecting...</h2>
        </div>
      </div>
    );
  }

  const handleJoin = async (name: string) => {
    if (!sessionId) {
      setJoinError('Invalid session');
      return;
    }

    try {
      await joinSession(sessionId, name);
      setHasJoined(true);
      setJoinError(null);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  // Show join form if not joined yet
  if (!hasJoined || !playerId) {
    return (
      <div className="client-container">
        <div className="client-header">
          <h1>Join Game</h1>
          <p>Session: <strong>{sessionId}</strong></p>
        </div>
        <JoinForm onJoin={handleJoin} error={joinError || error} />
      </div>
    );
  }

  // Find current player
  const currentPlayer = session?.players.find((p) => p.id === playerId);

  if (!session || !currentPlayer) {
    return (
      <div className="client-container">
        <div className="waiting">
          <div className="spinner"></div>
          <h2>Loading session...</h2>
        </div>
      </div>
    );
  }

  // Show game view if game is in progress
  if (session.status === 'playing' && session.currentGameId) {
    return (
      <ClientGameContainer
        session={session}
        player={currentPlayer}
        sendAction={sendAction}
        endGame={endGame}
        toggleQR={toggleQR}
      />
    );
  }

  // Show lobby
  return (
    <ClientLobby
      session={session}
      player={currentPlayer}
      games={games}
      onSelectGame={selectGame}
      onStartGame={startGame}
      error={error}
    />
  );
}

export default ClientApp;
