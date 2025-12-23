// Shared types between client and server

export interface Player {
  id: string;
  name: string;
  isGameMaster: boolean;
  connected: boolean;
  deviceId: string;
  isActive: boolean; // false if player joined mid-game and is waiting in lobby
}

export interface GameSession {
  id: string;
  players: Player[];
  currentGameId: string | null;
  gameState: unknown;
  status: 'lobby' | 'playing';
  tvZoom: number; // TV display zoom level (20-200)
}

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

// Socket event types
export interface ServerToClientEvents {
  'session:state': (session: GameSession) => void;
  'session:error': (error: string) => void;
  'session:reset': () => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'player:removed': (data: { reason: string; message: string }) => void;
  'game:started': (gameId: string) => void;
  'game:ended': () => void;
  'game:state': (state: unknown) => void;
  'games:list': (games: GameDefinition[]) => void;
  'keepalive:ping': () => void;
  'drawing:image': (data: { playerId: string; imageData: string }) => void;
}

export interface ClientToServerEvents {
  'player:join': (data: { sessionId: string; name: string; deviceId: string }, callback: (response: { success: boolean; playerId?: string; error?: string }) => void) => void;
  'player:rename': (newName: string, callback: (response: { success: boolean; error?: string }) => void) => void;
  'session:create': (data: { tvZoom?: number }, callback: (response: { success: boolean; sessionId?: string; error?: string }) => void) => void;
  'session:join': (data: { sessionId: string; tvZoom?: number }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:select': (gameId: string) => void;
  'game:start': () => void;
  'game:end': () => void;
  'game:action': (action: { type: string; payload?: unknown }) => void;
  'qr:toggle': (show: boolean) => void;
  'tv:zoom': (zoom: number) => void;
  'keepalive:pong': () => void;
}
