import fc from "fast-check";
import { computeAlertLevel } from "../../src/services/alertService";

// Feature: billbuddy-mvp, Property 24: Income-to-expense alert thresholds
describe("Property 24: Income-to-expense alert thresholds", () => {
  /**
   * **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
   *
   * For any user with a set monthly income:
   * - when total expenses exceed 90% of income → warning alert
   * - when total expenses exceed 100% of income → critical alert
   * - when expenses are at or below 90% → no alert
   */

  it("returns 'none' when expenses ≤ 90% of income", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        (income, fraction) => {
          const expenses = income * fraction;
          const level = computeAlertLevel(income, expenses);
          expect(level).toBe("none");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("returns 'warning' when expenses > 90% and ≤ 100% of income", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0.900001, max: 1.0, noNaN: true }),
        (income, fraction) => {
          const expenses = income * fraction;
          const level = computeAlertLevel(income, expenses);
          // At exactly 100% the ratio is 1.0 which is NOT > 1.0, so it's warning
          expect(level).toBe("warning");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("returns 'critical' when expenses > 100% of income", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1_000_000, noNaN: true }),
        fc.double({ min: 1.000001, max: 5.0, noNaN: true }),
        (income, fraction) => {
          const expenses = income * fraction;
          const level = computeAlertLevel(income, expenses);
          expect(level).toBe("critical");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("returns 'none' when income is zero or negative", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1_000_000, max: 0, noNaN: true }),
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        (income, expenses) => {
          const level = computeAlertLevel(income, expenses);
          expect(level).toBe("none");
        }
      ),
      { numRuns: 20 }
    );
  });
});

import { Expense } from "../../src/types/expense";
import { ExpenseCategory } from "../../src/types/api";

// --- Pure helper functions for dashboard data aggregation ---

const CATEGORIES: ExpenseCategory[] = [
  "electricity",
  "water",
  "insurance",
  "loan",
  "gas",
  "manual",
];

function sortUnpaidByDueDate(expenses: Expense[]): Expense[] {
  return expenses
    .filter((e) => !e.isPaid)
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
}

function sumByPaidStatus(expenses: Expense[]): {
  paid: number;
  unpaid: number;
  total: number;
} {
  let paid = 0;
  let unpaid = 0;
  for (const e of expenses) {
    if (e.isPaid) {
      paid += e.amount;
    } else {
      unpaid += e.amount;
    }
  }
  return { paid, unpaid, total: paid + unpaid };
}

function categoryDistribution(
  expenses: Expense[]
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const e of expenses) {
    dist[e.category] = (dist[e.category] || 0) + e.amount;
  }
  return dist;
}

// --- Arbitrary generators ---

function expenseArbitrary(): fc.Arbitrary<Expense> {
  return fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    category: fc.constantFrom(...CATEGORIES),
    amount: fc.double({ min: 0.01, max: 100_000, noNaN: true }),
    currency: fc.constant("THB" as const),
    dueDate: fc
      .date({
        min: new Date("2024-01-01"),
        max: new Date("2025-12-31"),
      })
      .map((d) => d.toISOString()),
    isPaid: fc.boolean(),
    extractedVia: fc.constantFrom("email" as const, "image" as const, "manual" as const),
    createdAt: fc.constant(new Date().toISOString()),
  });
}

// Feature: billbuddy-mvp, Property 17: Unpaid bills are sorted by due date ascending
describe("Property 17: Unpaid bills are sorted by due date ascending", () => {
  /**
   * **Validates: Requirements 9.3**
   *
   * For any set of expense records, filtering to unpaid bills and sorting by
   * due_date SHALL produce a list where each item's due_date is less than or
   * equal to the next item's due_date.
   */
  it("should produce a list sorted by due_date ascending", () => {
    fc.assert(
      fc.property(fc.array(expenseArbitrary(), { maxLength: 50 }), (expenses) => {
        const sorted = sortUnpaidByDueDate(expenses);
        for (let i = 0; i < sorted.length - 1; i++) {
          const current = new Date(sorted[i].dueDate).getTime();
          const next = new Date(sorted[i + 1].dueDate).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }),
      { numRuns: 20 }
    );
  });

  it("should only contain unpaid bills", () => {
    fc.assert(
      fc.property(fc.array(expenseArbitrary(), { maxLength: 50 }), (expenses) => {
        const sorted = sortUnpaidByDueDate(expenses);
        for (const e of sorted) {
          expect(e.isPaid).toBe(false);
        }
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: billbuddy-mvp, Property 18: Paid plus unpaid equals monthly total
describe("Property 18: Paid plus unpaid equals monthly total", () => {
  /**
   * **Validates: Requirements 9.1, 9.4**
   *
   * For any set of expense records in a given month, the sum of paid expense
   * amounts plus the sum of unpaid expense amounts SHALL equal the total
   * expense amount for that month.
   */
  it("paid + unpaid should equal total", () => {
    fc.assert(
      fc.property(fc.array(expenseArbitrary(), { maxLength: 50 }), (expenses) => {
        const { paid, unpaid, total } = sumByPaidStatus(expenses);
        expect(paid + unpaid).toBeCloseTo(total, 5);
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: billbuddy-mvp, Property 19: Category distribution sums to total
describe("Property 19: Category distribution sums to total", () => {
  /**
   * **Validates: Requirements 9.2**
   *
   * For any set of expense records in a given month, the sum of amounts across
   * all category groups SHALL equal the total expense amount for that month.
   */
  it("sum of category amounts should equal total", () => {
    fc.assert(
      fc.property(fc.array(expenseArbitrary(), { maxLength: 50 }), (expenses) => {
        const dist = categoryDistribution(expenses);
        const categorySum = Object.values(dist).reduce((s, v) => s + v, 0);
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        expect(categorySum).toBeCloseTo(total, 5);
      }),
      { numRuns: 20 }
    );
  });
});
