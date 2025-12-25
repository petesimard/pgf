/**
 * ElevenLabs Text-to-Speech streaming integration.
 *
 * Provides TTS streaming functionality for the game host avatar.
 * Streams audio chunks in real-time to minimize latency.
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { v4 as uuidv4 } from 'uuid';
import type { GameServer } from '../types.js';

interface SpeechOptions {
  voice?: string;
  stability?: number;
  similarity_boost?: number;
  showBubble?: boolean;
}

export interface SpeechInfo {
  messageId: string;
  text: string;
  durationMs: number;
  audioSizeBytes: number;
}

/**
 * Calculate MP3 duration in milliseconds from audio data size.
 * For mp3_44100_128 format: 128 kbps = 16000 bytes/second
 */
function calculateMp3Duration(audioSizeBytes: number): number {
  const BITRATE_BYTES_PER_SECOND = 16000; // 128 kbps = 16000 bytes/sec
  const durationSeconds = audioSizeBytes / BITRATE_BYTES_PER_SECOND;
  return Math.round(durationSeconds * 1000); // Convert to milliseconds
}

/**
 * Stream TTS audio from ElevenLabs to a specific TV client.
 *
 * Generates speech using ElevenLabs API and streams audio chunks
 * via Socket.IO events for low-latency playback on the TV client.
 *
 * @param io - Socket.IO server instance
 * @param tvSocketId - Socket ID of the TV client
 * @param text - Text to convert to speech
 * @param options - Optional voice and synthesis settings
 * @returns Information about the generated speech including duration
 *
 * @example
 * ```typescript
 * const info = await streamSpeechToTV(io, session.tvSocketId, "Welcome to the game!");
 * console.log(`Speech duration: ${info.durationMs}ms`);
 * ```
 */
export async function streamSpeechToTV(
  io: GameServer,
  tvSocketId: string,
  text: string,
  options?: SpeechOptions
): Promise<SpeechInfo> {
  const messageId = uuidv4();

  // Check if API key is configured
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('[ElevenLabs] API key not configured. Set ELEVENLABS_API_KEY in .env');
    // Estimate duration based on text length (average speaking rate ~150 words/min = 2.5 words/sec)
    const wordCount = text.split(/\s+/).length;
    const estimatedDurationMs = Math.round((wordCount / 2.5) * 1000);
    io.to(tvSocketId).emit('host:speak-start', { messageId, text, durationMs: estimatedDurationMs, showBubble: options?.showBubble });
    io.to(tvSocketId).emit('host:speak-error', {
      messageId,
      error: 'ElevenLabs API key not configured',
    });
    return {
      messageId,
      text,
      durationMs: estimatedDurationMs,
      audioSizeBytes: 0,
    };
  }

  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  try {
    // Estimate initial duration for progress bar (will be updated with actual duration)
    const wordCount = text.split(/\s+/).length;
    const estimatedDurationMs = Math.round((wordCount / 2.5) * 1000);

    // Emit start event with text and estimated duration (shows avatar immediately)
    console.log(`[ElevenLabs] Starting speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    io.to(tvSocketId).emit('host:speak-start', { messageId, text, durationMs: estimatedDurationMs, showBubble: options?.showBubble });

    // Get voice ID from env or use default (Rachel)
    const voiceId = options?.voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    // Generate complete audio from ElevenLabs (non-streaming)
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: 'eleven_turbo_v2_5', // Fast, low-latency model
      outputFormat: 'mp3_44100_128', // Good quality, browser-compatible
      voiceSettings: {
        stability: options?.stability ?? 0.5,
        similarityBoost: options?.similarity_boost ?? 0.75,
      },
    });

    // Read the complete audio stream
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Concatenate all chunks into a single buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const completeAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      completeAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert complete audio to base64 and send as single chunk
    const base64Audio = Buffer.from(completeAudio).toString('base64');
    const audioSizeBytes = completeAudio.length;
    const durationMs = calculateMp3Duration(audioSizeBytes);

    console.log(`[ElevenLabs] Speech generated. Audio size: ${audioSizeBytes} bytes, Duration: ${durationMs}ms`);

    // Send complete audio as single chunk
    io.to(tvSocketId).emit('host:audio-chunk', {
      messageId,
      audioChunk: base64Audio,
      isLast: false,
    });

    // Send completion marker
    io.to(tvSocketId).emit('host:audio-chunk', {
      messageId,
      audioChunk: '',
      isLast: true,
    });

    io.to(tvSocketId).emit('host:speak-end', { messageId });
    console.log(`[ElevenLabs] Speech completed successfully.`);

    return {
      messageId,
      text,
      durationMs,
      audioSizeBytes,
    };

  } catch (error) {
    console.error('[ElevenLabs] Speech synthesis failed:', error);

    // Emit error event (client will show text-only fallback)
    io.to(tvSocketId).emit('host:speak-error', {
      messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Estimate duration based on text length (average speaking rate ~150 words/min = 2.5 words/sec)
    const wordCount = text.split(/\s+/).length;
    const estimatedDurationMs = Math.round((wordCount / 2.5) * 1000);
    return {
      messageId,
      text,
      durationMs: estimatedDurationMs,
      audioSizeBytes: 0,
    };
  }
}
