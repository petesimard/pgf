import type { GameSession, ServerToClientEvents, ClientToServerEvents } from '../../types';
import { getGame } from '../../games';
import { QRCodeSVG } from 'qrcode.react';
import type { Socket } from 'socket.io-client';

interface GameContainerProps {
  session: GameSession & { showQRCode?: boolean };
  socket?: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

function GameContainer({ session, socket }: GameContainerProps) {
  const game = session.currentGameId ? getGame(session.currentGameId) : null;

  if (!game) {
    return (
      <div className="tv-container">
        <div className="error-message">Game not found: {session.currentGameId}</div>
      </div>
    );
  }

  const TVView = game.TVView;
  const joinUrl = `${window.location.origin}/join/${session.id}`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <TVView
        session={session}
        players={session.players}
        gameState={session.gameState}
        socket={socket}
      />

      {/* Mini QR Code overlay when showQRCode is true during game */}
      {session.showQRCode && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          background: 'var(--bg-card)',
          padding: '1rem',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}>
          <div style={{ background: 'white', padding: '0.5rem', borderRadius: '0.5rem' }}>
            <QRCodeSVG value={joinUrl} size={120} level="M" />
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {session.id}
          </div>
        </div>
      )}
    </div>
  );
}

export default GameContainer;
