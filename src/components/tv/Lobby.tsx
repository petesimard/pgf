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
    <div className="h-screen flex flex-col items-center justify-center p-2 bg-background overflow-hidden">
      <div className="text-center mb-3">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-foreground text-shadow-playful uppercase tracking-tight">
          Phone Party
        </h1>
        <p className="text-base sm:text-md lg:text-lg text-muted-foreground font-semibold mt-1">
          Scan the code to join the fun!
        </p>
      </div>

      <Card className="bg-card p-2 sm:p-3 lg:p-4 rounded-3xl border-[4px] shadow-playful-lg text-center">
        <div className="bg-white p-2 sm:p-3 lg:p-4 rounded-2xl inline-block mb-2 border-3 border-foreground">
          <QRCodeSVG value={joinUrl} size={200} level="M" className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] lg:w-[160px] lg:h-[160px] xl:w-[200px] xl:h-[200px]" />
        </div>
        <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black tracking-[0.25em] text-foreground mt-1 text-shadow-sm">
          {session.id}
        </div>
        <div className="text-muted-foreground text-xs sm:text-sm lg:text-base mt-2 sm:mt-3 font-semibold">
          Scan to join or visit: <a href={joinUrl} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{joinUrl}</a>
        </div>
      </Card>

      <div className="flex-1 min-h-0 overflow-y-auto w-full flex flex-col items-center mt-0">
        <PlayerList players={session.players} />

        {session.players.length === 0 && (
          <Card className="mt-3 text-center p-4 sm:p-6 lg:p-8 bg-card rounded-2xl border-3 shadow-playful">
            <h2 className="text-muted-foreground font-extrabold mb-3 sm:mb-4 text-sm sm:text-base">
              Waiting for players to join...
            </h2>
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto"></div>
          </Card>
        )}

        {session.currentGameId && (
          <div className="mt-4 sm:mt-6 lg:mt-8 text-center text-muted-foreground">
            <p className="text-sm sm:text-base lg:text-lg">
              Game selected: <strong className="text-primary">{session.currentGameId}</strong>
            </p>
            <p className="text-sm sm:text-base lg:text-lg">Waiting for Game Master to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
