import type { GameRegistration } from '../types';
import TVView from './TVView';
import ClientView from './ClientView';

export const drawingContestGame: GameRegistration = {
  id: 'drawing-contest',
  TVView,
  ClientView,
};
