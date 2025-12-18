import type { Player } from '../../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PlayerListProps {
  players: Player[];
  showScores?: boolean;
  scores?: Record<string, number>;
}

function PlayerList({ players, showScores = false, scores = {} }: PlayerListProps) {
  if (players.length === 0) return null;

  const activePlayers = players.filter((p) => p.connected && p.isActive).length;
  const waitingPlayers = players.filter((p) => p.connected && !p.isActive).length;

  return (
    <div className="mt-6 w-full max-w-2xl">
      <h2 className="text-2xl mb-4 text-foreground font-extrabold text-shadow-sm">
        Players ({activePlayers}
        {waitingPlayers > 0 && ` + ${waitingPlayers} waiting`})
      </h2>
      <div className="flex flex-wrap gap-3 justify-center">
        {players.map((player) => (
          <Card
            key={player.id}
            className={cn(
              "bg-card p-5 pb-2 rounded-2xl flex items-center gap-2.5 border-3 shadow-playful transition-all hover:-translate-y-0.5 hover:shadow-playful-lg min-h-[54px]",
              player.isGameMaster && "border-secondary bg-gradient-to-b from-[#ff6b9d] via-[#ff4081]/20 to-card",
              !player.connected && "opacity-50 grayscale",
              !player.isActive && "opacity-70 border-dashed"
            )}
          >
            <Avatar className="w-10 h-10 border-2 border-foreground bg-primary">
              <AvatarFallback className="font-extrabold text-lg text-foreground">
                {player.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-bold text-base text-foreground flex-1">{player.name}</span>
            {player.isGameMaster && (
              <Badge
                variant="secondary"
                className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider border-2 border-foreground"
              >
                GM
              </Badge>
            )}
            {!player.isActive && player.connected && (
              <Badge
                className="bg-[#f59e0b] text-white px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider border-2 border-foreground"
              >
                Waiting
              </Badge>
            )}
            {showScores && player.isActive && (
              <span
                className={cn(
                  "text-2xl font-bold",
                  (scores[player.id] || 0) < 0 ? "text-destructive" : "text-primary"
                )}
              >
                {scores[player.id] || 0}
              </span>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default PlayerList;
