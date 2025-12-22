import type { GameRegistration } from './types';
import { aiDrawingGame } from './ai-drawing';
import { wordScrambleGame } from './word-scramble';

// Game registry - add new games here
const games: GameRegistration[] = [
  aiDrawingGame,
  wordScrambleGame,
];

// Create a map for quick lookup
const gameMap = new Map<string, GameRegistration>(
  games.map((game) => [game.id, game])
);

export function getGame(id: string): GameRegistration | undefined {
  return gameMap.get(id);
}

export function getAllGames(): GameRegistration[] {
  return games;
}
