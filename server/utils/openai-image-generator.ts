import OpenAI from 'openai';
import type { ImageGenerator } from './image-generator.js';

/**
 * OpenAI image generation implementation of the ImageGenerator interface.
 * Uses GPT Image 1.5 for high-quality story illustrations.
 */
export class OpenAIImageGenerator implements ImageGenerator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      console.log('[OpenAIImageGenerator] Generating image with prompt:', prompt.substring(0, 100) + '...');

      const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
      const response = await this.openai.images.generate({
        model: model,
        prompt: prompt,
        size: '1024x1024',
      });

      const imageData = response.data[0].b64_json;
      if (!imageData) {
        throw new Error('No image data returned from DALL-E');
      }

      console.log('[OpenAIImageGenerator] Image generated successfully');
      return imageData;
    } catch (error) {
      console.error('[OpenAIImageGenerator] Image generation failed:', error);

      if (error instanceof Error) {
        // Provide more specific error messages for common issues
        if (error.message.includes('content_policy')) {
          throw new Error('Image generation blocked by content policy. Try different story elements.');
        } else if (error.message.includes('rate_limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and retry.');
        } else if (error.message.includes('insufficient_quota')) {
          throw new Error('OpenAI API quota exceeded. Please check your billing settings.');
        }
      }

      throw error;
    }
  }
}
