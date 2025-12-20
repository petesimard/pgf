import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { broadcastSessionState } from './utils.js';
import OpenAI from 'openai';
import sharp from 'sharp';
import { z } from 'zod';

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
}

const DRAWING_WORDS = [
  'Cat',
  'House',
  'Tree',
  'Car',
  'Bicycle',
  'Pizza',
  'Robot',
  'Sun',
  'Mountain',
  'Fish',
  'Flower',
  'Castle',
  'Dragon',
  'Rocket',
  'Guitar',
  'Coffee',
  'Umbrella',
  'Butterfly',
  'Spaceship',
  'Rainbow',
];

const DRAWING_TIME = 60; // seconds

function selectRandomWord(): string {
  return DRAWING_WORDS[Math.floor(Math.random() * DRAWING_WORDS.length)];
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

    // Resize drawing to fit
    const resizedImage = await sharp(imageBuffer)
      .resize(CANVAS_SIZE, CANVAS_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
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

  return canvas.composite(composites).png().toBuffer();
}

async function judgeDrawings(word: string, drawings: PlayerDrawing[]): Promise<JudgingResult[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create collage
  const collageBuffer = await createCollage(drawings);
  const collageBase64 = collageBuffer.toString('base64');

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

let timerInterval: NodeJS.Timeout | null = null;

export const aiDrawingGame: GameHandler = {
  id: 'ai-drawing',
  name: 'AI Drawing Contest',
  description: 'Draw a word and let AI judge your masterpiece!',
  minPlayers: 2,
  maxPlayers: 8,

  onStart(session, io) {
    const state: AIDrawingState = {
      word: selectRandomWord(),
      timeRemaining: DRAWING_TIME,
      drawings: initializeDrawings(session),
      phase: 'drawing',
      results: null,
      collageUrl: null,
    };
    session.gameState = state;

    console.log(`AI Drawing game started! Word: ${state.word}`);

    // Start countdown timer
    timerInterval = setInterval(() => {
      const currentState = session.gameState as AIDrawingState;
      if (currentState.phase !== 'drawing') {
        if (timerInterval) clearInterval(timerInterval);
        return;
      }

      currentState.timeRemaining--;

      if (currentState.timeRemaining <= 0) {
        // Time's up! Auto-submit all unsubmitted drawings
        console.log('Time is up! Auto-submitting drawings...');
        currentState.phase = 'judging';
        if (timerInterval) clearInterval(timerInterval);

        // Trigger judging
        setTimeout(async () => {
          await handleJudging(session, io);
        }, 0);
      }

      // Broadcast updated state
      broadcastSessionState(session, io);
    }, 1000);
  },

  onEnd(session, _io) {
    console.log('AI Drawing game ended');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    const state = session.gameState as AIDrawingState;
    if (!state) return;

    if (action.type === 'submit-drawing') {
      const payload = action.payload as { imageData: string };
      if (!state.drawings[playerId]) return;

      state.drawings[playerId].imageData = payload.imageData;
      state.drawings[playerId].submitted = true;

      console.log(`Player ${playerId} submitted their drawing`);

      // Check if all players have submitted
      const allSubmitted = Object.values(state.drawings).every((d) => d.submitted);
      if (allSubmitted && state.phase === 'drawing') {
        console.log('All players submitted! Starting judging...');
        state.phase = 'judging';
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }

        // Trigger judging
        setTimeout(async () => {
          await handleJudging(session, io);
        }, 0);
      }

      // Broadcast updated state
      broadcastSessionState(session, io);
    }
  },

  onPlayerJoin(session, io, player) {
    const state = session.gameState as AIDrawingState;
    if (state && state.phase === 'drawing' && player.isActive) {
      // Add drawing slot for new player
      state.drawings[player.id] = {
        playerId: player.id,
        playerName: player.name,
        imageData: '',
        submitted: false,
      };
    }
  },

  onPlayerLeave(_session, _io, _player) {
    // Players leaving during the game is handled naturally by the drawings object
  },
};

async function handleJudging(session: ServerGameSession, io: GameServer) {
  const state = session.gameState as AIDrawingState;
  if (!state) return;

  try {
    // Get all submitted drawings
    const submittedDrawings = Object.values(state.drawings).filter(
      (d) => d.submitted && d.imageData
    );

    if (submittedDrawings.length === 0) {
      console.log('No drawings to judge');
      state.phase = 'results';
      state.results = [];
      return;
    }

    console.log(`Judging ${submittedDrawings.length} drawings...`);
    const results = await judgeDrawings(state.word, submittedDrawings);

    state.results = results.sort((a, b) => a.rank - b.rank);
    state.phase = 'results';

    console.log('Judging complete!', state.results);

    // Broadcast results
    broadcastSessionState(session, io);
  } catch (error) {
    console.error('Error during judging:', error);
    state.phase = 'results';
    state.results = [];

    broadcastSessionState(session, io);
  }
}
