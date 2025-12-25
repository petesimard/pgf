import type { GameRegistration } from '../types';
import TVView from './TVView';
import ClientView from './ClientView';

export const groupStoryGame: GameRegistration = {
  id: 'group-story',
  TVView,
  ClientView,
};
