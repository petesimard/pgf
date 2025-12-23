import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { broadcastSessionState, CountdownTimer } from './utils.js';
import { StaticDrawingWordProvider, type DrawingWordProvider } from './drawing-word-providers.js';
import OpenAI from 'openai';
import sharp from 'sharp';
import { z } from 'zod';
import fs from 'fs';

export interface PlayerDrawing {
  playerId: string;
  playerName: string;
  imageData: string; // base64 encoded PNG
  submitted: boolean;
}

export interface JudgingResult {
  rank: number;
  playerId: string;
  playerName: string;
  reason: string;
}

export interface AIDrawingState {
  word: string;
  timeRemaining: number; // seconds
  drawings: Record<string, PlayerDrawing>; // playerId -> drawing
  phase: 'drawing' | 'judging' | 'results';
  results: JudgingResult[] | null;
  collageUrl: string | null;
  currentResultIndex: number; // -1 means none revealed yet
}

const DRAWING_TIME = 60; // seconds

// Word provider instance
const wordProvider: DrawingWordProvider = new StaticDrawingWordProvider();

// Store used words per session to prevent repetition
// Key: sessionId, Value: Set of used words
const sessionUsedWords = new Map<string, Set<string>>();

function selectRandomWord(sessionId: string): string | null {
  // Get or create the set of used words for this session
  if (!sessionUsedWords.has(sessionId)) {
    sessionUsedWords.set(sessionId, new Set());
  }

  const usedWords = sessionUsedWords.get(sessionId)!;
  const word = wordProvider.getWord(usedWords);

  if (word) {
    usedWords.add(word);
  }

  return word;
}

function initializeDrawings(session: ServerGameSession): Record<string, PlayerDrawing> {
  const drawings: Record<string, PlayerDrawing> = {};
  session.players.forEach((player) => {
    if (player.isActive && player.connected) {
      drawings[player.id] = {
        playerId: player.id,
        playerName: player.name,
        imageData: '',
        submitted: false,
      };
    }
  });
  return drawings;
}

async function createCollage(drawings: PlayerDrawing[]): Promise<Buffer> {
  const CANVAS_SIZE = 400;
  const LABEL_HEIGHT = 60;
  const COLS = Math.ceil(Math.sqrt(drawings.length));
  const ROWS = Math.ceil(drawings.length / COLS);

  const collageWidth = COLS * CANVAS_SIZE;
  const collageHeight = ROWS * (CANVAS_SIZE + LABEL_HEIGHT);

  // Create base canvas
  const canvas = sharp({
    create: {
      width: collageWidth,
      height: collageHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  const composites: Array<{ input: Buffer; top: number; left: number }> = [];

  for (let i = 0; i < drawings.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const label = String.fromCharCode(65 + i); // A, B, C, etc.

    // Convert base64 to buffer
    const base64Data = drawings[i].imageData.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Resize drawing to fit (leaving room for 1px border on each side)
    const resizedImage = await sharp(imageBuffer)
      .resize(CANVAS_SIZE - 2, CANVAS_SIZE - 2, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .extend({
        top: 1,
        bottom: 1,
        left: 1,
        right: 1,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .toBuffer();

    composites.push({
      input: resizedImage,
      top: row * (CANVAS_SIZE + LABEL_HEIGHT),
      left: col * CANVAS_SIZE,
    });

    // Create label
    const labelSvg = `
      <svg width="${CANVAS_SIZE}" height="${LABEL_HEIGHT}">
        <rect width="${CANVAS_SIZE}" height="${LABEL_HEIGHT}" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="32" font-weight="bold"
              text-anchor="middle" dominant-baseline="middle" fill="#333">
          ${label}
        </text>
      </svg>
    `;

    const labelBuffer = Buffer.from(labelSvg);
    composites.push({
      input: labelBuffer,
      top: row * (CANVAS_SIZE + LABEL_HEIGHT) + CANVAS_SIZE,
      left: col * CANVAS_SIZE,
    });
  }

  const pngBuffer = await canvas.composite(composites).png().toBuffer();

  // Save to file for debugging
  //fs.writeFileSync('collage.png', pngBuffer);

  return pngBuffer;
}

async function judgeDrawings(word: string, drawings: PlayerDrawing[]): Promise<JudgingResult[]> {
  console.log('=== judgeDrawings called ===');
  console.log('API Key present:', !!process.env.OPENAI_API_KEY);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('Creating collage...');
  // Create collage
  const collageBuffer = await createCollage(drawings);
  console.log('Collage created, size:', collageBuffer.length, 'bytes');
  const collageBase64 = collageBuffer.toString('base64');
  console.log('Collage converted to base64, length:', collageBase64.length);

  // Create mapping of labels to players
  const labelMap = drawings.map((d, i) => ({
    label: String.fromCharCode(65 + i),
    playerId: d.playerId,
    playerName: d.playerName,
  }));

  const prompt = `You are judging a drawing competition. The word to draw was: "${word}".
The image shows drawings labeled A, B, C, etc. Each drawing was created by a different player.
Rank ALL drawings from best to worst based on:
1. How well it represents "${word}"
2. Creativity and artistic quality
3. Clarity and recognizability

For each drawing, provide a single sentence explaining your ranking.

Players: ${labelMap.map((m) => `${m.label}: ${m.playerName}`).join(', ')}`;

  const RankingSchema = z.object({
    rankings: z.array(
      z.object({
        label: z.string(),
        rank: z.number(),
        reason: z.string(),
      })
    ),
  });

  console.log('Calling OpenAI API...');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${collageBase64}`,
            },
          },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'drawing_rankings',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            rankings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  rank: { type: 'number' },
                  reason: { type: 'string' },
                },
                required: ['label', 'rank', 'reason'],
                additionalProperties: false,
              },
            },
          },
          required: ['rankings'],
          additionalProperties: false,
        },
      },
    },
  });

  console.log('OpenAI API call completed');
  const content = completion.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI');

  console.log('OpenAI response:', content);

  const parsed = RankingSchema.parse(JSON.parse(content));

  // Convert to our result format
  return parsed.rankings.map((r) => {
    const player = labelMap.find((m) => m.label === r.label);
    return {
      rank: r.rank,
      playerId: player!.playerId,
      playerName: player!.playerName,
      reason: r.reason,
    };
  });
}

let countdown: CountdownTimer | null = null;
let resultRevealInterval: NodeJS.Timeout | null = null;

// Store full drawings (with imageData) separately from session state
// Key: sessionId, Value: Record<playerId, PlayerDrawing>
const drawingsStorage = new Map<string, Record<string, PlayerDrawing>>();

export const aiDrawingGame: GameHandler = {
  id: 'ai-drawing',
  name: 'AI Drawing Contest',
  description: 'Draw a word and let AI judge your masterpiece!',
  minPlayers: 2,
  maxPlayers: 8,

  onStart(session, io) {
    const drawings = initializeDrawings(session);

    const word = selectRandomWord(session.id);
    if (!word) {
      console.error('No words available for drawing!');
      // Fallback to a default word if we run out
      const state: AIDrawingState = {
        word: 'Cat',
        timeRemaining: DRAWING_TIME,
        drawings,
        phase: 'drawing',
        results: null,
        collageUrl: null,
        currentResultIndex: -1,
      };
      session.gameState = state;
    } else {
      const state: AIDrawingState = {
        word,
        timeRemaining: DRAWING_TIME,
        drawings,
        phase: 'drawing',
        results: null,
        collageUrl: null,
        currentResultIndex: -1,
      };
      session.gameState = state;
    }

    // Store full drawings separately (including imageData)
    drawingsStorage.set(session.id, drawings);

    const state = session.gameState as AIDrawingState;
    console.log(`AI Drawing game started! Word: ${state.word}`);

    // Start countdown timer
    countdown = new CountdownTimer({
      duration: DRAWING_TIME,
      onTick: (timeRemaining) => {
        const currentState = session.gameState as AIDrawingState;
        if (currentState.phase !== 'drawing') {
          countdown?.stop();
          return;
        }
        currentState.timeRemaining = timeRemaining;
        broadcastSessionState(session, io);
      },
      onComplete: () => {
        const currentState = session.gameState as AIDrawingState;
        // Time's up! Auto-submit all unsubmitted drawings
        console.log('Time is up! Auto-submitting drawings...');
        currentState.phase = 'judging';

        // Broadcast judging phase immediately
        broadcastSessionState(session, io);

        // Trigger judging (don't broadcast here, handleJudging will do it)
        handleJudging(session, io).catch((error) => {
          console.error('Unhandled error in handleJudging (timer):', error);
        });
      },
    });
    countdown.start();
  },

  onEnd(session, _io) {
    console.log('AI Drawing game ended');
    if (countdown) {
      countdown.stop();
      countdown = null;
    }
    if (resultRevealInterval) {
      clearInterval(resultRevealInterval);
      resultRevealInterval = null;
    }
    // Clean up drawings storage
    drawingsStorage.delete(session.id);
    // Clean up used words for this session
    sessionUsedWords.delete(session.id);
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    const state = session.gameState as AIDrawingState;
    if (!state) return;

    if (action.type === 'submit-drawing') {
      const payload = action.payload as { imageData: string };
      if (!state.drawings[playerId]) return;

      // Store imageData in separate storage
      const storage = drawingsStorage.get(session.id);
      if (storage && storage[playerId]) {
        storage[playerId].imageData = payload.imageData;
        storage[playerId].submitted = true;
      }

      // Update session state (without imageData)
      state.drawings[playerId].submitted = true;

      console.log(`Player ${playerId} submitted their drawing`);

      // Check if all players have submitted
      const allSubmitted = Object.values(state.drawings).every((d) => d.submitted);
      if (allSubmitted && state.phase === 'drawing') {
        console.log('All players submitted! Starting judging...');
        state.phase = 'judging';
        if (countdown) {
          countdown.stop();
          countdown = null;
        }

        // Trigger judging
        handleJudging(session, io).catch((error) => {
          console.error('Unhandled error in handleJudging (all submitted):', error);
        });
      }

      // Broadcast updated state
      broadcastSessionState(session, io);
    }
  },

  onPlayerJoin(session, io, player) {
    const state = session.gameState as AIDrawingState;
    if (state && state.phase === 'drawing' && player.isActive) {
      const newDrawing = {
        playerId: player.id,
        playerName: player.name,
        imageData: '',
        submitted: false,
      };

      // Add drawing slot to session state
      state.drawings[player.id] = newDrawing;

      // Add to storage as well
      const storage = drawingsStorage.get(session.id);
      if (storage) {
        storage[player.id] = newDrawing;
      }
    }
  },

  onPlayerLeave(_session, _io, _player) {
    // Players leaving during the game is handled naturally by the drawings object
  },
};

function startResultReveal(session: ServerGameSession, io: GameServer) {
  const state = session.gameState as AIDrawingState;
  if (!state || !state.results || state.results.length === 0) return;

  const REVEAL_INTERVAL = 5000; // 5 seconds between each result

  console.log('Starting result reveal timer...');

  // Function to reveal the next result
  const revealNext = () => {
    const currentState = session.gameState as AIDrawingState;
    if (!currentState || !currentState.results) {
      console.log('[revealNext] No state or results, stopping interval');
      if (resultRevealInterval) clearInterval(resultRevealInterval);
      return;
    }

    // Advance to next result
    currentState.currentResultIndex++;

    console.log(`[revealNext] Revealing result ${currentState.currentResultIndex + 1}/${currentState.results.length}`);
    console.log(`[revealNext] currentResultIndex is now: ${currentState.currentResultIndex}`);

    // Send the drawing image for this result to TV
    if (currentState.currentResultIndex < currentState.results.length) {
      const currentResult = currentState.results[currentState.currentResultIndex];
      console.log(`[revealNext] Current result:`, currentResult);
      const storage = drawingsStorage.get(session.id);
      if (storage && session.tvSocketId) {
        const drawing = storage[currentResult.playerId];
        if (drawing && drawing.imageData) {
          console.log(`[revealNext] Sending drawing image for ${currentResult.playerName}`);
          io.to(session.tvSocketId).emit('drawing:image', {
            playerId: drawing.playerId,
            imageData: drawing.imageData,
          });
        } else {
          console.log(`[revealNext] No drawing data found for ${currentResult.playerName}`);
        }
      } else {
        console.log(`[revealNext] No storage or TV socket. Storage: ${!!storage}, TV: ${session.tvSocketId}`);
      }
    }

    // Broadcast the updated state with new currentResultIndex
    console.log(`[revealNext] Broadcasting state with currentResultIndex: ${currentState.currentResultIndex}`);
    broadcastSessionState(session, io);

    // If we've revealed all results, stop the timer
    if (currentState.currentResultIndex >= currentState.results.length - 1) {
      console.log('[revealNext] All results revealed, stopping timer');
      if (resultRevealInterval) {
        clearInterval(resultRevealInterval);
        resultRevealInterval = null;
      }
    }
  };

  // Start with -1 and immediately reveal the first result
  state.currentResultIndex = -1;
  console.log(`[startResultReveal] Initial currentResultIndex set to: ${state.currentResultIndex}`);
  console.log(`[startResultReveal] Total results to reveal: ${state.results.length}`);

  // Reveal first result immediately
  console.log('[startResultReveal] Calling revealNext() immediately...');
  revealNext();

  // Then continue revealing every REVEAL_INTERVAL
  console.log(`[startResultReveal] Setting up interval to reveal every ${REVEAL_INTERVAL}ms`);
  resultRevealInterval = setInterval(revealNext, REVEAL_INTERVAL);
}

async function handleJudging(session: ServerGameSession, io: GameServer) {
  console.log('=== handleJudging called ===');
  const state = session.gameState as AIDrawingState;
  if (!state) {
    console.log('No state found in handleJudging');
    return;
  }

  console.log('Current phase:', state.phase);

  try {
    // Get all submitted drawings from storage (includes imageData)
    const storage = drawingsStorage.get(session.id);
    if (!storage) {
      console.log('No drawings storage found');
      state.phase = 'results';
      state.results = [];
      state.currentResultIndex = -1;
      broadcastSessionState(session, io);
      return;
    }

    const submittedDrawings = Object.values(storage).filter(
      (d) => d.submitted && d.imageData
    );

    console.log(`Found ${submittedDrawings.length} submitted drawings`);

    if (submittedDrawings.length === 0) {
      console.log('No drawings to judge');
      state.phase = 'results';
      state.results = [];
      state.currentResultIndex = -1;
      broadcastSessionState(session, io);
      return;
    }

    console.log(`Judging ${submittedDrawings.length} drawings...`);
    const results = await judgeDrawings(state.word, submittedDrawings);

    console.log('Got results from judgeDrawings:', results);

    state.results = results.sort((a, b) => a.rank - b.rank);
    state.phase = 'results';
    state.currentResultIndex = -1; // Start with no results revealed

    console.log('Judging complete! Phase:', state.phase, 'Results:', state.results);

    // Start the reveal process
    startResultReveal(session, io);
  } catch (error) {
    console.error('!!! Error during judging:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    state.phase = 'results';
    state.results = [];
    state.currentResultIndex = -1;

    broadcastSessionState(session, io);
  }
}
