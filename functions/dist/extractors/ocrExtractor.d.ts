import { ApiResponse } from "../types/api";
import { Expense } from "../types/expense";
import { ValidationResult } from "../types/extraction";
import { AIClient } from "./aiClient";
export interface OCRExtractorDeps {
    aiClient: AIClient;
}
/** Tips shown to users when image quality is too low (Req 1.4). */
export declare const IMAGE_QUALITY_TIPS: string[];
/**
 * Validates an image URL before attempting extraction.
 * Returns a ValidationResult with errors and tips when the image
 * cannot be processed (Req 1.4).
 */
export declare function validateImageUrl(storageUrl: string): ValidationResult;
/**
 * Builds a user-friendly error message for low-quality images,
 * including actionable tips for retaking the photo (Req 1.4).
 */
export declare function buildImageQualityError(): string;
/**
 * OCR Extractor — processes bill/receipt images uploaded to Firebase Storage.
 * Triggered by storage upload events. Extracts amount, category, dueDate
 * with confidence scores via the AI client, then maps to an Expense record.
 */
export declare function createOCRExtractor(deps: OCRExtractorDeps): {
    processImage: (storageUrl: string, userId: string) => Promise<ApiResponse<Expense>>;
    validateImage: (storageUrl: string) => ValidationResult;
};
//# sourceMappingURL=ocrExtractor.d.ts.map