import { ApiResponse } from "../types/api";
import { Expense } from "../types/expense";
import { ExtractionResult } from "../types/extraction";
import { AIClient } from "./aiClient";
import { mapToExpense } from "./dataMapper";

export interface OCRExtractorDeps {
  aiClient: AIClient;
}

/**
 * OCR Extractor — processes bill/receipt images uploaded to Firebase Storage.
 * Triggered by storage upload events. Extracts amount, category, dueDate
 * with confidence scores via the AI client, then maps to an Expense record.
 */
export function createOCRExtractor(deps: OCRExtractorDeps) {
  const { aiClient } = deps;

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
    if (!storageUrl || storageUrl.trim() === "") {
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
          error: "image is unreadable or too low quality",
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
        error: "image is unreadable or too low quality",
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
    const expense = mapToExpense(
      extractionResult,
      userId,
      "image",
      storageUrl
    );

    return { data: expense, error: null };
  }

  return { processImage };
}
