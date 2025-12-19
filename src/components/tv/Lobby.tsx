import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';
import type { GameSession } from '../../types';
import PlayerList from '../shared/PlayerList';
import { Card } from '@/components/ui/card';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="text-center mb-8">
        <h1 className="text-7xl font-black text-foreground text-shadow-playful uppercase tracking-tight">
          Phone Party
        </h1>
        <p className="text-xl text-muted-foreground font-semibold mt-2">
          Scan the code to join the fun!
        </p>
      </div>

      <Card className="bg-card p-10 rounded-3xl border-[4px] shadow-playful-lg text-center">
        <div className="bg-white p-4 rounded-2xl inline-block mb-4 border-3 border-foreground">
          <QRCodeSVG value={joinUrl} size={280} level="M" />
        </div>
        <div className="text-5xl font-black tracking-[0.25em] text-foreground mt-4 text-shadow-sm">
          {session.id}
        </div>
        <div className="text-muted-foreground text-base mt-3 font-semibold">
          Scan to join or visit: <a href={joinUrl} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{joinUrl}</a>
        </div>
      </Card>

      <PlayerList players={session.players} />

      {session.players.length === 0 && (
        <Card className="mt-8 text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <h2 className="text-muted-foreground font-extrabold mb-4">
            Waiting for players to join...
          </h2>
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto"></div>
        </Card>
      )}

      {session.currentGameId && (
        <div className="mt-8 text-center text-muted-foreground">
          <p className="text-lg">
            Game selected: <strong className="text-primary">{session.currentGameId}</strong>
          </p>
          <p className="text-lg">Waiting for Game Master to start...</p>
        </div>
      )}
    </div>
  );
}

export default Lobby;
