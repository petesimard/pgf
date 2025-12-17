import type { GameRegistration } from '../types';
import TVView from './TVView';
import ClientView from './ClientView';

export const buzzRaceGame: GameRegistration = {
  id: 'buzz-race',
  TVView,
  ClientView,
};
