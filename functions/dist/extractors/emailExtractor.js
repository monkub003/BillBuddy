"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrubPII = scrubPII;
exports.createEmailExtractor = createEmailExtractor;
const dataMapper_1 = require("./dataMapper");
/**
 * Scrubs PII (email addresses, phone numbers, national IDs) from text.
 * Replaces matches with [REDACTED] placeholders.
 */
function scrubPII(text) {
    let scrubbed = text;
    // Scrub email addresses
    scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
    // Scrub phone numbers (various formats: +66-xxx, (xxx) xxx-xxxx, xxx-xxx-xxxx, etc.)
    scrubbed = scrubbed.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "[REDACTED_PHONE]");
    // Scrub Thai national ID (13 digits, possibly with dashes)
    scrubbed = scrubbed.replace(/\b\d{1}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1}\b/g, "[REDACTED_ID]");
    return scrubbed;
}
/**
 * Email Extractor — processes email receipts received via webhook.
 * Parses email body and attachments, extracts amount, category, dueDate
 * with confidence scores via the AI client, scrubs PII, then maps to an Expense record.
 */
function createEmailExtractor(deps) {
    const { aiClient } = deps;
    /**
     * Process an email webhook payload and extract expense data.
     * @param payload - The email webhook payload (from, subject, body, attachments)
     * @param userId - Authenticated user associated with this email
     * @returns ApiResponse containing the created Expense or an error
     */
    async function processEmail(payload, userId) {
        if (!payload) {
            return { data: null, error: "email payload is required" };
        }
        if (!userId || userId.trim() === "") {
            return { data: null, error: "user ID is required" };
        }
        if (!payload.body || payload.body.trim() === "") {
            return { data: null, error: "email format is unsupported" };
        }
        // Combine email content for extraction
        const textContent = [
            `Subject: ${payload.subject || ""}`,
            `From: ${payload.from || ""}`,
            payload.body,
        ].join("\n");
        const attachmentContents = payload.attachments?.map((a) => a.content) ?? [];
        let extractionResult;
        try {
            extractionResult = await aiClient.extractFromText(textContent, attachmentContents);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "unknown extraction error";
            if (message.includes("unsupported") ||
                message.includes("cannot parse") ||
                message.includes("unreadable")) {
                return { data: null, error: "email format is unsupported" };
            }
            if (message.includes("not configured") ||
                message.includes("unavailable") ||
                message.includes("timeout")) {
                return { data: null, error: "extraction service unavailable" };
            }
            return { data: null, error: "email format is unsupported" };
        }
        // Validate extraction result has required fields
        if (!extractionResult ||
            !extractionResult.amount ||
            !extractionResult.category ||
            !extractionResult.dueDate) {
            return { data: null, error: "email format is unsupported" };
        }
        // Validate amount is positive
        if (extractionResult.amount.value <= 0) {
            return { data: null, error: "extracted amount is not valid" };
        }
        // Scrub PII from the raw email content before creating the source reference
        const scrubbedSubject = scrubPII(payload.subject || "");
        const sourceRef = `email:${scrubbedSubject}`;
        // Map extraction result to Expense via Data Mapper
        const expense = (0, dataMapper_1.mapToExpense)(extractionResult, userId, "email", sourceRef);
        return { data: expense, error: null };
    }
    return { processEmail };
}
//# sourceMappingURL=emailExtractor.js.map