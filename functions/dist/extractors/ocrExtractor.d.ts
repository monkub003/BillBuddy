import { ApiResponse } from "../types/api";
import { Expense } from "../types/expense";
import { AIClient } from "./aiClient";
export interface OCRExtractorDeps {
    aiClient: AIClient;
}
/**
 * OCR Extractor — processes bill/receipt images uploaded to Firebase Storage.
 * Triggered by storage upload events. Extracts amount, category, dueDate
 * with confidence scores via the AI client, then maps to an Expense record.
 */
export declare function createOCRExtractor(deps: OCRExtractorDeps): {
    processImage: (storageUrl: string, userId: string) => Promise<ApiResponse<Expense>>;
};
//# sourceMappingURL=ocrExtractor.d.ts.map