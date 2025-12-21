/**
 * Interface for category providers in Word Scramble game
 */
export interface CategoryProvider {
  /**
   * Get a random set of categories
   * @param count Number of categories to retrieve
   * @returns Array of category strings
   */
  getCategories(count: number): string[];

  /**
   * Get the name of this provider
   */
  getName(): string;
}
