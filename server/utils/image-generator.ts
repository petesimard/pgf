/**
 * Generic interface for AI image generation services.
 * Allows for easy swapping of image generation providers in the future.
 */
export interface ImageGenerator {
  /**
   * Generates an image from a text prompt
   * @param prompt - The description of the image to generate
   * @returns Base64-encoded PNG image data
   */
  generateImage(prompt: string): Promise<string>;
}
