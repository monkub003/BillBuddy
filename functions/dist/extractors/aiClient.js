"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAIClient = createAIClient;
/**
 * Creates an AI client that calls the external AI service.
 * Uses AI_SERVICE_API_KEY from environment.
 * For MVP, returns a placeholder response — the structure and error handling are the focus.
 */
function createAIClient(apiKey) {
    const key = apiKey ?? process.env.AI_SERVICE_API_KEY;
    if (!key) {
        throw new Error("AI_SERVICE_API_KEY is not configured");
    }
    async function extractFromImage(imageUrl) {
        // MVP placeholder: In production, this would call the AI service API
        // e.g., OpenAI Vision, Google Cloud Vision, etc.
        // For now, throw to indicate no real AI service is connected.
        // The Cloud Function wrapping this handles the error gracefully.
        throw new Error("AI service not configured for image extraction");
    }
    async function extractFromText(text, attachments) {
        // MVP placeholder: In production, this would call the AI service API
        // e.g., OpenAI GPT for text parsing.
        throw new Error("AI service not configured for text extraction");
    }
    return { extractFromImage, extractFromText };
}
//# sourceMappingURL=aiClient.js.map