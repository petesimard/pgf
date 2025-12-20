import type { GameRegistration } from '../types';
import TVView from './TVView';
import ClientView from './ClientView';

export const wordScrambleGame: GameRegistration = {
  id: 'word-scramble',
  TVView,
  ClientView,
};
