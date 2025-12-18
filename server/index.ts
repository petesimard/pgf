import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ServerToClientEvents, ClientToServerEvents, Player, GameDefinition } from '../src/types.js';
import type { ServerGameSession, GameHandler, GameServer, GameSocket } from './types.js';
import { buzzRaceGame } from './games/buzz-race.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io: GameServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// Store sessions
const sessions = new Map<string, ServerGameSession>();

// Store socket to session mapping
const socketToSession = new Map<string, { sessionId: string; playerId?: string; isTV: boolean }>();

// Game registry
const games = new Map<string, GameHandler>();

// Register games
games.set(buzzRaceGame.id, buzzRaceGame);

// Get available games list
function getGamesList(): GameDefinition[] {
  return Array.from(games.values()).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
  }));
}

// Create a new session
function createSession(): ServerGameSession {
  const sessionId = uuidv4().slice(0, 8).toUpperCase();
  const session: ServerGameSession = {
    id: sessionId,
    players: [],
    currentGameId: null,
    gameState: null,
    status: 'lobby',
    tvSocketId: null,
    playerSockets: new Map(),
    showQRCode: true,
  };
  sessions.set(sessionId, session);
  return session;
}

// Get sanitized session for clients
function getClientSession(session: ServerGameSession) {
  return {
    id: session.id,
    players: session.players,
    currentGameId: session.currentGameId,
    gameState: session.gameState,
    status: session.status,
    showQRCode: session.showQRCode,
  };
}

// Broadcast session state to all connected clients
function broadcastSessionState(session: ServerGameSession) {
  const clientSession = getClientSession(session);

  // Send to TV
  if (session.tvSocketId) {
    io.to(session.tvSocketId).emit('session:state', clientSession);
  }

  // Send to all players
  session.playerSockets.forEach((socketId) => {
    io.to(socketId).emit('session:state', clientSession);
  });
}

io.on('connection', (socket: GameSocket) => {
  console.log('Client connected:', socket.id);

  // TV creates a new session
  socket.on('session:create', (callback) => {
    const session = createSession();
    session.tvSocketId = socket.id;
    socketToSession.set(socket.id, { sessionId: session.id, isTV: true });

    console.log(`Session created: ${session.id}`);
    callback({ success: true, sessionId: session.id });

    // Send initial state and games list
    socket.emit('session:state', getClientSession(session));
    socket.emit('games:list', getGamesList());
  });

  // TV joins existing session (reconnect)
  socket.on('session:join', (sessionId, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found' });
      return;
    }

    session.tvSocketId = socket.id;
    socketToSession.set(socket.id, { sessionId, isTV: true });

    callback({ success: true });
    socket.emit('session:state', getClientSession(session));
    socket.emit('games:list', getGamesList());
  });

  // Player joins session
  socket.on('player:join', ({ sessionId, name }, callback) => {
    const session = sessions.get(sessionId.toUpperCase());
    if (!session) {
      callback({ success: false, error: 'Session not found' });
      return;
    }

    // Check if in a game that's already started and not showing QR
    if (session.status === 'playing' && !session.showQRCode) {
      callback({ success: false, error: 'Game in progress, cannot join' });
      return;
    }

    const playerId = uuidv4();
    const isFirstPlayer = session.players.length === 0;

    const player: Player = {
      id: playerId,
      name: name.trim().slice(0, 20),
      isGameMaster: isFirstPlayer,
      connected: true,
    };

    session.players.push(player);
    session.playerSockets.set(playerId, socket.id);
    socketToSession.set(socket.id, { sessionId: session.id, playerId, isTV: false });

    console.log(`Player ${player.name} joined session ${session.id} (GM: ${isFirstPlayer})`);

    callback({ success: true, playerId });

    // Notify all clients
    broadcastSessionState(session);

    // Send games list to the new player
    socket.emit('games:list', getGamesList());

    // Notify game if in progress
    if (session.status === 'playing' && session.currentGameId) {
      const game = games.get(session.currentGameId);
      game?.onPlayerJoin?.(session, io, player);
    }
  });

  // Game Master selects a game
  socket.on('game:select', (gameId) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player?.isGameMaster) return;

    if (!games.has(gameId)) return;

    session.currentGameId = gameId;
    console.log(`Game selected: ${gameId}`);
    broadcastSessionState(session);
  });

  // Game Master starts the game
  socket.on('game:start', () => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV) return;

    const session = sessions.get(mapping.sessionId);
    if (!session || !session.currentGameId) return;

    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player?.isGameMaster) return;

    const game = games.get(session.currentGameId);
    if (!game) return;

    // Check minimum players
    const connectedPlayers = session.players.filter((p) => p.connected).length;
    if (connectedPlayers < game.minPlayers) {
      socket.emit('session:error', `Need at least ${game.minPlayers} players to start`);
      return;
    }

    session.status = 'playing';
    session.showQRCode = false;

    console.log(`Game started: ${game.name}`);
    game.onStart(session, io);

    broadcastSessionState(session);
  });

  // Game Master ends the game
  socket.on('game:end', () => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player?.isGameMaster) return;

    if (session.currentGameId && session.status === 'playing') {
      const game = games.get(session.currentGameId);
      game?.onEnd(session, io);
    }

    session.status = 'lobby';
    session.currentGameId = null;
    session.gameState = null;
    session.showQRCode = true;

    console.log('Game ended, returning to lobby');
    broadcastSessionState(session);
  });

  // Game action from player
  socket.on('game:action', (action) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV || !mapping.playerId) return;

    const session = sessions.get(mapping.sessionId);
    if (!session || session.status !== 'playing' || !session.currentGameId) return;

    const game = games.get(session.currentGameId);
    if (!game) return;

    game.onAction(session, io, mapping.playerId, action);
    broadcastSessionState(session);
  });

  // Toggle QR code display
  socket.on('qr:toggle', (show) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player?.isGameMaster) return;

    session.showQRCode = show;
    broadcastSessionState(session);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    if (mapping.isTV) {
      // TV disconnected - keep session alive for reconnection
      session.tvSocketId = null;
      console.log(`TV disconnected from session ${session.id}`);
    } else if (mapping.playerId) {
      // Player disconnected
      const player = session.players.find((p) => p.id === mapping.playerId);
      if (player) {
        player.connected = false;
        session.playerSockets.delete(mapping.playerId);

        console.log(`Player ${player.name} disconnected from session ${session.id}`);

        // If Game Master disconnected, assign to next connected player
        if (player.isGameMaster) {
          player.isGameMaster = false;
          const nextGM = session.players.find((p) => p.connected && p.id !== player.id);
          if (nextGM) {
            nextGM.isGameMaster = true;
            console.log(`New Game Master: ${nextGM.name}`);
          }
        }

        // Notify game
        if (session.status === 'playing' && session.currentGameId) {
          const game = games.get(session.currentGameId);
          game?.onPlayerLeave?.(session, io, player);
        }

        broadcastSessionState(session);
      }
    }

    socketToSession.delete(socket.id);

    // Clean up empty sessions after a delay
    setTimeout(() => {
      if (session.players.every((p) => !p.connected) && !session.tvSocketId) {
        sessions.delete(session.id);
        console.log(`Session ${session.id} cleaned up`);
      }
    }, 60000);
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
