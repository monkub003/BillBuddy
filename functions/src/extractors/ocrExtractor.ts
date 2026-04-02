import { ApiResponse } from "../types/api";
import { Expense } from "../types/expense";
import { ExtractionResult, ValidationResult } from "../types/extraction";
import { AIClient } from "./aiClient";
import { mapToExpense } from "./dataMapper";

export interface OCRExtractorDeps {
  aiClient: AIClient;
}

/** Tips shown to users when image quality is too low (Req 1.4). */
export const IMAGE_QUALITY_TIPS = [
  "Ensure good lighting — avoid shadows on the receipt",
  "Hold the camera steady to prevent blurring",
  "Avoid glare from overhead lights or flash",
  "Place the receipt on a flat, contrasting surface",
  "Capture the entire receipt within the frame",
  "Keep the camera parallel to the receipt to reduce distortion",
];

/**
 * Validates an image URL before attempting extraction.
 * Returns a ValidationResult with errors and tips when the image
 * cannot be processed (Req 1.4).
 */
export function validateImageUrl(storageUrl: string): ValidationResult {
  if (!storageUrl || storageUrl.trim() === "") {
    return {
      valid: false,
      errors: ["Image URL is required. Please upload a photo of your receipt."],
      needsReview: false,
    };
  }

  return { valid: true, errors: [], needsReview: false };
}

/**
 * Builds a user-friendly error message for low-quality images,
 * including actionable tips for retaking the photo (Req 1.4).
 */
export function buildImageQualityError(): string {
  const tips = IMAGE_QUALITY_TIPS.map((t) => `• ${t}`).join("\n");
  return `Image is unreadable or too low quality. Please retake the photo with these tips:\n${tips}`;
}

/**
 * OCR Extractor — processes bill/receipt images uploaded to Firebase Storage.
 * Triggered by storage upload events. Extracts amount, category, dueDate
 * with confidence scores via the AI client, then maps to an Expense record.
 */
export function createOCRExtractor(deps: OCRExtractorDeps) {
  const { aiClient } = deps;

  /**
   * Validate image quality before extraction.
   * Returns a ValidationResult with tips when the image is invalid (Req 1.4).
   */
  function validateImage(storageUrl: string): ValidationResult {
    return validateImageUrl(storageUrl);
  }

  /**
   * Process an uploaded image and extract expense data.
   * @param storageUrl - Firebase Storage URL of the uploaded image
   * @param userId - Authenticated user who uploaded the image
   * @returns ApiResponse containing the created Expense or an error
   */
  async function processImage(
    storageUrl: string,
    userId: string
  ): Promise<ApiResponse<Expense>> {
    // Validate image URL first
    const validation = validateImageUrl(storageUrl);
    if (!validation.valid) {
      return { data: null, error: "storage URL is required" };
    }

    if (!userId || userId.trim() === "") {
      return { data: null, error: "user ID is required" };
    }

    let extractionResult: ExtractionResult;

    try {
      extractionResult = await aiClient.extractFromImage(storageUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "unknown extraction error";

      // Distinguish unreadable images from service failures
      if (
        message.includes("unreadable") ||
        message.includes("low quality") ||
        message.includes("cannot process")
      ) {
        return {
          data: null,
          error: buildImageQualityError(),
        };
      }

      if (
        message.includes("not configured") ||
        message.includes("unavailable") ||
        message.includes("timeout")
      ) {
        return { data: null, error: "extraction service unavailable" };
      }

      return {
        data: null,
        error: buildImageQualityError(),
      };
    }

    // Validate extraction result has required fields
    if (
      !extractionResult ||
      !extractionResult.amount ||
      !extractionResult.category ||
      !extractionResult.dueDate
    ) {
      return {
        data: null,
        error: buildImageQualityError(),
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
    const expense = mapToExpense(
      extractionResult,
      userId,
      "image",
      storageUrl
    );

    return { data: expense, error: null };
  }

  return { processImage, validateImage };
}
