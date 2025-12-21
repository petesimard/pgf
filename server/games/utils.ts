/**
 * Shared utilities for game handlers.
 *
 * This module provides common helper functions that all games can use
 * to ensure consistent behavior and avoid code duplication.
 */

import type { ServerGameSession, GameServer } from '../types.js';

/**
 * Helper function to broadcast session state consistently from within game handlers.
 * Ensures all required fields are included to match GameSession interface.
 *
 * Games should call this after updating session.gameState to notify all clients
 * (both TV and phone clients) of the state change.
 *
 * @example
 * ```typescript
 * onAction(session, io, playerId, action) {
 *   const state = session.gameState as MyGameState;
 *   if (action.type === 'submit-answer') {
 *     state.answers[playerId] = action.payload;
 *     session.gameState = state;
 *
 *     // Notify all clients of the state update
 *     broadcastSessionState(session, io);
 *   }
 * }
 * ```
 *
 * @param session - The server game session to broadcast
 * @param io - The Socket.IO server instance
 */
export function broadcastSessionState(session: ServerGameSession, io: GameServer): void {
  // Deep clone gameState to avoid mutating the original
  let gameStateToSend = session.gameState;

  const stateToSend = {
    id: session.id,
    players: session.players,
    currentGameId: session.currentGameId,
    gameState: gameStateToSend,
    status: session.status,
  };

  io.to(session.id).emit('session:state', stateToSend);
}
