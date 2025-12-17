import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, Player, GameSession } from '../src/types.js';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface ServerGameSession extends GameSession {
  tvSocketId: string | null;
  playerSockets: Map<string, string>; // playerId -> socketId
  showQRCode: boolean;
}

export interface GameHandler {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;

  onStart: (session: ServerGameSession, io: GameServer) => void;
  onEnd: (session: ServerGameSession, io: GameServer) => void;
  onAction: (session: ServerGameSession, io: GameServer, playerId: string, action: { type: string; payload?: unknown }) => void;
  onPlayerJoin?: (session: ServerGameSession, io: GameServer, player: Player) => void;
  onPlayerLeave?: (session: ServerGameSession, io: GameServer, player: Player) => void;
}

export { Player, GameSession };
