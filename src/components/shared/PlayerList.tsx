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
    <div className="mt-2 sm:mt-4 lg:mt-6 w-full max-w-2xl px-2">

      <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
        {players.map((player) => (
          <Card
            key={player.id}
            className={cn(
              "bg-card p-3 sm:p-4 lg:p-5 pb-1.5 sm:pb-2 rounded-2xl flex items-center gap-2 sm:gap-2.5 border-3 shadow-playful transition-all hover:-translate-y-0.5 hover:shadow-playful-lg min-h-[44px] sm:min-h-[50px] lg:min-h-[54px]",
              player.isGameMaster && "border-secondary bg-gradient-to-b from-[#ff6b9d] via-[#ff4081]/20 to-card",
              !player.connected && "opacity-50 grayscale",
              !player.isActive && "opacity-70 border-dashed"
            )}
          >
            <Avatar className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 border-2 border-foreground bg-primary">
              <AvatarFallback className="font-extrabold text-base sm:text-lg text-foreground">
                {player.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-bold text-sm sm:text-base text-foreground flex-1">{player.name}</span>
            {player.isGameMaster && (
              <Badge
                variant="secondary"
                className="bg-secondary text-secondary-foreground px-1.5 sm:px-2 lg:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border-2 border-foreground"
              >
                GM
              </Badge>
            )}
            {!player.isActive && player.connected && (
              <Badge
                className="bg-[#f59e0b] text-white px-1.5 sm:px-2 lg:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border-2 border-foreground"
              >
                Waiting
              </Badge>
            )}
            {showScores && player.isActive && (
              <span
                className={cn(
                  "text-lg sm:text-xl lg:text-2xl font-bold",
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
