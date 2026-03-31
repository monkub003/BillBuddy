import {
  createEmailExtractor,
  scrubPII,
} from "../../src/extractors/emailExtractor";
import { AIClient } from "../../src/extractors/aiClient";
import { ExtractionResult } from "../../src/types/extraction";
import { EmailWebhookPayload } from "../../src/types/extraction";

function mockAIClient(overrides?: Partial<AIClient>): AIClient {
  return {
    extractFromImage: jest.fn().mockRejectedValue(new Error("not configured")),
    extractFromText: jest.fn().mockRejectedValue(new Error("not configured")),
    ...overrides,
  };
}

function validExtractionResult(): ExtractionResult {
  return {
    amount: { value: 2500, confidence: 0.92 },
    category: { value: "insurance", confidence: 0.85 },
    dueDate: { value: "2025-03-20", confidence: 0.9 },
  };
}

function validEmailPayload(): EmailWebhookPayload {
  return {
    from: "billing@company.com",
    subject: "Your Insurance Bill - March 2025",
    body: "Dear customer, your insurance premium of 2,500 THB is due on March 20, 2025.",
    attachments: [
      {
        filename: "invoice.pdf",
        content: "base64-encoded-content",
        mimeType: "application/pdf",
      },
    ],
  };
}

describe("Email Extractor", () => {
  describe("processEmail", () => {
    it("should return an expense when AI extraction succeeds", async () => {
      const aiClient = mockAIClient({
        extractFromText: jest.fn().mockResolvedValue(validExtractionResult()),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(
        validEmailPayload(),
        "user-789"
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.amount).toBe(2500);
      expect(result.data!.category).toBe("insurance");
      expect(result.data!.extractedVia).toBe("email");
      expect(result.data!.userId).toBe("user-789");
      expect(result.data!.currency).toBe("THB");
    });

    it("should scrub PII from the source reference", async () => {
      const payload: EmailWebhookPayload = {
        from: "user@personal.com",
        subject: "Bill from user@personal.com - call 555-123-4567",
        body: "Your bill details here.",
      };
      const aiClient = mockAIClient({
        extractFromText: jest.fn().mockResolvedValue(validExtractionResult()),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(payload, "user-789");

      expect(result.error).toBeNull();
      expect(result.data!.rawSourceRef).not.toContain("user@personal.com");
      expect(result.data!.rawSourceRef).not.toContain("555-123-4567");
      expect(result.data!.rawSourceRef).toContain("[REDACTED_EMAIL]");
      expect(result.data!.rawSourceRef).toContain("[REDACTED_PHONE]");
    });

    it("should set needsReview when confidence is low", async () => {
      const lowConfidence: ExtractionResult = {
        amount: { value: 800, confidence: 0.4 },
        category: { value: "water", confidence: 0.9 },
        dueDate: { value: "2025-04-01", confidence: 0.8 },
      };
      const aiClient = mockAIClient({
        extractFromText: jest.fn().mockResolvedValue(lowConfidence),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(
        validEmailPayload(),
        "user-789"
      );

      expect(result.error).toBeNull();
      expect(result.data!.needsReview).toBe(true);
    });

    it("should return error for unparseable emails", async () => {
      const aiClient = mockAIClient({
        extractFromText: jest
          .fn()
          .mockRejectedValue(new Error("cannot parse email content")),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(
        validEmailPayload(),
        "user-789"
      );

      expect(result.data).toBeNull();
      expect(result.error).toBe("email format is unsupported");
    });

    it("should return error when AI service is unavailable", async () => {
      const aiClient = mockAIClient({
        extractFromText: jest
          .fn()
          .mockRejectedValue(new Error("service unavailable")),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(
        validEmailPayload(),
        "user-789"
      );

      expect(result.data).toBeNull();
      expect(result.error).toBe("extraction service unavailable");
    });

    it("should return error for empty email body", async () => {
      const payload: EmailWebhookPayload = {
        from: "test@test.com",
        subject: "Empty",
        body: "",
      };
      const aiClient = mockAIClient();
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(payload, "user-789");

      expect(result.data).toBeNull();
      expect(result.error).toBe("email format is unsupported");
    });

    it("should return error for empty user ID", async () => {
      const aiClient = mockAIClient();
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(validEmailPayload(), "");

      expect(result.data).toBeNull();
      expect(result.error).toBe("user ID is required");
    });

    it("should return error when extracted amount is non-positive", async () => {
      const badAmount: ExtractionResult = {
        amount: { value: -100, confidence: 0.9 },
        category: { value: "loan", confidence: 0.8 },
        dueDate: { value: "2025-06-01", confidence: 0.7 },
      };
      const aiClient = mockAIClient({
        extractFromText: jest.fn().mockResolvedValue(badAmount),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(
        validEmailPayload(),
        "user-789"
      );

      expect(result.data).toBeNull();
      expect(result.error).toBe("extracted amount is not valid");
    });

    it("should handle email with no attachments", async () => {
      const payload: EmailWebhookPayload = {
        from: "billing@company.com",
        subject: "Your Bill",
        body: "Your electricity bill is 1200 THB due Jan 15.",
      };
      const aiClient = mockAIClient({
        extractFromText: jest.fn().mockResolvedValue(validExtractionResult()),
      });
      const extractor = createEmailExtractor({ aiClient });

      const result = await extractor.processEmail(payload, "user-789");

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });
  });

  describe("scrubPII", () => {
    it("should redact email addresses", () => {
      const input = "Contact us at support@example.com for help";
      const result = scrubPII(input);
      expect(result).not.toContain("support@example.com");
      expect(result).toContain("[REDACTED_EMAIL]");
    });

    it("should redact phone numbers", () => {
      const input = "Call us at 555-123-4567";
      const result = scrubPII(input);
      expect(result).not.toContain("555-123-4567");
      expect(result).toContain("[REDACTED_PHONE]");
    });

    it("should redact international phone numbers", () => {
      const input = "Thai number: +66-89-123-4567";
      const result = scrubPII(input);
      expect(result).not.toContain("+66-89-123-4567");
    });

    it("should redact multiple PII instances", () => {
      const input =
        "From: john@email.com, Phone: 555-111-2222, Alt: jane@work.org";
      const result = scrubPII(input);
      expect(result).not.toContain("john@email.com");
      expect(result).not.toContain("jane@work.org");
      expect(result).not.toContain("555-111-2222");
    });

    it("should leave non-PII text unchanged", () => {
      const input = "Your electricity bill is 1500 THB due on March 15";
      const result = scrubPII(input);
      expect(result).toBe(input);
    });
  });
});
