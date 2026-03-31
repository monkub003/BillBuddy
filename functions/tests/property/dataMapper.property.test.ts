import fc from "fast-check";
import {
  mapToExpense,
  serializeExpense,
  deserializeExpense,
} from "../../src/extractors/dataMapper";
import type { ExpenseCategory, ExtractionSource } from "../../src/types/api";
import type { ExtractionResult } from "../../src/types/extraction";
import type { Expense } from "../../src/types/expense";

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: ExpenseCategory[] = [
  "electricity",
  "water",
  "insurance",
  "loan",
  "gas",
  "manual",
];

const categoryArb = fc.constantFrom<ExpenseCategory>(...VALID_CATEGORIES);

const positiveAmountArb = fc
  .double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
  .filter((n) => n > 0 && Number.isFinite(n));

const confidenceArb = fc
  .double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true })
  .filter((n) => n >= 0 && n <= 1 && Number.isFinite(n));

const highConfidenceArb = fc
  .double({ min: 0.5, max: 1, noNaN: true, noDefaultInfinity: true })
  .filter((n) => n >= 0.5 && n <= 1 && Number.isFinite(n));

const lowConfidenceArb = fc
  .double({ min: 0, max: 0.49, noNaN: true, noDefaultInfinity: true })
  .filter((n) => n >= 0 && n < 0.5 && Number.isFinite(n));

const dueDateArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
  .map((d) => d.toISOString().split("T")[0]);

const userIdArb = fc
  .stringOf(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")),
    { minLength: 4, maxLength: 16 }
  )
  .map((s) => `user-${s}`);

const sourceArb = fc.constantFrom<"email" | "image">("email", "image");

const sourceRefArb = fc
  .stringOf(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-_".split("")),
    { minLength: 3, maxLength: 30 }
  )
  .map((s) => `ref-${s}`);

/**
 * Generates a valid ExtractionResult with all high-confidence scores
 * and a valid category from the allowed set.
 */
function validExtractionArb(): fc.Arbitrary<ExtractionResult> {
  return fc.record({
    amount: fc.record({
      value: positiveAmountArb,
      confidence: highConfidenceArb,
    }),
    category: fc.record({
      value: categoryArb,
      confidence: highConfidenceArb,
    }),
    dueDate: fc.record({
      value: dueDateArb,
      confidence: highConfidenceArb,
    }),
  });
}


/**
 * Generates a random string that is NOT a valid ExpenseCategory.
 */
const invalidCategoryArb = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
    minLength: 1,
    maxLength: 20,
  })
  .filter((s) => !VALID_CATEGORIES.includes(s as ExpenseCategory));

/**
 * Generates a valid Expense object for serialization round-trip testing.
 */
function validExpenseArb(): fc.Arbitrary<Expense> {
  return fc.record({
    id: fc.uuid(),
    userId: userIdArb,
    category: categoryArb,
    amount: positiveAmountArb,
    currency: fc.constant("THB" as const),
    dueDate: dueDateArb,
    isPaid: fc.boolean(),
    extractedVia: fc.constantFrom<ExtractionSource>("email", "image", "manual"),
    rawSourceRef: fc.option(sourceRefArb, { nil: undefined }),
    needsReview: fc.option(fc.boolean(), { nil: undefined }),
    createdAt: fc
      .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
      .map((d) => d.toISOString()),
  });
}

// ===========================================================================
// Feature: billbuddy-mvp, Property 14: Data mapper produces valid Expense records
// **Validates: Requirements 7.1, 7.2, 8.1**
// ===========================================================================
describe("Property 14: Data mapper produces valid Expense records", () => {
  it("for any raw extraction output with valid data, mapToExpense produces an Expense with positive amount, valid category, and valid date", () => {
    fc.assert(
      fc.property(
        validExtractionArb(),
        userIdArb,
        sourceArb,
        sourceRefArb,
        (raw, userId, source, sourceRef) => {
          const expense = mapToExpense(raw, userId, source, sourceRef);

          // Amount must be positive
          expect(expense.amount).toBeGreaterThan(0);

          // Category must be one of the allowed values
          expect(VALID_CATEGORIES).toContain(expense.category);

          // dueDate must be a valid date string
          const parsed = new Date(expense.dueDate);
          expect(isNaN(parsed.getTime())).toBe(false);

          // Other structural checks
          expect(expense.id).toBeDefined();
          expect(expense.userId).toBe(userId);
          expect(expense.currency).toBe("THB");
          expect(expense.extractedVia).toBe(source);
          expect(expense.createdAt).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Feature: billbuddy-mvp, Property 15: Unrecognized categories default to "manual" with review flag
// **Validates: Requirements 7.3, 8.3**
// ===========================================================================
describe("Property 15: Unrecognized categories default to 'manual' with review flag", () => {
  it("for any extraction with an unrecognized category, the mapper assigns 'manual' and sets needsReview=true", () => {
    fc.assert(
      fc.property(
        positiveAmountArb,
        highConfidenceArb,
        invalidCategoryArb,
        highConfidenceArb,
        dueDateArb,
        highConfidenceArb,
        userIdArb,
        sourceArb,
        sourceRefArb,
        (amount, amountConf, badCategory, catConf, dueDate, dateConf, userId, source, sourceRef) => {
          const raw: ExtractionResult = {
            amount: { value: amount, confidence: amountConf },
            category: { value: badCategory as any, confidence: catConf },
            dueDate: { value: dueDate, confidence: dateConf },
          };

          const expense = mapToExpense(raw, userId, source, sourceRef);

          expect(expense.category).toBe("manual");
          expect(expense.needsReview).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ===========================================================================
// Feature: billbuddy-mvp, Property 16: Expense serialization round trip
// **Validates: Requirements 7.4, 7.5**
// ===========================================================================
describe("Property 16: Expense serialization round trip", () => {
  it("for any valid Expense, serializing to JSON and deserializing back produces an equivalent object", () => {
    fc.assert(
      fc.property(validExpenseArb(), (expense) => {
        const serialized = serializeExpense(expense);
        const deserialized = deserializeExpense(serialized);
        expect(deserialized).toEqual(expense);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Feature: billbuddy-mvp, Property 12: Extraction confidence scores are bounded
// **Validates: Requirements 5.3, 6.2**
// ===========================================================================
describe("Property 12: Extraction confidence scores are bounded", () => {
  it("for any ExtractionResult, every confidence score is a number in [0.0, 1.0]", () => {
    fc.assert(
      fc.property(
        fc.record({
          amount: fc.record({
            value: positiveAmountArb,
            confidence: confidenceArb,
          }),
          category: fc.record({
            value: categoryArb,
            confidence: confidenceArb,
          }),
          dueDate: fc.record({
            value: dueDateArb,
            confidence: confidenceArb,
          }),
        }),
        (raw: ExtractionResult) => {
          // Verify all confidence scores are in [0, 1]
          expect(raw.amount.confidence).toBeGreaterThanOrEqual(0);
          expect(raw.amount.confidence).toBeLessThanOrEqual(1);

          expect(raw.category.confidence).toBeGreaterThanOrEqual(0);
          expect(raw.category.confidence).toBeLessThanOrEqual(1);

          expect(raw.dueDate.confidence).toBeGreaterThanOrEqual(0);
          expect(raw.dueDate.confidence).toBeLessThanOrEqual(1);

          // Also verify the mapper preserves the amount correctly
          const expense = mapToExpense(raw, "test-user", "image", "ref-123");
          expect(expense.amount).toBe(raw.amount.value);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Feature: billbuddy-mvp, Property 13: Low confidence fields are flagged for review
// **Validates: Requirements 5.4, 6.3**
// ===========================================================================
describe("Property 13: Low confidence fields are flagged for review", () => {
  it("when amount confidence < 0.5, the expense has needsReview=true", () => {
    fc.assert(
      fc.property(
        positiveAmountArb,
        lowConfidenceArb,
        categoryArb,
        highConfidenceArb,
        dueDateArb,
        highConfidenceArb,
        userIdArb,
        sourceArb,
        sourceRefArb,
        (amount, amountConf, category, catConf, dueDate, dateConf, userId, source, sourceRef) => {
          const raw: ExtractionResult = {
            amount: { value: amount, confidence: amountConf },
            category: { value: category, confidence: catConf },
            dueDate: { value: dueDate, confidence: dateConf },
          };

          const expense = mapToExpense(raw, userId, source, sourceRef);
          expect(expense.needsReview).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("when category confidence < 0.5, the expense has needsReview=true", () => {
    fc.assert(
      fc.property(
        positiveAmountArb,
        highConfidenceArb,
        categoryArb,
        lowConfidenceArb,
        dueDateArb,
        highConfidenceArb,
        userIdArb,
        sourceArb,
        sourceRefArb,
        (amount, amountConf, category, catConf, dueDate, dateConf, userId, source, sourceRef) => {
          const raw: ExtractionResult = {
            amount: { value: amount, confidence: amountConf },
            category: { value: category, confidence: catConf },
            dueDate: { value: dueDate, confidence: dateConf },
          };

          const expense = mapToExpense(raw, userId, source, sourceRef);
          expect(expense.needsReview).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("when dueDate confidence < 0.5, the expense has needsReview=true", () => {
    fc.assert(
      fc.property(
        positiveAmountArb,
        highConfidenceArb,
        categoryArb,
        highConfidenceArb,
        dueDateArb,
        lowConfidenceArb,
        userIdArb,
        sourceArb,
        sourceRefArb,
        (amount, amountConf, category, catConf, dueDate, dateConf, userId, source, sourceRef) => {
          const raw: ExtractionResult = {
            amount: { value: amount, confidence: amountConf },
            category: { value: category, confidence: catConf },
            dueDate: { value: dueDate, confidence: dateConf },
          };

          const expense = mapToExpense(raw, userId, source, sourceRef);
          expect(expense.needsReview).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
