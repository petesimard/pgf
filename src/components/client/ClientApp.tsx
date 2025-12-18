import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import JoinForm from './JoinForm';
import ClientLobby from './ClientLobby';
import ClientGameContainer from './ClientGameContainer';

const PLAYER_NAME_KEY = 'playerName';

function ClientApp() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { connected, session, games, playerId, error, joinSession, selectGame, startGame, endGame, sendAction, toggleQR } = useSocket();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);

  // Auto-join with saved name when connected
  useEffect(() => {
    if (connected && !hasJoined && !autoJoining && sessionId) {
      const savedName = localStorage.getItem(PLAYER_NAME_KEY);
      if (savedName) {
        setAutoJoining(true);
        joinSession(sessionId, savedName)
          .then(() => {
            setHasJoined(true);
            setJoinError(null);
            setAutoJoining(false);
          })
          .catch((err) => {
            setJoinError(err instanceof Error ? err.message : 'Failed to join');
            setAutoJoining(false);
          });
      }
    }
  }, [connected, hasJoined, autoJoining, sessionId, joinSession]);

  if (!connected || autoJoining) {
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
    // If player is inactive, show waiting screen
    if (!currentPlayer.isActive) {
      return (
        <div className="client-container">
          <div className="client-header">
            <h1>Game in Progress</h1>
          </div>
          <div className="waiting" style={{ marginTop: '2rem' }}>
            <h2>Waiting for current game to finish</h2>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              You'll be able to join the next game when this one ends.
            </p>
          </div>
        </div>
      );
    }

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
