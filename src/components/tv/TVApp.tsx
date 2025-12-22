import { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import Lobby from './Lobby';
import GameContainer from './GameContainer';
import Avatar from './Avatar';

function TVApp() {
  const { connected, session, createSession, socket } = useSocket();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && !sessionId) {
      createSession()
        .then((id) => setSessionId(id))
        .catch((err) => setError(err.message));
    }
  }, [connected, sessionId, createSession]);

  if (!connected) {
    return (
      <div className="tv-container">
        <div className="waiting">
          <div className="spinner"></div>
          <h2>Connecting to server...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tv-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="tv-container">
        <div className="waiting">
          <div className="spinner"></div>
          <h2>Creating session...</h2>
        </div>
      </div>
    );
  }

  if (session.status === 'playing' && session.currentGameId) {
    return (
      <>
        <GameContainer session={session} socket={socket} />
        <Avatar socket={socket} />
      </>
    );
  }

  return (
    <>
      <Lobby session={session} />
      <Avatar socket={socket} />
    </>
  );
}

export default TVApp;
