import type { AvatarMessage } from '../src/types.js';
import type { ServerGameSession, GameServer } from './types.js';

/**
 * Avatar Host Interface
 *
 * Games can use this interface to make the avatar host speak during gameplay.
 * The avatar appears on the TV screen and uses text-to-speech to announce messages.
 *
 * Usage in game handlers:
 *   import { avatarSpeak } from '../avatar.js';
 *
 *   avatarSpeak(session, io, "Welcome to the game!");
 *   avatarSpeak(session, io, "Great job!", 'excited');
 */

/**
 * Make the avatar host speak a message.
 * The message is sent to the TV client which plays it using text-to-speech.
 *
 * @param session - The current game session
 * @param io - The Socket.IO server instance
 * @param text - The text for the avatar to speak
 * @param emotion - Optional emotion for the avatar (affects visual display)
 */
export function avatarSpeak(
  session: ServerGameSession,
  io: GameServer,
  text: string,
  emotion: AvatarMessage['emotion'] = 'neutral'
): void {
  if (!session.tvSocketId) {
    console.log(`[Avatar] No TV connected for session ${session.id}, skipping speech`);
    return;
  }

  const message: AvatarMessage = {
    text,
    emotion,
  };

  io.to(session.tvSocketId).emit('avatar:speak', message);
  console.log(`[Avatar] Speaking: "${text}" (${emotion})`);
}

/**
 * Convenience function to announce player-related events
 */
export function avatarAnnouncePlayer(
  session: ServerGameSession,
  io: GameServer,
  playerName: string,
  action: 'join' | 'leave' | 'win' | 'correct' | 'wrong'
): void {
  const messages: Record<string, { text: string; emotion: AvatarMessage['emotion'] }> = {
    join: { text: `Welcome ${playerName}!`, emotion: 'happy' },
    leave: { text: `${playerName} has left the game.`, emotion: 'neutral' },
    win: { text: `Congratulations ${playerName}! You won!`, emotion: 'excited' },
    correct: { text: `${playerName} got it right!`, emotion: 'happy' },
    wrong: { text: `Oops, that's not it ${playerName}.`, emotion: 'thinking' },
  };

  const msg = messages[action];
  if (msg) {
    avatarSpeak(session, io, msg.text, msg.emotion);
  }
}
