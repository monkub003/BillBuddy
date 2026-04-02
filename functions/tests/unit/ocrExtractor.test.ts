import {
  createOCRExtractor,
  validateImageUrl,
  buildImageQualityError,
  IMAGE_QUALITY_TIPS,
} from "../../src/extractors/ocrExtractor";
import { AIClient } from "../../src/extractors/aiClient";
import { ExtractionResult } from "../../src/types/extraction";

function mockAIClient(overrides?: Partial<AIClient>): AIClient {
  return {
    extractFromImage: jest.fn().mockRejectedValue(new Error("not configured")),
    extractFromText: jest.fn().mockRejectedValue(new Error("not configured")),
    ...overrides,
  };
}

function validExtractionResult(): ExtractionResult {
  return {
    amount: { value: 1500, confidence: 0.95 },
    category: { value: "electricity", confidence: 0.88 },
    dueDate: { value: "2025-02-15", confidence: 0.92 },
  };
}

describe("OCR Extractor", () => {
  describe("processImage", () => {
    it("should return an expense when AI extraction succeeds", async () => {
      const aiClient = mockAIClient({
        extractFromImage: jest.fn().mockResolvedValue(validExtractionResult()),
      });
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage(
        "gs://bucket/image.jpg",
        "user-123"
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.amount).toBe(1500);
      expect(result.data!.category).toBe("electricity");
      expect(result.data!.extractedVia).toBe("image");
      expect(result.data!.rawSourceRef).toBe("gs://bucket/image.jpg");
      expect(result.data!.userId).toBe("user-123");
      expect(result.data!.currency).toBe("THB");
    });

    it("should set needsReview when confidence is low", async () => {
      const lowConfidence: ExtractionResult = {
        amount: { value: 500, confidence: 0.3 },
        category: { value: "water", confidence: 0.9 },
        dueDate: { value: "2025-03-01", confidence: 0.8 },
      };
      const aiClient = mockAIClient({
        extractFromImage: jest.fn().mockResolvedValue(lowConfidence),
      });
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage(
        "gs://bucket/img.png",
        "user-456"
      );

      expect(result.error).toBeNull();
      expect(result.data!.needsReview).toBe(true);
    });

    it("should return error for unreadable images", async () => {
      const aiClient = mockAIClient({
        extractFromImage: jest
          .fn()
          .mockRejectedValue(new Error("image is unreadable")),
      });
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage(
        "gs://bucket/bad.jpg",
        "user-123"
      );

      expect(result.data).toBeNull();
      expect(result.error).toContain("Image is unreadable or too low quality");
      expect(result.error).toContain("retake the photo");
      // Verify tips are included (Req 1.4)
      expect(result.error).toContain("good lighting");
      expect(result.error).toContain("camera steady");
      expect(result.error).toContain("glare");
    });

    it("should return error when AI service is unavailable", async () => {
      const aiClient = mockAIClient({
        extractFromImage: jest
          .fn()
          .mockRejectedValue(new Error("service unavailable")),
      });
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage(
        "gs://bucket/img.jpg",
        "user-123"
      );

      expect(result.data).toBeNull();
      expect(result.error).toBe("extraction service unavailable");
    });

    it("should return error for empty storage URL", async () => {
      const aiClient = mockAIClient();
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage("", "user-123");

      expect(result.data).toBeNull();
      expect(result.error).toBe("storage URL is required");
    });

    it("should return error for empty user ID", async () => {
      const aiClient = mockAIClient();
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage("gs://bucket/img.jpg", "");

      expect(result.data).toBeNull();
      expect(result.error).toBe("user ID is required");
    });

    it("should return error when extracted amount is non-positive", async () => {
      const badAmount: ExtractionResult = {
        amount: { value: 0, confidence: 0.9 },
        category: { value: "gas", confidence: 0.8 },
        dueDate: { value: "2025-04-01", confidence: 0.7 },
      };
      const aiClient = mockAIClient({
        extractFromImage: jest.fn().mockResolvedValue(badAmount),
      });
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage(
        "gs://bucket/img.jpg",
        "user-123"
      );

      expect(result.data).toBeNull();
      expect(result.error).toBe("extracted amount is not valid");
    });

    it("should default unrecognized category to manual with review flag", async () => {
      const unknownCategory: ExtractionResult = {
        amount: { value: 200, confidence: 0.9 },
        category: { value: "groceries" as any, confidence: 0.8 },
        dueDate: { value: "2025-05-01", confidence: 0.9 },
      };
      const aiClient = mockAIClient({
        extractFromImage: jest.fn().mockResolvedValue(unknownCategory),
      });
      const extractor = createOCRExtractor({ aiClient });

      const result = await extractor.processImage(
        "gs://bucket/img.jpg",
        "user-123"
      );

      expect(result.error).toBeNull();
      expect(result.data!.category).toBe("manual");
      expect(result.data!.needsReview).toBe(true);
    });
  });

  describe("validateImage", () => {
    it("should return valid for a non-empty URL", () => {
      const aiClient = mockAIClient();
      const extractor = createOCRExtractor({ aiClient });

      const result = extractor.validateImage("gs://bucket/img.jpg");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid for an empty URL", () => {
      const aiClient = mockAIClient();
      const extractor = createOCRExtractor({ aiClient });

      const result = extractor.validateImage("");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return invalid for a whitespace-only URL", () => {
      const aiClient = mockAIClient();
      const extractor = createOCRExtractor({ aiClient });

      const result = extractor.validateImage("   ");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateImageUrl", () => {
    it("should return valid for a proper URL", () => {
      const result = validateImageUrl("gs://bucket/receipt.jpg");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should return invalid with message for empty string", () => {
      const result = validateImageUrl("");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Image URL is required");
    });
  });

  describe("buildImageQualityError", () => {
    it("should include all quality tips", () => {
      const error = buildImageQualityError();
      expect(error).toContain("retake the photo");
      for (const tip of IMAGE_QUALITY_TIPS) {
        expect(error).toContain(tip);
      }
    });
  });

  describe("IMAGE_QUALITY_TIPS", () => {
    it("should contain tips about lighting, steadiness, and glare", () => {
      const joined = IMAGE_QUALITY_TIPS.join(" ");
      expect(joined).toContain("lighting");
      expect(joined).toContain("steady");
      expect(joined).toContain("glare");
    });
  });
});
