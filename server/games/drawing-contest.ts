import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { broadcastSessionState } from './utils.js';

export interface DrawingContestState {
  // TODO: Define your game state here
  // Example:
  // currentPlayerId: string | null;
  // scores: Record<string, number>;
  // roundNumber: number;
}

function initializeScores(session: ServerGameSession): Record<string, number> {
  const scores: Record<string, number> = {};
  session.players.forEach((p) => {
    if (p.isActive) {
      scores[p.id] = 0;
    }
  });
  return scores;
}

export const drawingContestGame: GameHandler = {
  id: 'drawing-contest',
  name: 'Drawing Contest',
  description: 'Draw a picture and let the AI judge decide the winner',
  minPlayers: 2,
  maxPlayers: 8,

  onStart(session, _io) {
    const state: DrawingContestState = {
      // TODO: Initialize your game state
      // Example:
      // currentPlayerId: null,
      // scores: initializeScores(session),
      // roundNumber: 1,
    };
    session.gameState = state;
    console.log(`Drawing Contest started!`);
  },

  onEnd(session, _io) {
    console.log('Drawing Contest ended');
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    const state = session.gameState as DrawingContestState;
    if (!state) return;

    // TODO: Handle game actions
    // Example:
    // if (action.type === 'your-action') {
    //   // Update state based on action
    //   session.gameState = state;
    //
    //   // Broadcast the updated state to all clients
    //   broadcastSessionState(session, io);
    // }

    console.log(`Action received from player ${playerId}:`, action);
  },

  onPlayerJoin(session, _io, player) {
    const state = session.gameState as DrawingContestState;
    if (state && player.isActive) {
      // TODO: Handle player joining during game
      // Example: Initialize score for new player
      // state.scores[player.id] = 0;
    }
  },

  onPlayerLeave(session, _io, player) {
    const state = session.gameState as DrawingContestState;
    if (!state) return;

    // TODO: Handle player leaving during game
    // Example: Select new current player if the leaving player was active
  },
};
