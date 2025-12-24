/**
 * Shared utilities for game handlers.
 *
 * This module provides common helper functions that all games can use
 * to ensure consistent behavior and avoid code duplication.
 */

import type { ServerGameSession, GameServer } from '../types.js';
import OpenAI from 'openai';

/**
 * Configuration options for the countdown timer.
 */
export interface CountdownConfig {
  /** Initial time in seconds */
  duration: number;
  /** Callback fired every tick (1 second) with remaining time */
  onTick: (timeRemaining: number) => void;
  /** Callback fired when countdown reaches 0 */
  onComplete: () => void;
  /** Optional callback fired when countdown is manually stopped */
  onStop?: () => void;
}

/**
 * A countdown timer manager that can be started, stopped, and paused.
 * Used by games to manage round timers consistently.
 *
 * @example
 * ```typescript
 * const countdown = new CountdownTimer({
 *   duration: 60,
 *   onTick: (remaining) => {
 *     state.timeRemaining = remaining;
 *     broadcastSessionState(session, io);
 *   },
 *   onComplete: () => {
 *     state.phase = 'complete';
 *     broadcastSessionState(session, io);
 *   }
 * });
 *
 * countdown.start();
 *
 * // Later...
 * countdown.stop();
 * ```
 */
export class CountdownTimer {
  private interval: NodeJS.Timeout | null = null;
  private timeRemaining: number;
  private config: CountdownConfig;
  private isRunning: boolean = false;

  constructor(config: CountdownConfig) {
    this.config = config;
    this.timeRemaining = config.duration;
  }

  /**
   * Start or resume the countdown
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.interval = setInterval(() => {
      this.timeRemaining--;

      // Fire tick callback
      this.config.onTick(this.timeRemaining);

      // Check if complete
      if (this.timeRemaining <= 0) {
        this.stop();
        this.config.onComplete();
      }
    }, 1000);
  }

  /**
   * Stop the countdown and clear the interval
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.config.onStop?.();
  }

  /**
   * Reset the countdown to initial duration without starting
   */
  reset(): void {
    this.stop();
    this.timeRemaining = this.config.duration;
  }

  /**
   * Get the current time remaining
   */
  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  /**
   * Check if the countdown is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

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
    tvZoom: session.tvZoom,
  };

  io.to(session.id).emit('session:state', stateToSend);
}

/**
 * Make the game host speak to the TV client with text-to-speech.
 *
 * This function generates speech and returns information about the audio,
 * including its duration. Await this function to coordinate timing based
 * on speech length.
 *
 * The avatar host will appear on screen and speak the message.
 * If TTS fails, the text will still be displayed (silent mode) and
 * an estimated duration will be returned.
 *
 * @param session - The game session
 * @param io - Socket.IO server instance
 * @param message - The message text to speak
 * @returns Speech information including duration in milliseconds
 *
 * @example
 * ```typescript
 * import { hostTalk } from './utils.js';
 *
 * // Wait for speech to complete and get duration
 * const speechInfo = await hostTalk(session, io, "Welcome to the game!");
 * console.log(`Speech will take ${speechInfo.durationMs}ms`);
 *
 * // Or fire and forget (backwards compatible)
 * hostTalk(session, io, "Welcome!");
 * ```
 */
export async function hostTalk(
  session: ServerGameSession,
  io: GameServer,
  message: string
): Promise<import('../utils/elevenlabs.js').SpeechInfo | null> {
  const tvSocketId = session.tvSocketId;

  if (!tvSocketId) {
    console.warn('[hostTalk] No TV connected to session', session.id);
    return null;
  }

  console.log(`[hostTalk] Speaking to session ${session.id}: "${message}"`);

  try {
    const { streamSpeechToTV } = await import('../utils/elevenlabs.js');
    const speechInfo = await streamSpeechToTV(io, tvSocketId, message);
    return speechInfo;
  } catch (error) {
    console.error('[hostTalk] Failed to generate speech:', error);
    return null;
  }
}

/**
 * Helper function to get text completion from OpenAI.
 *
 * This function provides a simple interface for getting LLM text responses
 * using the OpenAI API. It uses environment variables for configuration:
 * - OPENAI_API_KEY: Your OpenAI API key (required)
 * - OPENAI_MODEL: The model to use (defaults to 'gpt-4o-mini')
 *
 * @param prompt - The text prompt to send to the LLM
 * @returns The raw text response from the model
 * @throws Error if no response is received from OpenAI
 *
 * @example
 * ```typescript
 * import { getAiText } from './utils.js';
 *
 * const response = await getAiText("Suggest a fun word for a drawing game");
 * console.log(response); // "How about 'octopus'? It's fun to draw!"
 * ```
 */
export async function getAiText(prompt: string): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI');

  return content;
}
