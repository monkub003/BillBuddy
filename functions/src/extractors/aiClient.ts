import { ExtractionResult } from "../types/extraction";

/**
 * Abstraction over the external AI service for extraction.
 * Allows mocking in tests and swapping implementations.
 */
export interface AIClient {
  extractFromImage(imageUrl: string): Promise<ExtractionResult>;
  extractFromText(text: string, attachments?: string[]): Promise<ExtractionResult>;
}

/**
 * Creates an AI client that calls the external AI service.
 * Uses AI_SERVICE_API_KEY from environment.
 * For MVP, returns a placeholder response — the structure and error handling are the focus.
 */
export function createAIClient(apiKey?: string): AIClient {
  const key = apiKey ?? process.env.AI_SERVICE_API_KEY;

  if (!key) {
    throw new Error("AI_SERVICE_API_KEY is not configured");
  }

  async function extractFromImage(imageUrl: string): Promise<ExtractionResult> {
    // MVP placeholder: In production, this would call the AI service API
    // e.g., OpenAI Vision, Google Cloud Vision, etc.
    // For now, throw to indicate no real AI service is connected.
    // The Cloud Function wrapping this handles the error gracefully.
    throw new Error("AI service not configured for image extraction");
  }

  async function extractFromText(text: string, attachments?: string[]): Promise<ExtractionResult> {
    // MVP placeholder: In production, this would call the AI service API
    // e.g., OpenAI GPT for text parsing.
    throw new Error("AI service not configured for text extraction");
  }

  return { extractFromImage, extractFromText };
}
