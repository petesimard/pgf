/**
 * Interface for providing drawing words
 */
export interface DrawingWordProvider {
  /**
   * Get a random word that hasn't been used yet in this session
   * @param usedWords - Set of words already used in the current game session
   * @returns A word to draw, or null if no words are available
   */
  getWord(usedWords: Set<string>): string | null;

  /**
   * Get the total number of available words
   */
  getWordCount(): number;
}

/**
 * Static word provider with a predefined list of drawing words
 */
export class StaticDrawingWordProvider implements DrawingWordProvider {
  private words: string[];

  constructor() {
    this.words = [
      'Cat',
      'House',
      'Tree',
      'Car',
      'Bicycle',
      'Pizza',
      'Robot',
      'Sun',
      'Mountain',
      'Fish',
      'Flower',
      'Castle',
      'Dragon',
      'Rocket',
      'Guitar',
      'Coffee',
      'Umbrella',
      'Butterfly',
      'Spaceship',
      'Rainbow',
      'Penguin',
      'Telescope',
      'Campfire',
      'Lighthouse',
      'Snowman',
      'Airplane',
      'Mushroom',
      'Cupcake',
      'Sandwich',
      'Cactus',
      'Donut',
      'Hotdog',
      'Whale',
      'Octopus',
      'Crown',
      'Diamond',
      'Key',
      'Balloon',
      'Ice Cream',
      'Tent',
      'Anchor',
      'Candle',
      'Pumpkin',
      'Ghost',
      'Sailboat',
      'Banana',
      'Apple',
      'Watermelon',
      'Strawberry',
      'Carrot',
      'Dinosaur',
      'Elephant',
      'Giraffe',
      'Pirate',
      'Treasure Chest',
      'Moon',
      'Star',
      'Cloud',
      'Lightning',
      'Volcano',
      'Island',
      'Palm Tree',
      'Snowflake',
      'Sunglasses',
      'Basketball',
      'Soccer Ball',
      'Trophy',
      'Magnet',
      'Tornado',
      'Hammer',
      'Violin',
      'Drum',
      'Microphone',
      'Camera',
      'Book',
      'Glasses',
      'Watch',
      'Ring',
      'Necklace',
      'Hat',
      'Shoe',
      'Boot',
      'Sock',
      'Glove',
      'Scarf',
      'Backpack',
      'Suitcase',
      'Envelope',
      'Gift',
      'Bell',
      'Clock',
      'Hourglass',
      'Magician',
      'Knight',
      'Princess',
      'Unicorn',
      'Mermaid',
      'Phoenix',
      'Wizard',
      'Alien',
      'UFO',
      'Comet',
      'Planet',
      'Saturn',
      'Igloo',
      'Pyramid',
      'Bridge',
      'Windmill',
      'Barn',
      'Fence',
      'Ladder',
      'Toolbox',
      'Paintbrush',
      'Rocket Ship',
      'Hot Air Balloon',
      'Submarine',
      'Helicopter',
      'Train',
      'Motorcycle',
      'Skateboard',
      'Surfboard',
      'Snowboard',
      'Kite',
      'Parachute',
      'Compass',
      'Map',
      'Treasure Map',
      'Spyglass',
      'Sword',
      'Shield',
      'Bow and Arrow',
      'Torch',
      'Lantern',
      'Flashlight',
      'Tent Campfire',
      'Sleeping Bag',
      'Binoculars',
      'Telescope',
      'Microscope',
      'Globe',
      'Trophy Cup',
      'Medal',
      'Flag',
      'Fountain',
      'Statue',
      'Temple',
      'Pagoda',
      'Totem Pole',
      'Fire Hydrant',
      'Mailbox',
      'Stop Sign',
      'Traffic Light',
      'Bench',
      'Swing',
      'Slide',
      'Seesaw',
      'Merry-Go-Round',
      'Ferris Wheel',
      'Roller Coaster',
    ];
  }

  getWord(usedWords: Set<string>): string | null {
    // Filter out already used words
    const availableWords = this.words.filter((word) => !usedWords.has(word));

    if (availableWords.length === 0) {
      return null;
    }

    // Return a random word from available words
    return availableWords[Math.floor(Math.random() * availableWords.length)];
  }

  getWordCount(): number {
    return this.words.length;
  }
}
