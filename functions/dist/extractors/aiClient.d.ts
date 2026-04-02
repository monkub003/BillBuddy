import { ExtractionResult } from "../types/extraction";
export interface AIClient {
    extractFromImage(imageUrl: string): Promise<ExtractionResult>;
    extractFromBase64(base64: string, mimeType: string): Promise<ExtractionResult>;
    extractFromText(text: string, attachments?: string[]): Promise<ExtractionResult>;
    generateInsights(prompt: string): Promise<string>;
}
/**
 * Auto-detects provider from key format and creates the appropriate client.
 * - Keys starting with "sk-" → OpenAI
 * - Keys starting with "AIza" → Google Gemini
 */
export declare function createAIClient(apiKey?: string): AIClient;
//# sourceMappingURL=aiClient.d.ts.map