import type { GameRegistration } from '../types';
import TVView from './TVView';
import ClientView from './ClientView';

export const aiDrawingGame: GameRegistration = {
  id: 'ai-drawing',
  TVView,
  ClientView,
};
