import fc from "fast-check";
import { createExpenseService } from "../../src/services/expenseService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense, CreateExpenseInput } from "../../src/types/expense";
import type { ExpenseCategory, ExtractionSource } from "../../src/types/api";

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

const positiveAmountArb = fc.double({
  min: 0.01,
  max: 1_000_000,
  noNaN: true,
  noDefaultInfinity: true,
}).filter((n) => n > 0 && Number.isFinite(n));

const dueDateArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
  .map((d) => d.toISOString());

const userIdArb = fc.stringOf(
  fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")),
  { minLength: 4, maxLength: 16 }
).map((s) => `user-${s}`);

function freshService() {
  return createExpenseService({
    expenseStore: createInMemoryStore<Expense>(),
  });
}

function makeValidInput(overrides?: Partial<CreateExpenseInput>): fc.Arbitrary<CreateExpenseInput> {
  return fc.record({
    category: categoryArb,
    amount: positiveAmountArb,
    dueDate: dueDateArb,
    isPaid: fc.boolean(),
    extractedVia: fc.constant<ExtractionSource>("manual"),
  }).map((rec) => ({ ...rec, ...overrides }));
}

// Feature: billbuddy-mvp, Property 9: Extracted_via matches source channel
// **Validates: Requirements 4.1, 5.5, 6.4**
describe("Property 9: Extracted_via matches source channel", () => {
  it("manual entry sets extracted_via to 'manual'", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        categoryArb,
        positiveAmountArb,
        dueDateArb,
        fc.boolean(),
        async (userId, category, amount, dueDate, isPaid) => {
          const svc = freshService();
          const input: CreateExpenseInput = {
            category,
            amount,
            dueDate,
            isPaid,
            extractedVia: "manual",
          };

          const result = await svc.createExpense(userId, input);

          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();
          expect(result.data!.extractedVia).toBe("manual");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("image extraction sets extracted_via to 'image' with rawSourceRef set", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        categoryArb,
        positiveAmountArb,
        dueDateArb,
        fc.boolean(),
        fc.stringOf(
          fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789/-_.".split("")),
          { minLength: 5, maxLength: 60 }
        ).map((s) => `gs://bucket/${s}.jpg`),
        async (userId, category, amount, dueDate, isPaid, rawSourceRef) => {
          const svc = freshService();
          const input: CreateExpenseInput = {
            category,
            amount,
            dueDate,
            isPaid,
            extractedVia: "image",
            rawSourceRef,
          };

          const result = await svc.createExpense(userId, input);

          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();
          expect(result.data!.extractedVia).toBe("image");
          expect(result.data!.rawSourceRef).toBe(rawSourceRef);
          expect(result.data!.rawSourceRef).toBeDefined();
          expect(result.data!.rawSourceRef!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("email extraction sets extracted_via to 'email' with rawSourceRef set", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        categoryArb,
        positiveAmountArb,
        dueDateArb,
        fc.boolean(),
        fc.stringOf(
          fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-".split("")),
          { minLength: 5, maxLength: 40 }
        ).map((s) => `email-${s}`),
        async (userId, category, amount, dueDate, isPaid, rawSourceRef) => {
          const svc = freshService();
          const input: CreateExpenseInput = {
            category,
            amount,
            dueDate,
            isPaid,
            extractedVia: "email",
            rawSourceRef,
          };

          const result = await svc.createExpense(userId, input);

          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();
          expect(result.data!.extractedVia).toBe("email");
          expect(result.data!.rawSourceRef).toBe(rawSourceRef);
          expect(result.data!.rawSourceRef).toBeDefined();
          expect(result.data!.rawSourceRef!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 10: Non-positive amounts are rejected
// **Validates: Requirements 4.3**
describe("Property 10: Non-positive amounts are rejected", () => {
  it("for any expense creation with amount <= 0, the service rejects with 'amount must be positive'", async () => {
    const nonPositiveAmountArb = fc.oneof(
      fc.constant(0),
      fc.integer({ min: -1_000_000, max: -1 }),
      fc.double({ min: -1_000_000, max: 0, noNaN: true, noDefaultInfinity: true })
        .filter((n) => n <= 0 && Number.isFinite(n))
    );

    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        categoryArb,
        nonPositiveAmountArb,
        dueDateArb,
        fc.boolean(),
        async (userId, category, amount, dueDate, isPaid) => {
          const svc = freshService();
          const input: CreateExpenseInput = {
            category,
            amount,
            dueDate,
            isPaid,
            extractedVia: "manual",
          };

          const result = await svc.createExpense(userId, input);

          expect(result.data).toBeNull();
          expect(result.error).toBe("amount must be positive");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 11: Currency is always THB
// **Validates: Requirements 4.4**
describe("Property 11: Currency is always THB", () => {
  it("for any valid expense created, the currency field is always 'THB'", async () => {
    const extractionSourceArb = fc.constantFrom<ExtractionSource>("manual", "image", "email");

    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        categoryArb,
        positiveAmountArb,
        dueDateArb,
        fc.boolean(),
        extractionSourceArb,
        async (userId, category, amount, dueDate, isPaid, extractedVia) => {
          const svc = freshService();
          const input: CreateExpenseInput = {
            category,
            amount,
            dueDate,
            isPaid,
            extractedVia,
            rawSourceRef: extractedVia !== "manual" ? "ref-123" : undefined,
          };

          const result = await svc.createExpense(userId, input);

          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();
          expect(result.data!.currency).toBe("THB");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 8: Data isolation between users
// **Validates: Requirements 3.4, 12.1, 12.2**
describe("Property 8: Data isolation between users", () => {
  it("user A can only see their own expenses and never user B's expenses", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Two distinct user IDs
        userIdArb,
        userIdArb,
        // Expenses for user A (1-3 expenses)
        fc.array(makeValidInput(), { minLength: 1, maxLength: 3 }),
        // Expenses for user B (1-3 expenses)
        fc.array(makeValidInput(), { minLength: 1, maxLength: 3 }),
        async (userA, userB, inputsA, inputsB) => {
          // Ensure distinct users
          fc.pre(userA !== userB);

          const svc = freshService();

          // Create expenses for user A
          for (const input of inputsA) {
            const res = await svc.createExpense(userA, input);
            expect(res.error).toBeNull();
          }

          // Create expenses for user B
          for (const input of inputsB) {
            const res = await svc.createExpense(userB, input);
            expect(res.error).toBeNull();
          }

          // User A should only see their own expenses
          const resultA = await svc.getExpenses(userA);
          expect(resultA.error).toBeNull();
          expect(resultA.data!.length).toBe(inputsA.length);
          expect(resultA.data!.every((e) => e.userId === userA)).toBe(true);

          // User B should only see their own expenses
          const resultB = await svc.getExpenses(userB);
          expect(resultB.error).toBeNull();
          expect(resultB.data!.length).toBe(inputsB.length);
          expect(resultB.data!.every((e) => e.userId === userB)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("user A cannot update user B's expenses", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        userIdArb,
        makeValidInput(),
        async (userA, userB, input) => {
          fc.pre(userA !== userB);

          const svc = freshService();

          // Create expense for user B
          const created = await svc.createExpense(userB, input);
          expect(created.error).toBeNull();
          const expenseId = created.data!.id;

          // User A tries to update user B's expense
          const updateResult = await svc.updateExpense(userA, expenseId, { amount: 999 });
          expect(updateResult.data).toBeNull();
          expect(updateResult.error).toBe("access denied");

          // Verify expense is unchanged
          const original = await svc.getExpenses(userB);
          expect(original.data![0].amount).toBe(input.amount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("user A cannot delete user B's expenses", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        userIdArb,
        makeValidInput(),
        async (userA, userB, input) => {
          fc.pre(userA !== userB);

          const svc = freshService();

          // Create expense for user B
          const created = await svc.createExpense(userB, input);
          expect(created.error).toBeNull();
          const expenseId = created.data!.id;

          // User A tries to delete user B's expense
          const deleteResult = await svc.deleteExpense(userA, expenseId);
          expect(deleteResult.data).toBeNull();
          expect(deleteResult.error).toBe("access denied");

          // Verify expense still exists for user B
          const remaining = await svc.getExpenses(userB);
          expect(remaining.data!.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
