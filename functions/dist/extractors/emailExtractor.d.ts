import { ApiResponse } from "../types/api";
import { Expense } from "../types/expense";
import { EmailWebhookPayload } from "../types/extraction";
import { AIClient } from "./aiClient";
export interface EmailExtractorDeps {
    aiClient: AIClient;
}
/**
 * Scrubs PII (email addresses, phone numbers, national IDs) from text.
 * Replaces matches with [REDACTED] placeholders.
 */
export declare function scrubPII(text: string): string;
/**
 * Email Extractor — processes email receipts received via webhook.
 * Parses email body and attachments, extracts amount, category, dueDate
 * with confidence scores via the AI client, scrubs PII, then maps to an Expense record.
 */
export declare function createEmailExtractor(deps: EmailExtractorDeps): {
    processEmail: (payload: EmailWebhookPayload, userId: string) => Promise<ApiResponse<Expense>>;
};
//# sourceMappingURL=emailExtractor.d.ts.map