"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOCRExtractor = createOCRExtractor;
const dataMapper_1 = require("./dataMapper");
/**
 * OCR Extractor — processes bill/receipt images uploaded to Firebase Storage.
 * Triggered by storage upload events. Extracts amount, category, dueDate
 * with confidence scores via the AI client, then maps to an Expense record.
 */
function createOCRExtractor(deps) {
    const { aiClient } = deps;
    /**
     * Process an uploaded image and extract expense data.
     * @param storageUrl - Firebase Storage URL of the uploaded image
     * @param userId - Authenticated user who uploaded the image
     * @returns ApiResponse containing the created Expense or an error
     */
    async function processImage(storageUrl, userId) {
        if (!storageUrl || storageUrl.trim() === "") {
            return { data: null, error: "storage URL is required" };
        }
        if (!userId || userId.trim() === "") {
            return { data: null, error: "user ID is required" };
        }
        let extractionResult;
        try {
            extractionResult = await aiClient.extractFromImage(storageUrl);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "unknown extraction error";
            // Distinguish unreadable images from service failures
            if (message.includes("unreadable") ||
                message.includes("low quality") ||
                message.includes("cannot process")) {
                return {
                    data: null,
                    error: "image is unreadable or too low quality",
                };
            }
            if (message.includes("not configured") ||
                message.includes("unavailable") ||
                message.includes("timeout")) {
                return { data: null, error: "extraction service unavailable" };
            }
            return {
                data: null,
                error: "image is unreadable or too low quality",
            };
        }
        // Validate extraction result has required fields
        if (!extractionResult ||
            !extractionResult.amount ||
            !extractionResult.category ||
            !extractionResult.dueDate) {
            return {
                data: null,
                error: "image is unreadable or too low quality",
            };
        }
        // Validate amount is positive
        if (extractionResult.amount.value <= 0) {
            return {
                data: null,
                error: "extracted amount is not valid",
            };
        }
        // Map extraction result to Expense via Data Mapper
        const expense = (0, dataMapper_1.mapToExpense)(extractionResult, userId, "image", storageUrl);
        return { data: expense, error: null };
    }
    return { processImage };
}
//# sourceMappingURL=ocrExtractor.js.map