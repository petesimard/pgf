import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, GameSession, GameDefinition } from '../types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const DEVICE_ID_KEY = 'deviceId';
const TV_ZOOM_KEY = 'tvZoom';

// Get or create a unique device identifier
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// Get saved TV zoom or default to 100
function getSavedTVZoom(): number {
  const saved = localStorage.getItem(TV_ZOOM_KEY);
  if (saved) {
    const zoom = parseInt(saved, 10);
    if (!isNaN(zoom) && zoom >= 20 && zoom <= 200) {
      return zoom;
    }
  }
  return 100;
}

interface UseSocketReturn {
  socket: GameSocket | null;
  connected: boolean;
  session: GameSession | null;
  games: GameDefinition[];
  playerId: string | null;
  error: string | null;
  wasRemoved: boolean;
  removalReason: string | null;
  wasReset: boolean;
  createSession: () => Promise<string>;
  joinSession: (sessionId: string, name: string) => Promise<string>;
  renamePlayer: (newName: string) => Promise<void>;
  selectGame: (gameId: string) => void;
  startGame: () => void;
  endGame: () => void;
  sendAction: (action: { type: string; payload?: unknown }) => void;
  toggleQR: (show: boolean) => void;
  setTVZoom: (zoom: number) => void;
  clearReset: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasRemoved, setWasRemoved] = useState(false);
  const [removalReason, setRemovalReason] = useState<string | null>(null);
  const [wasReset, setWasReset] = useState(false);

  useEffect(() => {
    // Always use window.location.origin to ensure phones can connect
    // In dev mode, Vite proxy will forward /socket.io to the backend
    const socket: GameSocket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('session:state', (newSession) => {
      console.log('[useSocket] Received session:state:', {
        currentGameId: newSession.currentGameId,
        gameState: newSession.gameState,
      });
      setSession(newSession);

      // Save TV zoom to localStorage whenever it changes (for TV clients)
      if (newSession.tvZoom !== undefined) {
        localStorage.setItem(TV_ZOOM_KEY, newSession.tvZoom.toString());
      }
    });

    socket.on('session:error', (errorMsg) => {
      setError(errorMsg);
    });

    socket.on('games:list', (gamesList) => {
      setGames(gamesList);
    });

    socket.on('keepalive:ping', () => {
      socket.emit('keepalive:pong');
    });

    socket.on('player:removed', (data) => {
      console.log('[useSocket] Player removed:', data);
      setWasRemoved(true);
      setRemovalReason(data.message);
      setSession(null);
      setPlayerId(null);
    });

    socket.on('session:reset', () => {
      console.log('[useSocket] Session reset to lobby');
      setWasReset(true);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createSession = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Not connected'));
        return;
      }

      const tvZoom = getSavedTVZoom();
      socketRef.current.emit('session:create', { tvZoom }, (response) => {
        if (response.success && response.sessionId) {
          resolve(response.sessionId);
        } else {
          reject(new Error(response.error || 'Failed to create session'));
        }
      });
    });
  }, []);

  const joinSession = useCallback((sessionId: string, name: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Not connected'));
        return;
      }

      const deviceId = getDeviceId();
      socketRef.current.emit('player:join', { sessionId, name, deviceId }, (response) => {
        if (response.success && response.playerId) {
          setPlayerId(response.playerId);
          resolve(response.playerId);
        } else {
          reject(new Error(response.error || 'Failed to join session'));
        }
      });
    });
  }, []);

  const renamePlayer = useCallback((newName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Not connected'));
        return;
      }

      socketRef.current.emit('player:rename', newName, (response) => {
        if (response.success) {
          // Update localStorage with new name
          localStorage.setItem('playerName', newName);
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to rename player'));
        }
      });
    });
  }, []);

  const selectGame = useCallback((gameId: string) => {
    socketRef.current?.emit('game:select', gameId);
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('game:start');
  }, []);

  const endGame = useCallback(() => {
    socketRef.current?.emit('game:end');
  }, []);

  const sendAction = useCallback((action: { type: string; payload?: unknown }) => {
    socketRef.current?.emit('game:action', action);
  }, []);

  const toggleQR = useCallback((show: boolean) => {
    socketRef.current?.emit('qr:toggle', show);
  }, []);

  const setTVZoom = useCallback((zoom: number) => {
    // Save to localStorage for TV clients
    localStorage.setItem(TV_ZOOM_KEY, zoom.toString());
    socketRef.current?.emit('tv:zoom', zoom);
  }, []);

  const clearReset = useCallback(() => {
    setWasReset(false);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    session,
    games,
    playerId,
    error,
    wasRemoved,
    removalReason,
    wasReset,
    createSession,
    joinSession,
    renamePlayer,
    selectGame,
    startGame,
    endGame,
    sendAction,
    toggleQR,
    setTVZoom,
    clearReset,
  };
}
