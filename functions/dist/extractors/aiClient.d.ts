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
export declare function createAIClient(apiKey?: string): AIClient;
//# sourceMappingURL=aiClient.d.ts.map