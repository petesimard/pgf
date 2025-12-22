import type { Player } from '../../types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PlayerScoreProps {
  player: Player;
  score: number;
}

function PlayerScore({ player, score }: PlayerScoreProps) {
  return (
    <Card className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border-3 shadow-playful">
      <Avatar className="w-8 h-8 border-2 border-foreground">
        <AvatarImage src={player.avatar} alt={player.name} />
        <AvatarFallback className="font-extrabold text-sm text-foreground bg-primary">
          {player.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-semibold">{player.name}</span>
      <span className={cn(
        "text-2xl font-bold",
        score < 0 ? "text-destructive" : "text-primary"
      )}>
        {score}
      </span>
    </Card>
  );
}

export default PlayerScore;
