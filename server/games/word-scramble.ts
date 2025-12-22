import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { TestCategoryProvider } from './word-scramble/testCategoryProvider.js';
import { CountdownTimer, broadcastSessionState } from './utils.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SUBMISSION_TIME_SECONDS = 20;
const REVEAL_TIME_SECONDS = 5;
const VOTING_TIME_SECONDS = 10;
const CHALLENGE_RESULT_DISPLAY_SECONDS = 5;
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

const categoryProvider = new TestCategoryProvider();

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
  if (revealTimer) {
    clearTimeout(revealTimer);
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
  if (!state || state.phase !== 'revealing') return;

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
  if (!state || state.phase !== 'voting') return;

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
 * Calculate scores for completed category and store in history
 */
function completeCategoryAndCalculateScores(session: ServerGameSession, _io: GameServer): void {
  const state = session.gameState as WordScrambleState;
  if (!state) return;

  const categoryIndex = state.currentCategoryIndex;
  const letter = state.letters[categoryIndex];
  const category = state.categories[categoryIndex];

  // Track which answers were rejected by challenges
  // For now, we'll need to implement challenge tracking properly
  // This is a simplified version - we'll enhance it
  const challengeResults: Record<string, boolean> = {}; // playerId -> wasRejected

  // Group submissions by normalized answer
  const normalizedAnswers = new Map<string, string[]>(); // normalized -> playerIds[]

  for (const [playerId, answer] of Object.entries(state.submissions)) {
    if (!answer?.trim()) continue;

    // Skip if rejected by challenge
    if (challengeResults[playerId]) continue;

    const normalized = answer.trim().toLowerCase();

    // Validate starts with letter
    if (!normalized.startsWith(letter.toLowerCase())) {
      // Invalid letter - 0 points
      continue;
    }

    if (!normalizedAnswers.has(normalized)) {
      normalizedAnswers.set(normalized, []);
    }
    normalizedAnswers.get(normalized)!.push(playerId);
  }

  // Build PlayerAnswer results
  const answers: PlayerAnswer[] = [];
  const categoryScores: Record<string, number> = {};

  // Award points
  for (const playerIds of Array.from(normalizedAnswers.values())) {
    const points = playerIds.length === 1 ? 1 : 0;
    for (const playerId of playerIds) {
      const player = session.players.find((p) => p.id === playerId);
      answers.push({
        playerId,
        playerName: player?.name || 'Unknown',
        answer: state.submissions[playerId],
        wasAccepted: true,
        pointsEarned: points,
        wasChallenged: false,
      });
      categoryScores[playerId] = points;
    }
  }

  // Add 0-point entries for invalid/empty answers
  for (const [playerId, answer] of Object.entries(state.submissions)) {
    if (!categoryScores[playerId]) {
      const player = session.players.find((p) => p.id === playerId);
      answers.push({
        playerId,
        playerName: player?.name || 'Unknown',
        answer,
        wasAccepted: false,
        pointsEarned: 0,
        wasChallenged: false,
      });
    }
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
