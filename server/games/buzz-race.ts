import type { GameHandler, ServerGameSession, GameServer } from '../types.js';

export interface BuzzRaceState {
  currentPlayerId: string | null;
  scores: Record<string, number>;
  roundNumber: number;
  lastBuzzResult: { playerId: string; correct: boolean; playerName: string } | null;
}

function selectRandomPlayer(session: ServerGameSession): string | null {
  const activePlayers = session.players.filter((p) => p.connected && p.isActive);
  if (activePlayers.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * activePlayers.length);
  return activePlayers[randomIndex].id;
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

export const buzzRaceGame: GameHandler = {
  id: 'buzz-race',
  name: 'Buzz Race',
  description: 'Be quick! Buzz when your name appears on screen!',
  minPlayers: 2,
  maxPlayers: 20,

  onStart(session, _io) {
    const state: BuzzRaceState = {
      currentPlayerId: selectRandomPlayer(session),
      scores: initializeScores(session),
      roundNumber: 1,
      lastBuzzResult: null,
    };
    session.gameState = state;
    console.log(`Buzz Race started! First player: ${session.players.find((p) => p.id === state.currentPlayerId)?.name}`);
  },

  onEnd(session, _io) {
    console.log('Buzz Race ended');
    session.gameState = null;
  },

  onAction(session, _io, playerId, action) {
    if (action.type !== 'buzz') return;

    const state = session.gameState as BuzzRaceState;
    if (!state || !state.currentPlayerId) return;

    const buzzingPlayer = session.players.find((p) => p.id === playerId);
    if (!buzzingPlayer) return;

    const isCorrect = playerId === state.currentPlayerId;

    if (isCorrect) {
      // Correct buzz - add point and select new player
      state.scores[playerId] = (state.scores[playerId] || 0) + 1;
      state.lastBuzzResult = { playerId, correct: true, playerName: buzzingPlayer.name };
      state.roundNumber++;
      state.currentPlayerId = selectRandomPlayer(session);
      console.log(`${buzzingPlayer.name} buzzed correctly! +1 point. New round: ${state.roundNumber}`);
    } else {
      // Wrong buzz - subtract point
      state.scores[playerId] = (state.scores[playerId] || 0) - 1;
      state.lastBuzzResult = { playerId, correct: false, playerName: buzzingPlayer.name };
      console.log(`${buzzingPlayer.name} buzzed incorrectly! -1 point.`);
    }

    session.gameState = state;
  },

  onPlayerJoin(session, _io, player) {
    const state = session.gameState as BuzzRaceState;
    if (state && player.isActive) {
      // Initialize score for new player (only if active)
      state.scores[player.id] = 0;
    }
  },

  onPlayerLeave(session, _io, player) {
    const state = session.gameState as BuzzRaceState;
    if (!state) return;

    // If the current player left, select a new one
    if (state.currentPlayerId === player.id) {
      state.currentPlayerId = selectRandomPlayer(session);
      state.roundNumber++;
    }
  },
};
