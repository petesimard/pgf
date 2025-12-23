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
 *
 * @example
 * ```typescript
 * await streamSpeechToTV(io, session.tvSocketId, "Welcome to the game!");
 * ```
 */
export async function streamSpeechToTV(
  io: GameServer,
  tvSocketId: string,
  text: string,
  options?: SpeechOptions
): Promise<void> {
  const messageId = uuidv4();

  // Check if API key is configured
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('[ElevenLabs] API key not configured. Set ELEVENLABS_API_KEY in .env');
    io.to(tvSocketId).emit('host:speak-start', { messageId, text });
    io.to(tvSocketId).emit('host:speak-error', {
      messageId,
      error: 'ElevenLabs API key not configured',
    });
    return;
  }

  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  try {
    // Emit start event with text (shows avatar immediately)
    console.log(`[ElevenLabs] Starting speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    io.to(tvSocketId).emit('host:speak-start', { messageId, text });

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

    console.log(`[ElevenLabs] Speech generated. Audio size: ${completeAudio.length} bytes`);

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

  } catch (error) {
    console.error('[ElevenLabs] Speech synthesis failed:', error);

    // Emit error event (client will show text-only fallback)
    io.to(tvSocketId).emit('host:speak-error', {
      messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
