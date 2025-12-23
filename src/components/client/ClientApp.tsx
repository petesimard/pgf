import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import JoinForm from './JoinForm';
import ClientLobby from './ClientLobby';
import ClientGameContainer from './ClientGameContainer';

const PLAYER_NAME_KEY = 'playerName';

function ClientApp() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { connected, session, games, playerId, error, joinSession, renamePlayer, selectGame, startGame, endGame, sendAction, toggleQR, setTVZoom } = useSocket();
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
      <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto bg-background items-center justify-center">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Connecting...</h2>
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
      <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto bg-background">
        <div className="text-center py-5 px-6 mb-5 bg-card rounded-2xl border-3 shadow-playful">
          <h1 className="text-3xl font-black text-foreground text-shadow-sm mb-1 uppercase">
            Join Game
          </h1>
          <p className="text-muted-foreground font-semibold m-0">
            Session: <strong>{sessionId}</strong>
          </p>
        </div>
        <JoinForm onJoin={handleJoin} error={joinError || error} />
      </div>
    );
  }

  // Find current player
  const currentPlayer = session?.players.find((p) => p.id === playerId);

  if (!session || !currentPlayer) {
    return (
      <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto bg-background items-center justify-center">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading session...</h2>
        </div>
      </div>
    );
  }

  // Show game view if game is in progress
  if (session.status === 'playing' && session.currentGameId) {
    // If player is inactive, show waiting screen
    if (!currentPlayer.isActive) {
      return (
        <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto bg-background">
          <div className="text-center py-5 px-6 mb-5 bg-card rounded-2xl border-3 shadow-playful">
            <h1 className="text-3xl font-black text-foreground text-shadow-sm uppercase">
              Game in Progress
            </h1>
          </div>
          <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful mt-8">
            <h2 className="text-muted-foreground font-extrabold mb-4">
              Waiting for current game to finish
            </h2>
            <p className="mt-4 text-muted-foreground">
              You'll be able to join the next game when this one ends.
            </p>
            <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mt-4"></div>
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
        setTVZoom={setTVZoom}
        renamePlayer={renamePlayer}
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
      setTVZoom={setTVZoom}
      renamePlayer={renamePlayer}
    />
  );
}

export default ClientApp;
