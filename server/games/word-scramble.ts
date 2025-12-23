import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { StaticCategoryProvider } from './word-scramble/staticCategoryProvider.js';
import { CountdownTimer, broadcastSessionState as baseBroadcastSessionState } from './utils.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SUBMISSION_TIME_SECONDS = 2000;
const REVEAL_TIME_SECONDS = 5;
const VOTING_TIME_SECONDS = 10;
const CHALLENGE_RESULT_DISPLAY_SECONDS = 3;
const CATEGORIES_PER_GAME = 5;

// New state interfaces
export interface PlayerAnswer {
  playerId: string;
  playerName: string;
  answer: string;
  wasAccepted: boolean;
  pointsEarned: number;
  wasChallenged: boolean;
  challengeVotes?: {
    up: number;
    down: number;
    rejected: boolean;
  };
}

export interface CategoryResult {
  categoryIndex: number;
  letter: string;
  category: string;
  answers: PlayerAnswer[];
}

export interface WordScrambleState {
  // Game configuration
  letters: string[];           // 5 different letters, one per category
  categories: string[];        // 5 categories

  // Timing configuration (sent from server)
  submissionTimeSeconds: number;
  revealTimeSeconds: number;
  votingTimeSeconds: number;

  // Round tracking
  currentCategoryIndex: number; // 0-4
  roundNumber: number;

  // Phase management
  phase: 'submitting' | 'revealing' | 'voting' | 'results';

  // Submission phase
  submissionStartTime: number;
  submissions: Record<string, string>; // playerId -> answer (current category only)

  // Revealing phase
  revealOrder: string[];        // playerIds in reveal order
  currentRevealIndex: number;
  revealStartTime: number;      // For 5s auto-advance

  // Voting phase
  challengedPlayerId: string | null;
  challengedAnswer: string | null;
  votes: Record<string, 'up' | 'down'>;
  votingStartTime: number;
  challengeResult: {
    accepted: boolean;
    upVotes: number;
    downVotes: number;
  } | null;
  rejectedPlayerIds: Set<string>;  // Track rejected answers for current category
  challengedPlayerIds: Set<string>; // Track all challenged players (accepted or rejected)

  // Historical data
  categoryHistory: CategoryResult[];

  // Scoring
  scores: Record<string, number>;
}

// Module-level timer instances
let submissionTimer: CountdownTimer | null = null;
let revealTimer: NodeJS.Timeout | null = null;
let votingTimer: CountdownTimer | null = null;
let challengeResultTimer: NodeJS.Timeout | null = null;

const categoryProvider = new StaticCategoryProvider();

/**
 * Select N unique random letters
 */
function selectRandomLetters(count: number): string[] {
  const shuffled = [...LETTERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Initialize scores for all active players
 */
function initializeScores(session: ServerGameSession): Record<string, number> {
  const scores: Record<string, number> = {};
  session.players.forEach((p) => {
    if (p.isActive) {
      scores[p.id] = 0;
    }
  });
  return scores;
}

/**
 * Clear all timers
 */
function clearAllTimers(): void {
  if (submissionTimer) {
    submissionTimer.stop();
    submissionTimer = null;
  }
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  if (votingTimer) {
    votingTimer.stop();
    votingTimer = null;
  }
  if (challengeResultTimer) {
    clearTimeout(challengeResultTimer);
    challengeResultTimer = null;
  }
}

/**
 * Transition from submitting to revealing phase
 */
function transitionToRevealing(session: ServerGameSession, io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  // Only transition if we're in the submitting phase
  if (state.phase !== 'submitting') {
    console.log(`Ignoring transitionToRevealing - already in phase: ${state.phase}`);
    return;
  }

  // Clear submission timer
  if (submissionTimer) {
    submissionTimer.stop();
    submissionTimer = null;
  }

  // Generate reveal order (shuffle players with submissions)
  const playersWithAnswers = Object.keys(state.submissions).filter(
    (playerId) => state.submissions[playerId]?.trim()
  );
  state.revealOrder = playersWithAnswers.sort(() => Math.random() - 0.5);
  state.currentRevealIndex = 0;
  state.phase = 'revealing';

  // If no one submitted anything, skip directly to next category or results
  if (state.revealOrder.length === 0) {
    console.log('No submissions for this category, skipping reveals');
    // Wait for GM to proceed to next category
    broadcastSessionState(session, io);
    return;
  }

  state.revealStartTime = Date.now();
  session.gameState = state;
  broadcastSessionState(session, io);

  // Start 5s reveal timer
  startRevealTimer(session, io);
}

/**
 * Start the 5-second reveal timer
 */
function startRevealTimer(session: ServerGameSession, io: GameServer): void {
  // Stop any existing timer before creating a new one
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }

  revealTimer = setTimeout(() => {
    advanceToNextReveal(session, io);
  }, REVEAL_TIME_SECONDS * 1000);
}

/**
 * Advance to next reveal or end reveals
 */
function advanceToNextReveal(session: ServerGameSession, io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  // Only advance if we're in the revealing phase
  if (state.phase !== 'revealing') {
    console.log(`Ignoring advanceToNextReveal - already in phase: ${state.phase}`);
    return;
  }

  // Clear current timer
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }

  // Move to next player
  state.currentRevealIndex++;

  if (state.currentRevealIndex < state.revealOrder.length) {
    // More reveals to show
    state.revealStartTime = Date.now();
    session.gameState = state;
    broadcastSessionState(session, io);
    startRevealTimer(session, io);
  } else {
    // All reveals done
    console.log('All reveals complete for this category');
    session.gameState = state;
    broadcastSessionState(session, io);
    // Wait for GM to proceed
  }
}

/**
 * Transition to voting phase
 */
function transitionToVoting(session: ServerGameSession, io: GameServer, challengedPlayerId: string): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  // Stop reveal timer
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }

  state.phase = 'voting';
  state.challengedPlayerId = challengedPlayerId;
  state.challengedAnswer = state.submissions[challengedPlayerId] || '';
  state.votes = {};
  state.votingStartTime = Date.now();

  session.gameState = state;
  broadcastSessionState(session, io);

  // Start 10s voting timer
  startVotingTimer(session, io);
}

/**
 * Start the 10-second voting timer
 */
function startVotingTimer(session: ServerGameSession, io: GameServer): void {
  // Stop any existing timer before creating a new one
  if (votingTimer) {
    votingTimer.stop();
    votingTimer = null;
  }

  votingTimer = new CountdownTimer({
    duration: VOTING_TIME_SECONDS,
    onTick: () => {
      // Could broadcast time remaining if needed
    },
    onComplete: () => {
      resolveVoting(session, io);
    },
  });
  votingTimer.start();
}

/**
 * Resolve voting and return to revealing
 */
function resolveVoting(session: ServerGameSession, io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  // Only resolve if we're in the voting phase
  if (state.phase !== 'voting') {
    console.log(`Ignoring resolveVoting - already in phase: ${state.phase}`);
    return;
  }

  // Stop voting timer
  if (votingTimer) {
    votingTimer.stop();
    votingTimer = null;
  }

  // Count votes
  const voteArray = Object.values(state.votes);
  const upVotes = voteArray.filter((v) => v === 'up').length;
  const downVotes = voteArray.filter((v) => v === 'down').length;
  const totalVotes = voteArray.length;

  const rejected = totalVotes > 0 && downVotes / totalVotes >= 0.5;
  const accepted = !rejected;

  console.log(
    `Voting complete: ${downVotes}/${totalVotes} down votes, answer ${rejected ? 'REJECTED' : 'ACCEPTED'}`
  );

  // Track challenged and rejected players for scoring
  if (state.challengedPlayerId) {
    state.challengedPlayerIds.add(state.challengedPlayerId);
    if (rejected) {
      state.rejectedPlayerIds.add(state.challengedPlayerId);
    }
  }

  // Store challenge result to display for 5 seconds
  state.challengeResult = {
    accepted,
    upVotes,
    downVotes,
  };

  // Keep in voting phase but with results shown
  session.gameState = state;
  broadcastSessionState(session, io);

  // Wait 5 seconds to show results, then advance to next reveal
  challengeResultTimer = setTimeout(() => {
    const currentState = session.gameState as WordScrambleState;
    if (!currentState) return;

    // Clear challenge result and return to revealing phase
    currentState.challengeResult = null;
    currentState.phase = 'revealing';
    currentState.votes = {};
    currentState.challengedPlayerId = null;
    currentState.challengedAnswer = null;

    session.gameState = currentState;

    // Advance to next reveal (this will broadcast state)
    advanceToNextReveal(session, io);
  }, CHALLENGE_RESULT_DISPLAY_SECONDS * 1000);
}

/**
 * Check if all eligible voters have voted
 */
function checkAllVoted(state: WordScrambleState, session: ServerGameSession): boolean {
  const eligibleVoters = session.players.filter(
    (p) => p.isActive && p.id !== state.challengedPlayerId
  );
  const voteCount = Object.keys(state.votes).length;
  return voteCount >= eligibleVoters.length;
}

/**
 * Custom broadcast that converts Sets to arrays for JSON serialization
 */
function broadcastSessionState(session: ServerGameSession, io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (state) {
    // Temporarily convert Sets to arrays directly on the state object
    const rejectedArray = Array.from(state.rejectedPlayerIds);
    const challengedArray = Array.from(state.challengedPlayerIds);

    // Store original Sets
    const originalRejected = state.rejectedPlayerIds;
    const originalChallenged = state.challengedPlayerIds;

    // Replace Sets with arrays for broadcast
    (state as any).rejectedPlayerIds = rejectedArray;
    (state as any).challengedPlayerIds = challengedArray;

    baseBroadcastSessionState(session, io);

    // Restore the Sets
    state.rejectedPlayerIds = originalRejected;
    state.challengedPlayerIds = originalChallenged;
  } else {
    baseBroadcastSessionState(session, io);
  }
}

/**
 * Count words in an answer that start with the required letter
 * @param answer - The player's submitted answer
 * @param letter - The required starting letter
 * @returns Number of valid words
 */
function countValidWords(answer: string, letter: string): number {
  if (!answer?.trim()) return 0;

  // Split by any whitespace
  const words = answer.trim().split(/\s+/);
  const targetLetter = letter.toLowerCase();

  let validCount = 0;

  for (const word of words) {
    if (!word) continue;

    // Find first letter character, ignoring leading punctuation
    let firstLetter: string | null = null;
    for (const char of word) {
      // Check if character is a letter (A-Z, a-z)
      if (/[a-zA-Z]/.test(char)) {
        firstLetter = char;
        break;
      }
    }

    // Count this word if it starts with the required letter
    if (firstLetter && firstLetter.toLowerCase() === targetLetter) {
      validCount++;
    }
  }

  return validCount;
}

/**
 * Calculate scores for completed category and store in history
 */
function completeCategoryAndCalculateScores(session: ServerGameSession, _io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  const categoryIndex = state.currentCategoryIndex;
  const letter = state.letters[categoryIndex];
  const category = state.categories[categoryIndex];

  // Group submissions by normalized answer
  const normalizedAnswers = new Map<string, string[]>(); // normalized -> playerIds[]

  // First pass: Calculate base points for each submission
  const basePoints = new Map<string, number>(); // playerId -> base points

  for (const [playerId, answer] of Object.entries(state.submissions)) {
    if (!answer?.trim()) {
      basePoints.set(playerId, 0);
      continue;
    }

    // Skip if rejected by challenge
    if (state.rejectedPlayerIds.has(playerId)) {
      basePoints.set(playerId, 0);
      continue;
    }

    // Calculate points: 10 per valid word
    const validWordCount = countValidWords(answer, letter);
    const points = validWordCount * 10;
    basePoints.set(playerId, points);

    // Also track normalized answers for duplicate detection
    const normalized = answer.trim().toLowerCase();
    if (!normalizedAnswers.has(normalized)) {
      normalizedAnswers.set(normalized, []);
    }
    normalizedAnswers.get(normalized)!.push(playerId);
  }

  // Second pass: Apply duplicate penalty
  const finalScores = new Map<string, number>(); // playerId -> final points

  for (const [normalized, playerIds] of normalizedAnswers.entries()) {
    if (playerIds.length > 1) {
      // Duplicate detected - all players get 0 points
      for (const playerId of playerIds) {
        finalScores.set(playerId, 0);
      }
    } else {
      // Unique answer - keep base points
      const playerId = playerIds[0];
      finalScores.set(playerId, basePoints.get(playerId) || 0);
    }
  }

  // Build PlayerAnswer results
  const answers: PlayerAnswer[] = [];
  const categoryScores: Record<string, number> = {};

  for (const [playerId, answer] of Object.entries(state.submissions)) {
    const player = session.players.find((p) => p.id === playerId);
    const points = finalScores.get(playerId) ?? 0;
    const hasValidWords = (basePoints.get(playerId) ?? 0) > 0;
    const wasChallenged = state.challengedPlayerIds.has(playerId);
    const wasRejected = state.rejectedPlayerIds.has(playerId);

    answers.push({
      playerId,
      playerName: player?.name || 'Unknown',
      answer: answer,
      wasAccepted: !wasRejected && hasValidWords && points > 0, // Accepted if not rejected, had valid words, and not duplicated
      pointsEarned: points,
      wasChallenged: wasChallenged,
    });

    categoryScores[playerId] = points;
  }

  // Store in history
  const result: CategoryResult = {
    categoryIndex,
    letter,
    category,
    answers,
  };
  state.categoryHistory.push(result);

  // Update total scores
  for (const [playerId, points] of Object.entries(categoryScores)) {
    state.scores[playerId] = (state.scores[playerId] || 0) + points;
  }

  console.log(`Category ${categoryIndex + 1} complete. Scores:`, categoryScores);
}

/**
 * Move to next category or results
 */
function proceedToNextCategory(session: ServerGameSession, io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  // Calculate scores for current category
  completeCategoryAndCalculateScores(session, io);

  // Increment category index
  state.currentCategoryIndex++;

  if (state.currentCategoryIndex < CATEGORIES_PER_GAME) {
    // Start next category
    state.phase = 'submitting';
    state.submissionStartTime = Date.now();
    state.submissions = {};
    state.revealOrder = [];
    state.currentRevealIndex = -1;
    state.rejectedPlayerIds = new Set(); // Clear rejected players for new category
    state.challengedPlayerIds = new Set(); // Clear challenged players for new category

    session.gameState = state;
    broadcastSessionState(session, io);

    // Start submission timer
    startSubmissionTimer(session, io);
  } else {
    // All categories done - show results
    state.phase = 'results';
    session.gameState = state;
    broadcastSessionState(session, io);
  }
}

/**
 * Start the 20-second submission timer
 */
function startSubmissionTimer(session: ServerGameSession, io: GameServer): void {
  // Stop any existing timer before creating a new one
  if (submissionTimer) {
    submissionTimer.stop();
    submissionTimer = null;
  }

  submissionTimer = new CountdownTimer({
    duration: SUBMISSION_TIME_SECONDS,
    onTick: () => {
      // Could broadcast time remaining if needed
    },
    onComplete: () => {
      transitionToRevealing(session, io);
    },
  });
  submissionTimer.start();
}

/**
 * Check if all active players have submitted
 */
function checkAllSubmitted(state: WordScrambleState, session: ServerGameSession): boolean {
  const activePlayers = session.players.filter((p) => p.isActive);
  const submissionCount = Object.keys(state.submissions).length;
  return submissionCount >= activePlayers.length;
}

export const wordScrambleGame: GameHandler = {
  id: 'word-scramble',
  name: 'Word Scramble',
  description: 'Think fast! Name things in categories starting with a specific letter.',
  minPlayers: 2,
  maxPlayers: 10,

  onStart(session, io) {
    // Clear any existing timers
    clearAllTimers();

    // Select 5 different letters and categories
    const letters = selectRandomLetters(CATEGORIES_PER_GAME);
    const categories = categoryProvider.getCategories(CATEGORIES_PER_GAME);

    const state: WordScrambleState = {
      letters: letters,
      categories: categories,
      submissionTimeSeconds: SUBMISSION_TIME_SECONDS,
      revealTimeSeconds: REVEAL_TIME_SECONDS,
      votingTimeSeconds: VOTING_TIME_SECONDS,
      currentCategoryIndex: 0,
      roundNumber: 1,
      phase: 'submitting',
      submissionStartTime: Date.now(),
      submissions: {},
      revealOrder: [],
      currentRevealIndex: -1,
      revealStartTime: 0,
      challengedPlayerId: null,
      challengedAnswer: null,
      votes: {},
      votingStartTime: 0,
      challengeResult: null,
      rejectedPlayerIds: new Set(),
      challengedPlayerIds: new Set(),
      categoryHistory: [],
      scores: initializeScores(session),
    };

    session.gameState = state;
    console.log(
      `Word Scramble started! Category 1: ${categories[0]} (${letters[0]})`
    );

    // Broadcast initial state to all clients
    broadcastSessionState(session, io);

    // Start 20-second submission timer
    startSubmissionTimer(session, io);
    console.log('Started 20s submission timer');
  },

  onEnd(session, _io) {
    console.log('Word Scramble ended');
    clearAllTimers();
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    const state = session.gameState as WordScrambleState;
    if (!state) return;

    const player = session.players.find((p) => p.id === playerId);
    if (!player) return;

    switch (action.type) {
      case 'submit-answer': {
        if (state.phase !== 'submitting') return;

        const payload = action.payload as { answer: string };
        if (typeof payload?.answer !== 'string') return;

        // Store the answer
        state.submissions[playerId] = payload.answer;
        console.log(
          `Player ${player.name} submitted: "${payload.answer}" for category ${state.currentCategoryIndex + 1}`
        );

        session.gameState = state;
        broadcastSessionState(session, io);

        // Check if all players submitted
        if (checkAllSubmitted(state, session)) {
          console.log('All players submitted, transitioning to revealing');
          transitionToRevealing(session, io);
        }
        break;
      }

      case 'submission-complete': {
        // GM can force end submission early
        if (!player.isGameMaster || state.phase !== 'submitting') return;

        console.log('GM ended submission early');
        transitionToRevealing(session, io);
        break;
      }

      case 'reroll-letter': {
        // GM can reroll the letter during submission phase
        if (!player.isGameMaster || state.phase !== 'submitting') return;

        console.log('GM rerolling letter');

        // Clear submission timer
        if (submissionTimer) {
          submissionTimer.stop();
          submissionTimer = null;
        }

        // Generate a new random letter (excluding the current one)
        const currentLetter = state.letters[state.currentCategoryIndex];
        const availableLetters = LETTERS.filter(l => l !== currentLetter);
        const newLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)];

        // Update the letter for current category
        state.letters[state.currentCategoryIndex] = newLetter;

        // Clear all submissions
        state.submissions = {};

        // Reset submission start time
        state.submissionStartTime = Date.now();

        session.gameState = state;
        broadcastSessionState(session, io);

        // Restart submission timer
        startSubmissionTimer(session, io);

        console.log(`Letter rerolled from ${currentLetter} to ${newLetter}`);
        break;
      }

      case 'challenge-answer': {
        if (state.phase !== 'revealing') return;
        if (state.currentRevealIndex < 0 || state.currentRevealIndex >= state.revealOrder.length) return;

        const challengedPlayerId = state.revealOrder[state.currentRevealIndex];

        // Can't challenge your own answer
        if (playerId === challengedPlayerId) return;

        console.log(`Player ${player.name} challenged ${challengedPlayerId}'s answer`);
        transitionToVoting(session, io, challengedPlayerId);
        break;
      }

      case 'vote': {
        if (state.phase !== 'voting') return;
        if (playerId === state.challengedPlayerId) return; // Can't vote on own answer

        const payload = action.payload as { vote: 'up' | 'down' };
        if (payload?.vote !== 'up' && payload?.vote !== 'down') return;

        state.votes[playerId] = payload.vote;
        console.log(`Player ${player.name} voted: ${payload.vote}`);

        session.gameState = state;
        broadcastSessionState(session, io);

        // Check if all eligible players voted
        if (checkAllVoted(state, session)) {
          console.log('All eligible players voted, resolving vote');
          resolveVoting(session, io);
        }
        break;
      }

      case 'next-reveal': {
        // GM can manually advance to next reveal
        if (!player.isGameMaster || state.phase !== 'revealing') return;

        console.log('GM manually advanced to next reveal');
        advanceToNextReveal(session, io);
        break;
      }

      case 'next-category': {
        // GM proceeds to next category (after all reveals done)
        if (!player.isGameMaster || state.phase !== 'revealing') return;
        if (state.currentRevealIndex < state.revealOrder.length && state.revealOrder.length > 0) return;

        console.log('GM proceeding to next category');
        proceedToNextCategory(session, io);
        break;
      }

      case 'show-results': {
        // GM shows final results (after final category)
        if (!player.isGameMaster || state.phase !== 'revealing') return;
        if (state.currentRevealIndex < state.revealOrder.length && state.revealOrder.length > 0) return;

        console.log('GM showing final results');
        completeCategoryAndCalculateScores(session, io);
        state.phase = 'results';
        session.gameState = state;
        broadcastSessionState(session, io);
        break;
      }

      case 'next-round': {
        // Start a new round (reset everything)
        if (!player.isGameMaster || state.phase !== 'results') return;

        console.log('Starting new round');
        clearAllTimers();

        const letters = selectRandomLetters(CATEGORIES_PER_GAME);
        const categories = categoryProvider.getCategories(CATEGORIES_PER_GAME);

        state.letters = letters;
        state.categories = categories;
        state.currentCategoryIndex = 0;
        state.roundNumber++;
        state.phase = 'submitting';
        state.submissionStartTime = Date.now();
        state.submissions = {};
        state.revealOrder = [];
        state.currentRevealIndex = -1;
        state.rejectedPlayerIds = new Set();
        state.challengedPlayerIds = new Set();
        state.categoryHistory = [];
        // Keep scores from previous round

        session.gameState = state;
        broadcastSessionState(session, io);

        startSubmissionTimer(session, io);
        break;
      }
    }
  },

  onPlayerJoin(session, _io, player) {
    const state = session.gameState as WordScrambleState;
    if (state && player.isActive) {
      // Initialize score for new player
      state.scores[player.id] = 0;
    }
  },

  onPlayerLeave(_session, _io, _player) {
    // No special handling needed
  },
};
