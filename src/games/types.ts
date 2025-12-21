import type { ComponentType } from 'react';
import type { Player, GameSession, ServerToClientEvents, ClientToServerEvents } from '../types';
import type { Socket } from 'socket.io-client';

export interface TVViewProps {
  session: GameSession;
  players: Player[];
  gameState: unknown;
  socket?: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

export interface ClientViewProps {
  session: GameSession;
  player: Player;
  players: Player[];
  isGameMaster: boolean;
  gameState: unknown;
  sendAction: (action: { type: string; payload?: unknown }) => void;
  endGame?: () => void;
}

export interface GameRegistration {
  id: string;
  TVView: ComponentType<TVViewProps>;
  ClientView: ComponentType<ClientViewProps>;
}
