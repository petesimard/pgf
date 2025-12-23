import { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import Lobby from './Lobby';
import GameContainer from './GameContainer';

function TVApp() {
  const { connected, session, createSession, socket, wasReset, clearReset } = useSocket();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && !sessionId) {
      createSession()
        .then((id) => setSessionId(id))
        .catch((err) => setError(err.message));
    }
  }, [connected, sessionId, createSession]);

  // Handle session reset - clear the reset flag
  useEffect(() => {
    if (wasReset) {
      console.log('[TVApp] Session was reset to lobby');
      clearReset();
      // The session state will be updated automatically via session:state event
      // which will show the lobby with QR code
    }
  }, [wasReset, clearReset]);

  // Apply zoom to body element
  useEffect(() => {
    if (session?.tvZoom) {
      document.body.style.zoom = `${session.tvZoom}%`;
    }

    // Cleanup function to reset zoom when component unmounts
    return () => {
      document.body.style.zoom = '';
    };
  }, [session?.tvZoom]);

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
    return <GameContainer session={session} socket={socket} />;
  }

  return <Lobby session={session} />;
}

export default TVApp;
