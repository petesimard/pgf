import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';
import type { GameSession } from '../../types';
import PlayerList from '../shared/PlayerList';

interface LobbyProps {
  session: GameSession;
}

function Lobby({ session }: LobbyProps) {
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the server URL from the backend
    fetch('/api/server-url')
      .then((res) => res.json())
      .then((data) => setServerUrl(data.url))
      .catch(() => {
        // Fallback to window.location.origin if fetch fails
        setServerUrl(window.location.origin);
      });
  }, []);

  const joinUrl = serverUrl ? `${serverUrl}/join/${session.id}` : `${window.location.origin}/join/${session.id}`;

  return (
    <div className="tv-container">
      <div className="tv-header">
        <h1>Phone Party</h1>
        <p style={{ fontSize: '1.25rem', color: '#5d5d5d', fontWeight: 600, marginTop: '0.5rem' }}>
          Scan the code to join the fun!
        </p>
      </div>

      <div className="qr-section">
        <div className="qr-code">
          <QRCodeSVG value={joinUrl} size={280} level="M" />
        </div>
        <div className="session-code">{session.id}</div>
        <div className="join-url">Scan to join or visit: {joinUrl}</div>
      </div>

      <PlayerList players={session.players} />

      {session.players.length === 0 && (
        <div className="waiting" style={{ marginTop: '2rem' }}>
          <h2>Waiting for players to join...</h2>
        </div>
      )}

      {session.currentGameId && (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Game selected: <strong style={{ color: 'var(--primary-color)' }}>{session.currentGameId}</strong></p>
          <p>Waiting for Game Master to start...</p>
        </div>
      )}
    </div>
  );
}

export default Lobby;
