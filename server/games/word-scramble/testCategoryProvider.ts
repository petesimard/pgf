import type { CategoryProvider } from './categoryProvider.js';

/**
 * Test category provider with a static list of 10 categories
 */
export class TestCategoryProvider implements CategoryProvider {
  private readonly categories = [
    'Animals',
    'Foods',
    'Countries',
    'Famous People',
    'Movies',
    'Sports',
    'Colors',
    'Vegetables',
    'Cities',
    'Brands',
  ];

  getCategories(count: number): string[] {
    // Shuffle and return requested number of categories
    const shuffled = [...this.categories].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, this.categories.length));
  }

  getName(): string {
    return 'Test Category Provider';
  }
}
