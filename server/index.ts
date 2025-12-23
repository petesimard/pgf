import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { hostname as getHostname } from 'os';
import type { ServerToClientEvents, ClientToServerEvents, Player, GameDefinition } from '../src/types.js';
import type { ServerGameSession, GameHandler, GameServer, GameSocket } from './types.js';
import { aiDrawingGame } from './games/ai-drawing.js';
import { wordScrambleGame } from './games/word-scramble.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server configuration
const PORT = process.env.PORT || 3000;
const HOSTNAME = process.env.HOSTNAME || getHostname();
// In development, the frontend is served by Vite on port 5173
const CLIENT_PORT = process.env.NODE_ENV === 'production' ? PORT : 5173;
const SERVER_URL = `http://${HOSTNAME}:${CLIENT_PORT}`;

// Keepalive configuration
const KEEPALIVE_INTERVAL = 10000; // Send ping every 10 seconds
const KEEPALIVE_TIMEOUT = 30000; // Consider player dead after 30 seconds

const app = express();
const httpServer = createServer(app);

const io: GameServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: true, // Allow all origins for phone connections
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store sessions
const sessions = new Map<string, ServerGameSession>();

// Store socket to session mapping
const socketToSession = new Map<string, { sessionId: string; playerId?: string; isTV: boolean }>();

// Game registry
const games = new Map<string, GameHandler>();

// Register games
games.set(aiDrawingGame.id, aiDrawingGame);
games.set(wordScrambleGame.id, wordScrambleGame);

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
    playerLastPing: new Map(),
    deviceToPlayer: new Map(),
    showQRCode: true,
    tvZoom: 100,
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
    tvZoom: session.tvZoom,
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

// Remove a player from the session
function removePlayer(session: ServerGameSession, playerId: string, reason = 'timeout') {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) return;

  const wasGameMaster = player.isGameMaster;

  // Get the player's socket ID before removing them
  const playerSocketId = session.playerSockets.get(playerId);

  // Remove player from the session
  session.players = session.players.filter((p) => p.id !== playerId);
  session.playerSockets.delete(playerId);
  session.playerLastPing.delete(playerId);

  // Remove device mapping
  if (player.deviceId) {
    session.deviceToPlayer.delete(player.deviceId);
  }

  console.log(`Player ${player.name} removed from session ${session.id} (${reason})`);

  // Notify the removed player
  if (playerSocketId) {
    const messages: Record<string, string> = {
      timeout: 'You were disconnected due to inactivity.',
      duplicate: 'This device connected from another browser/tab.',
      kicked: 'You have been removed from the session.',
    };

    io.to(playerSocketId).emit('player:removed', {
      reason,
      message: messages[reason] || 'You have been removed from the session.',
    });
  }

  // If Game Master was removed, assign to the next player in the list
  if (wasGameMaster && session.players.length > 0) {
    // Find the first connected player
    const nextGM = session.players.find((p) => p.connected);
    if (nextGM) {
      nextGM.isGameMaster = true;
      console.log(`New Game Master assigned: ${nextGM.name}`);
    }
  }

  // Notify game
  if (session.status === 'playing' && session.currentGameId) {
    const game = games.get(session.currentGameId);
    game?.onPlayerLeave?.(session, io, player);
  }

  broadcastSessionState(session);

  // Check if session should reset to lobby
  checkAndResetIfEmpty(session);
}

// Check if all players are disconnected and reset session to lobby
function checkAndResetIfEmpty(session: ServerGameSession) {
  const hasConnectedPlayers = session.players.some((p) => p.connected);

  if (!hasConnectedPlayers && session.players.length === 0) {
    // No players at all - reset to lobby
    if (session.status === 'playing' && session.currentGameId) {
      // Properly end the game first to clean up timers and resources
      const game = games.get(session.currentGameId);
      if (game?.onEnd) {
        game.onEnd(session, io);
      }

      session.status = 'lobby';
      session.currentGameId = null;
      session.gameState = null;
      session.showQRCode = true;

      console.log(`Session ${session.id} reset to lobby - no players`);

      // Notify TV to reset to QR screen
      if (session.tvSocketId) {
        io.to(session.tvSocketId).emit('session:reset');
      }

      broadcastSessionState(session);
    }
  }
}

// Check for timed out players
function checkPlayerTimeouts(session: ServerGameSession) {
  const now = Date.now();
  const timedOutPlayers: string[] = [];

  session.playerLastPing.forEach((lastPing, playerId) => {
    if (now - lastPing > KEEPALIVE_TIMEOUT) {
      timedOutPlayers.push(playerId);
    }
  });

  timedOutPlayers.forEach((playerId) => {
    removePlayer(session, playerId);
  });

  // After removing timed out players, check if session should reset
  checkAndResetIfEmpty(session);
}

io.on('connection', (socket: GameSocket) => {
  console.log('Client connected:', socket.id);

  // TV creates a new session
  socket.on('session:create', ({ tvZoom }, callback) => {
    const session = createSession();
    session.tvSocketId = socket.id;
    socketToSession.set(socket.id, { sessionId: session.id, isTV: true });

    // Set initial zoom from localStorage if provided
    if (tvZoom !== undefined) {
      session.tvZoom = Math.max(20, Math.min(200, tvZoom));
    }

    // Join the socket.io room for this session
    socket.join(session.id);

    console.log(`Session created: ${session.id}`);
    callback({ success: true, sessionId: session.id });

    // Send initial state and games list
    socket.emit('session:state', getClientSession(session));
    socket.emit('games:list', getGamesList());
  });

  // TV joins existing session (reconnect)
  socket.on('session:join', ({ sessionId, tvZoom }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found' });
      return;
    }

    session.tvSocketId = socket.id;
    socketToSession.set(socket.id, { sessionId, isTV: true });

    // Update zoom from localStorage if provided (TV reconnect)
    if (tvZoom !== undefined) {
      session.tvZoom = Math.max(20, Math.min(200, tvZoom));
    }

    // Join the socket.io room for this session
    socket.join(sessionId);

    callback({ success: true });
    socket.emit('session:state', getClientSession(session));
    socket.emit('games:list', getGamesList());
  });

  // Player joins session
  socket.on('player:join', ({ sessionId, name, deviceId }, callback) => {
    const session = sessions.get(sessionId.toUpperCase());
    if (!session) {
      callback({ success: false, error: 'Session not found' });
      return;
    }

    // Check for duplicate device connection (only in production)
    if (process.env.NODE_ENV === 'production') {
      const existingPlayerId = session.deviceToPlayer.get(deviceId);
      if (existingPlayerId) {
        const existingPlayer = session.players.find((p) => p.id === existingPlayerId);
        if (existingPlayer) {
          console.log(`Duplicate connection detected for device ${deviceId}, removing old connection for ${existingPlayer.name}`);

          // Disconnect the old socket
          const oldSocketId = session.playerSockets.get(existingPlayerId);
          if (oldSocketId) {
            const oldSocketMapping = socketToSession.get(oldSocketId);
            if (oldSocketMapping) {
              socketToSession.delete(oldSocketId);
            }
            io.to(oldSocketId).disconnectSockets();
          }

          // Remove the old player
          removePlayer(session, existingPlayerId, 'duplicate connection');
        }
      }
    }

    const playerId = uuidv4();
    const isFirstPlayer = session.players.length === 0;

    // If a game is in progress, player joins as inactive (waiting in lobby)
    const isActive = session.status !== 'playing';

    const player: Player = {
      id: playerId,
      name: name.trim().slice(0, 20),
      isGameMaster: isFirstPlayer,
      connected: true,
      deviceId,
      isActive,
    };

    session.players.push(player);
    session.playerSockets.set(playerId, socket.id);
    session.playerLastPing.set(playerId, Date.now());
    session.deviceToPlayer.set(deviceId, playerId);
    socketToSession.set(socket.id, { sessionId: session.id, playerId, isTV: false });

    // Join the socket.io room for this session
    socket.join(session.id);

    console.log(`Player ${player.name} joined session ${session.id} (GM: ${isFirstPlayer}, Active: ${isActive})`);

    callback({ success: true, playerId });

    // Notify all clients
    broadcastSessionState(session);

    // Send games list to the new player
    socket.emit('games:list', getGamesList());

    // Only notify game if player is active
    if (isActive && session.status === 'playing' && session.currentGameId) {
      const game = games.get(session.currentGameId);
      game?.onPlayerJoin?.(session, io, player);
    }
  });

  // Player renames themselves
  socket.on('player:rename', (newName, callback) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV || !mapping.playerId) {
      callback({ success: false, error: 'Not a player' });
      return;
    }

    const session = sessions.get(mapping.sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found' });
      return;
    }

    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player) {
      callback({ success: false, error: 'Player not found' });
      return;
    }

    const trimmedName = newName.trim().slice(0, 20);
    if (!trimmedName) {
      callback({ success: false, error: 'Name cannot be empty' });
      return;
    }

    const oldName = player.name;
    player.name = trimmedName;

    console.log(`Player renamed from "${oldName}" to "${trimmedName}" in session ${session.id}`);

    callback({ success: true });

    // Notify all clients of the updated player list
    broadcastSessionState(session);
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

    // Check minimum players (only count active players)
    const activePlayers = session.players.filter((p) => p.connected && p.isActive).length;
    if (activePlayers < game.minPlayers && process.env.NODE_ENV === 'production') {
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

    // Activate all waiting players when game ends
    session.players.forEach((p) => {
      if (!p.isActive) {
        p.isActive = true;
        console.log(`Player ${p.name} activated and moved to lobby`);
      }
    });

    console.log('Game ended, returning to lobby');
    broadcastSessionState(session);
  });

  // Game action from player
  socket.on('game:action', (action) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV || !mapping.playerId) return;

    const session = sessions.get(mapping.sessionId);
    if (!session || session.status !== 'playing' || !session.currentGameId) return;

    // Only allow active players to send actions
    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player?.isActive) return;

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

  // Set TV zoom level
  socket.on('tv:zoom', (zoom) => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    const player = session.players.find((p) => p.id === mapping.playerId);
    if (!player?.isGameMaster) return;

    // Clamp zoom value between 20 and 200
    session.tvZoom = Math.max(20, Math.min(200, zoom));
    broadcastSessionState(session);
  });

  // Handle keepalive pong response
  socket.on('keepalive:pong', () => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping || mapping.isTV || !mapping.playerId) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    // Update last ping time
    session.playerLastPing.set(mapping.playerId, Date.now());
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const mapping = socketToSession.get(socket.id);
    if (!mapping) return;

    const session = sessions.get(mapping.sessionId);
    if (!session) return;

    if (mapping.isTV) {
      // TV disconnected - remove all players and clean up session
      console.log(`TV disconnected from session ${session.id}, removing all players`);

      // End the game if one is in progress
      if (session.currentGameId && session.status === 'playing') {
        const game = games.get(session.currentGameId);
        game?.onEnd(session, io);
      }

      // Disconnect and remove all players
      const playerIds = Array.from(session.playerSockets.keys());
      playerIds.forEach((playerId) => {
        const playerSocketId = session.playerSockets.get(playerId);
        if (playerSocketId) {
          // Notify the player they're being removed
          io.to(playerSocketId).emit('player:removed', {
            reason: 'tv_disconnected',
            message: 'The TV has disconnected.',
          });

          // Disconnect the socket
          const playerSocket = io.sockets.sockets.get(playerSocketId);
          playerSocket?.disconnect(true);

          // Clean up socket mapping
          socketToSession.delete(playerSocketId);
        }
      });

      // Clear session data
      session.tvSocketId = null;
      session.players = [];
      session.playerSockets.clear();
      session.playerLastPing.clear();
      session.deviceToPlayer.clear();
      session.currentGameId = null;
      session.gameState = null;
      session.status = 'lobby';
      session.showQRCode = true;

      // Delete the session immediately
      sessions.delete(session.id);
      console.log(`Session ${session.id} cleaned up after TV disconnect`);
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

        // Check if session should reset to lobby
        checkAndResetIfEmpty(session);
      }
    }

    socketToSession.delete(socket.id);

    // Clean up empty sessions after a delay (only for player disconnects)
    if (!mapping.isTV) {
      setTimeout(() => {
        const currentSession = sessions.get(mapping.sessionId);
        if (currentSession && currentSession.players.every((p) => !p.connected) && !currentSession.tvSocketId) {
          sessions.delete(mapping.sessionId);
          console.log(`Session ${mapping.sessionId} cleaned up`);
        }
      }, 60000);
    }
  });
});

// Keepalive system: send pings and check for timeouts
setInterval(() => {
  sessions.forEach((session) => {
    // Send ping to all connected players
    session.playerSockets.forEach((socketId, playerId) => {
      io.to(socketId).emit('keepalive:ping');
    });

    // Check for timed out players
    checkPlayerTimeouts(session);
  });
}, KEEPALIVE_INTERVAL);

// API endpoint to get server URL
app.get('/api/server-url', (_req, res) => {
  res.json({ url: SERVER_URL });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

httpServer.listen(PORT as number, '0.0.0.0', () => {
  console.log(`\n🎮 Party Game Server`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: ${SERVER_URL}`);
  console.log(`\n📱 Phones can connect using: ${SERVER_URL}\n`);
});
