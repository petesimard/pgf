import type { ComponentType } from 'react';
import type { Player, GameSession } from '../types';

export interface TVViewProps {
  session: GameSession;
  players: Player[];
  gameState: unknown;
}

export interface ClientViewProps {
  session: GameSession;
  player: Player;
  players: Player[];
  isGameMaster: boolean;
  gameState: unknown;
  sendAction: (action: { type: string; payload?: unknown }) => void;
}

export interface GameRegistration {
  id: string;
  TVView: ComponentType<TVViewProps>;
  ClientView: ComponentType<ClientViewProps>;
}
