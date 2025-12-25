import { GoogleGenAI } from '@google/genai';
import type { ImageGenerator } from './image-generator.js';

/**
 * Nano Banana (Google Gemini) image generation implementation of the ImageGenerator interface.
 * Uses Gemini 2.5 Flash Image or Gemini 3 Pro Image for high-quality illustrations.
 */
export class NanoBananaImageGenerator implements ImageGenerator {
  private ai: GoogleGenAI;
  private model: string;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    // Use Gemini 2.5 Flash Image by default, or Gemini 3 Pro Image for higher quality
    this.model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      console.log('[NanoBananaImageGenerator] Generating image with prompt:', prompt.substring(0, 100) + '...');

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      // Extract base64 image data from response
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No candidates returned from Nano Banana');
      }

      const candidate = response.candidates[0];
      if (!candidate.content || !candidate.content.parts) {
        throw new Error('No content parts in response');
      }

      // Find the first inline image data
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          console.log('[NanoBananaImageGenerator] Image generated successfully');
          return part.inlineData.data;
        }
      }

      throw new Error('No image data found in response');
    } catch (error) {
      console.error('[NanoBananaImageGenerator] Image generation failed:', error);

      if (error instanceof Error) {
        // Provide more specific error messages for common issues
        if (error.message.includes('API key')) {
          throw new Error('Invalid or missing Gemini API key. Please check GEMINI_API_KEY environment variable.');
        } else if (error.message.includes('quota')) {
          throw new Error('Gemini API quota exceeded. Please check your billing settings.');
        } else if (error.message.includes('safety') || error.message.includes('blocked')) {
          throw new Error('Image generation blocked by safety filters. Try different story elements.');
        } else if (error.message.includes('rate')) {
          throw new Error('Rate limit exceeded. Please wait a moment and retry.');
        }
      }

      throw error;
    }
  }
}
