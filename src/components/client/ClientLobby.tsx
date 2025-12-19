import type { GameSession, Player, GameDefinition } from '../../types';
import PlayerList from '../shared/PlayerList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
  const isDev = import.meta.env.DEV;
  const minPlayersRequired = isDev ? 1 : selectedGame?.minPlayers ?? 2;
  const canStart = selectedGame && activePlayers >= minPlayersRequired;

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto bg-background">
      <Card className="text-center py-5 px-6 mb-5 bg-card rounded-2xl border-3 shadow-playful">
        <h1 className="text-3xl font-black text-foreground text-shadow-sm mb-1 uppercase">
          Lobby
        </h1>
        <p className="text-muted-foreground font-semibold m-0">
          Welcome, <strong>{player.name}</strong>!
        </p>
        {player.isGameMaster && (
          <Badge
            variant="secondary"
            className="mt-2 bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider border-2 border-foreground"
          >
            Game Master
          </Badge>
        )}
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4 border-3 shadow-playful-sm">
          <AlertDescription className="font-bold text-center">{error}</AlertDescription>
        </Alert>
      )}

      {/* Game Master Controls */}
      {player.isGameMaster && (
        <div className="mb-6">
          <h3 className="text-2xl font-extrabold text-foreground text-shadow-sm mb-4">
            Select a Game
          </h3>
          <div className="flex flex-col gap-4 my-4">
            {games.map((game) => (
              <Card
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className={cn(
                  "p-4 px-5 bg-card border-3 rounded-2xl cursor-pointer transition-all shadow-playful hover:-translate-y-0.5 hover:shadow-playful-lg hover:border-primary",
                  session.currentGameId === game.id && "border-primary shadow-playful-lg"
                )}
              >
                <h3 className="text-xl mb-1.5 text-foreground font-extrabold mt-0">
                  {game.name}
                </h3>
                <p className="text-base text-muted-foreground font-semibold m-0">
                  {game.description}
                </p>
                <p className="text-sm text-muted font-bold mt-1.5">
                  {game.minPlayers}-{game.maxPlayers} players
                </p>
              </Card>
            ))}
          </div>

          {selectedGame && (
            <Button
              onClick={onStartGame}
              disabled={!canStart}
              size="lg"
              className="w-full mt-4 text-xl font-bold uppercase tracking-wide rounded-full border-3 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm bg-gradient-to-b from-primary to-[#4bc4ae]"
            >
              {canStart
                ? `Start ${selectedGame.name}`
                : `Need ${minPlayersRequired - activePlayers} more player(s)`}
            </Button>
          )}
        </div>
      )}

      {/* Non-GM waiting view */}
      {!player.isGameMaster && (
        <Card className="mt-8 text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <h2 className="text-muted-foreground mb-4 font-extrabold">
            Waiting for Game Master
          </h2>
          {session.currentGameId && (
            <p className="mt-4 text-muted-foreground">
              Selected: <strong className="text-primary">{selectedGame?.name}</strong>
            </p>
          )}
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mt-4"></div>
        </Card>
      )}

      <PlayerList players={session.players} />
    </div>
  );
}

export default ClientLobby;
