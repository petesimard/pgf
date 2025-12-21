import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { TestCategoryProvider } from './word-scramble/testCategoryProvider.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROUND_TIME_SECONDS = 90;
const CATEGORIES_PER_ROUND = 5;

export interface WordScrambleState {
  letter: string;
  categories: string[];
  roundNumber: number;
  phase: 'playing' | 'reviewing' | 'results';
  startTime: number;
  playerAnswers: Record<string, Record<number, string>>; // playerId -> categoryIndex -> answer
  scores: Record<string, number>;
  roundScores: Record<string, number>; // Points earned this round
}

function getRandomLetter(): string {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
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

function calculateRoundScores(state: WordScrambleState, session: ServerGameSession): void {
  // Reset round scores
  state.roundScores = {};

  // For each category, check which answers are unique
  for (let categoryIdx = 0; categoryIdx < state.categories.length; categoryIdx++) {
    const answersForCategory = new Map<string, string[]>(); // normalized answer -> playerIds[]

    // Collect all answers for this category
    for (const [playerId, answers] of Object.entries(state.playerAnswers)) {
      const answer = answers[categoryIdx];
      if (answer && answer.trim()) {
        const normalized = answer.trim().toLowerCase();

        // Validate answer starts with the correct letter
        if (normalized.startsWith(state.letter.toLowerCase())) {
          if (!answersForCategory.has(normalized)) {
            answersForCategory.set(normalized, []);
          }
          answersForCategory.get(normalized)!.push(playerId);
        }
      }
    }

    // Award points: 1 point for unique answers, 0 for duplicates or invalid
    for (const [answer, playerIds] of answersForCategory) {
      const points = playerIds.length === 1 ? 1 : 0;
      for (const playerId of playerIds) {
        state.roundScores[playerId] = (state.roundScores[playerId] || 0) + points;
      }
    }
  }

  // Add round scores to total scores
  for (const [playerId, points] of Object.entries(state.roundScores)) {
    state.scores[playerId] = (state.scores[playerId] || 0) + points;
  }
}

const categoryProvider = new TestCategoryProvider();

export const wordScrambleGame: GameHandler = {
  id: 'word-scramble',
  name: 'Word Scramble',
  description: 'Think fast! Name things in categories starting with a specific letter.',
  minPlayers: 2,
  maxPlayers: 10,

  onStart(session, _io) {
    const state: WordScrambleState = {
      letter: getRandomLetter(),
      categories: categoryProvider.getCategories(CATEGORIES_PER_ROUND),
      roundNumber: 1,
      phase: 'playing',
      startTime: Date.now(),
      playerAnswers: {},
      scores: initializeScores(session),
      roundScores: {},
    };

    // Initialize empty answer sets for all active players
    session.players.forEach((p) => {
      if (p.isActive) {
        state.playerAnswers[p.id] = {};
      }
    });

    session.gameState = state;
    console.log(`Word Scramble started! Letter: ${state.letter}, Categories: ${state.categories.join(', ')}`);
  },

  onEnd(session, _io) {
    console.log('Word Scramble ended');
    session.gameState = null;
  },

  onAction(session, _io, playerId, action) {
    const state = session.gameState as WordScrambleState;
    if (!state) return;

    switch (action.type) {
      case 'submit-answer': {
        if (state.phase !== 'playing') return;

        const payload = action.payload as { categoryIndex: number; answer: string };
        if (typeof payload?.categoryIndex !== 'number' || typeof payload?.answer !== 'string') return;

        // Initialize player answers if needed
        if (!state.playerAnswers[playerId]) {
          state.playerAnswers[playerId] = {};
        }

        // Store the answer
        state.playerAnswers[playerId][payload.categoryIndex] = payload.answer;
        console.log(`Player ${playerId} submitted answer for category ${payload.categoryIndex}: ${payload.answer}`);
        break;
      }

      case 'time-up': {
        // Only game master can trigger time up
        const player = session.players.find((p) => p.id === playerId);
        if (!player || !player.isGameMaster || state.phase !== 'playing') return;

        state.phase = 'reviewing';
        calculateRoundScores(state, session);
        console.log('Time is up! Moving to review phase.');
        break;
      }

      case 'next-round': {
        // Only game master can start next round
        const player = session.players.find((p) => p.id === playerId);
        if (!player || !player.isGameMaster) return;

        // Start a new round
        state.letter = getRandomLetter();
        state.categories = categoryProvider.getCategories(CATEGORIES_PER_ROUND);
        state.roundNumber++;
        state.phase = 'playing';
        state.startTime = Date.now();
        state.playerAnswers = {};
        state.roundScores = {};

        // Initialize empty answer sets for all active players
        session.players.forEach((p) => {
          if (p.isActive) {
            state.playerAnswers[p.id] = {};
          }
        });

        console.log(`Starting round ${state.roundNumber}! Letter: ${state.letter}`);
        break;
      }

      case 'show-results': {
        // Only game master can show results
        const player = session.players.find((p) => p.id === playerId);
        if (!player || !player.isGameMaster || state.phase !== 'reviewing') return;

        state.phase = 'results';
        console.log('Showing final results.');
        break;
      }
    }

    session.gameState = state;
  },

  onPlayerJoin(session, _io, player) {
    const state = session.gameState as WordScrambleState;
    if (state && player.isActive) {
      // Initialize score and answers for new player
      state.scores[player.id] = 0;
      state.playerAnswers[player.id] = {};
    }
  },

  onPlayerLeave(_session, _io, _player) {
    // No special handling needed for player leaving
  },
};
