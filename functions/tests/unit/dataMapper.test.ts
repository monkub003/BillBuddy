import {
  mapToExpense,
  validateExpenseData,
  serializeExpense,
  deserializeExpense,
} from "../../src/extractors/dataMapper";
import { ExtractionResult } from "../../src/types/extraction";
import { Expense } from "../../src/types/expense";

describe("Data Mapper", () => {
  const validExtraction: ExtractionResult = {
    amount: { value: 1500, confidence: 0.95 },
    category: { value: "electricity", confidence: 0.9 },
    dueDate: { value: "2025-02-15", confidence: 0.85 },
  };

  describe("mapToExpense", () => {
    it("should map a valid extraction result to an Expense", () => {
      const expense = mapToExpense(validExtraction, "user-1", "image", "storage://img.jpg");

      expect(expense.userId).toBe("user-1");
      expect(expense.category).toBe("electricity");
      expect(expense.amount).toBe(1500);
      expect(expense.currency).toBe("THB");
      expect(expense.dueDate).toBe("2025-02-15");
      expect(expense.isPaid).toBe(false);
      expect(expense.extractedVia).toBe("image");
      expect(expense.rawSourceRef).toBe("storage://img.jpg");
      expect(expense.needsReview).toBe(false);
      expect(expense.id).toBeDefined();
      expect(expense.createdAt).toBeDefined();
    });

    it("should set needsReview=true when amount confidence < 0.5", () => {
      const raw: ExtractionResult = {
        ...validExtraction,
        amount: { value: 100, confidence: 0.3 },
      };
      const expense = mapToExpense(raw, "user-1", "email", "email-123");
      expect(expense.needsReview).toBe(true);
    });

    it("should set needsReview=true when category confidence < 0.5", () => {
      const raw: ExtractionResult = {
        ...validExtraction,
        category: { value: "water", confidence: 0.4 },
      };
      const expense = mapToExpense(raw, "user-1", "image", "ref");
      expect(expense.needsReview).toBe(true);
    });

    it("should set needsReview=true when dueDate confidence < 0.5", () => {
      const raw: ExtractionResult = {
        ...validExtraction,
        dueDate: { value: "2025-03-01", confidence: 0.1 },
      };
      const expense = mapToExpense(raw, "user-1", "image", "ref");
      expect(expense.needsReview).toBe(true);
    });

    it("should default unrecognized category to 'manual' with needsReview=true", () => {
      const raw: ExtractionResult = {
        ...validExtraction,
        category: { value: "telecom" as any, confidence: 0.9 },
      };
      const expense = mapToExpense(raw, "user-1", "image", "ref");
      expect(expense.category).toBe("manual");
      expect(expense.needsReview).toBe(true);
    });

    it("should set extractedVia to 'email' for email source", () => {
      const expense = mapToExpense(validExtraction, "user-1", "email", "email-ref");
      expect(expense.extractedVia).toBe("email");
    });
  });

  describe("validateExpenseData", () => {
    it("should return valid for correct data", () => {
      const result = validateExpenseData({
        amount: 100,
        category: "water",
        dueDate: "2025-06-01",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-positive amount", () => {
      const result = validateExpenseData({ amount: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("amount must be positive");
    });

    it("should reject negative amount", () => {
      const result = validateExpenseData({ amount: -5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("amount must be positive");
    });

    it("should reject invalid category", () => {
      const result = validateExpenseData({ category: "telecom" as any });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("invalid category");
      expect(result.needsReview).toBe(true);
    });

    it("should reject invalid dueDate", () => {
      const result = validateExpenseData({ dueDate: "not-a-date" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("invalid due date");
    });

    it("should collect multiple errors", () => {
      const result = validateExpenseData({
        amount: -1,
        category: "unknown" as any,
        dueDate: "bad",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("serializeExpense / deserializeExpense", () => {
    it("should round-trip a valid Expense", () => {
      const expense: Expense = {
        id: "abc-123",
        userId: "user-1",
        category: "gas",
        amount: 250.5,
        currency: "THB",
        dueDate: "2025-04-10",
        isPaid: true,
        extractedVia: "manual",
        needsReview: false,
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      const json = serializeExpense(expense);
      const restored = deserializeExpense(json);
      expect(restored).toEqual(expense);
    });

    it("should preserve optional rawSourceRef in round-trip", () => {
      const expense: Expense = {
        id: "def-456",
        userId: "user-2",
        category: "insurance",
        amount: 5000,
        currency: "THB",
        dueDate: "2025-05-20",
        isPaid: false,
        extractedVia: "image",
        rawSourceRef: "storage://receipt.png",
        needsReview: true,
        createdAt: "2025-02-15T12:00:00.000Z",
      };

      const json = serializeExpense(expense);
      const restored = deserializeExpense(json);
      expect(restored).toEqual(expense);
    });
  });
});
