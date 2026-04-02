import { createDashboardService } from "../../src/services/dashboardService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense } from "../../src/types/expense";
import type { ExpenseCategory } from "../../src/types/api";
import type { User } from "../../src/types/user";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: `exp-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    category: "electricity" as ExpenseCategory,
    amount: 100,
    currency: "THB",
    dueDate: "2025-03-15T00:00:00.000Z",
    isPaid: false,
    extractedVia: "manual",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function freshService() {
  const store = createInMemoryStore<Expense>();
  const userStore = createInMemoryStore<User>();
  const svc = createDashboardService({ expenseStore: store, userStore });
  return { svc, store, userStore };
}

// ---------------------------------------------------------------------------
// getDashboardData — monthly total & category breakdown
// ---------------------------------------------------------------------------
describe("DashboardService.getDashboardData", () => {
  it("returns zero totals when user has no expenses", async () => {
    const { svc } = freshService();
    const result = await svc.getDashboardData("user-1", "2025-03");

    expect(result.error).toBeNull();
    expect(result.data!.monthlyTotal).toBe(0);
    expect(result.data!.categoryBreakdown).toEqual([]);
    expect(result.data!.monthlyHistory).toHaveLength(6);
  });

  it("computes monthly total for the target month only", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ amount: 200, dueDate: "2025-03-10T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ amount: 300, dueDate: "2025-03-20T00:00:00.000Z" }));
    await store.set("e3", makeExpense({ amount: 500, dueDate: "2025-02-15T00:00:00.000Z" }));

    const result = await svc.getDashboardData("user-1", "2025-03");
    expect(result.data!.monthlyTotal).toBe(500);
  });

  it("scopes data to the authenticated userId", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ userId: "user-1", amount: 100, dueDate: "2025-03-10T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ userId: "user-2", amount: 999, dueDate: "2025-03-10T00:00:00.000Z" }));

    const result = await svc.getDashboardData("user-1", "2025-03");
    expect(result.data!.monthlyTotal).toBe(100);
  });

  it("groups expenses by category with correct percentages", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ category: "electricity", amount: 300, dueDate: "2025-03-01T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ category: "water", amount: 100, dueDate: "2025-03-05T00:00:00.000Z" }));
    await store.set("e3", makeExpense({ category: "electricity", amount: 100, dueDate: "2025-03-10T00:00:00.000Z" }));

    const result = await svc.getDashboardData("user-1", "2025-03");
    const breakdown = result.data!.categoryBreakdown;

    expect(breakdown).toHaveLength(2);

    const elec = breakdown.find((b) => b.category === "electricity")!;
    expect(elec.amount).toBe(400);
    expect(elec.percentage).toBe(80);

    const water = breakdown.find((b) => b.category === "water")!;
    expect(water.amount).toBe(100);
    expect(water.percentage).toBe(20);
  });

  it("category amounts sum equals monthlyTotal (Property 9 invariant)", async () => {
    const { svc, store } = freshService();
    const categories: ExpenseCategory[] = ["electricity", "water", "insurance", "loan", "gas", "manual"];
    for (let i = 0; i < 10; i++) {
      await store.set(`e${i}`, makeExpense({
        category: categories[i % categories.length],
        amount: 50 + i * 13.37,
        dueDate: "2025-03-15T00:00:00.000Z",
      }));
    }

    const result = await svc.getDashboardData("user-1", "2025-03");
    const catSum = result.data!.categoryBreakdown.reduce((s, b) => s + b.amount, 0);
    expect(Math.round(catSum * 100) / 100).toBe(result.data!.monthlyTotal);
  });
});

// ---------------------------------------------------------------------------
// getDashboardData — monthly history (bar chart)
// ---------------------------------------------------------------------------
describe("DashboardService.getDashboardData — monthlyHistory", () => {
  it("returns exactly 6 months of history ending at target month", async () => {
    const { svc } = freshService();
    const result = await svc.getDashboardData("user-1", "2025-06");

    expect(result.data!.monthlyHistory).toHaveLength(6);
    expect(result.data!.monthlyHistory[0].month).toBe("2025-01");
    expect(result.data!.monthlyHistory[5].month).toBe("2025-06");
  });

  it("handles year boundary correctly", async () => {
    const { svc } = freshService();
    const result = await svc.getDashboardData("user-1", "2025-02");

    const months = result.data!.monthlyHistory.map((h) => h.month);
    expect(months).toEqual([
      "2024-09", "2024-10", "2024-11", "2024-12", "2025-01", "2025-02",
    ]);
  });

  it("aggregates totals per month correctly", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ amount: 100, dueDate: "2025-01-10T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ amount: 200, dueDate: "2025-01-20T00:00:00.000Z" }));
    await store.set("e3", makeExpense({ amount: 150, dueDate: "2025-03-05T00:00:00.000Z" }));

    const result = await svc.getDashboardData("user-1", "2025-03");
    const jan = result.data!.monthlyHistory.find((h) => h.month === "2025-01")!;
    const feb = result.data!.monthlyHistory.find((h) => h.month === "2025-02")!;
    const mar = result.data!.monthlyHistory.find((h) => h.month === "2025-03")!;

    expect(jan.total).toBe(300);
    expect(feb.total).toBe(0);
    expect(mar.total).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// getDashboardData — defaults to current month
// ---------------------------------------------------------------------------
describe("DashboardService.getDashboardData — default month", () => {
  it("uses current month when no month parameter is provided", async () => {
    const { svc } = freshService();
    const result = await svc.getDashboardData("user-1");

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    // The last entry in monthlyHistory should be the current month
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = result.data!.monthlyHistory[5].month;
    expect(lastMonth).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getExpensesByCategory
// ---------------------------------------------------------------------------
describe("DashboardService.getExpensesByCategory", () => {
  it("returns only expenses matching the given category", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ category: "electricity", amount: 200, dueDate: "2025-03-10T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ category: "water", amount: 100, dueDate: "2025-03-15T00:00:00.000Z" }));
    await store.set("e3", makeExpense({ category: "electricity", amount: 150, dueDate: "2025-04-01T00:00:00.000Z" }));

    const result = await svc.getExpensesByCategory("user-1", "electricity");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data!.every((e) => e.category === "electricity")).toBe(true);
  });

  it("returns empty array when no expenses match the category", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ category: "electricity", amount: 200 }));

    const result = await svc.getExpensesByCategory("user-1", "water");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("scopes results to the authenticated userId", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ userId: "user-1", category: "gas", amount: 50 }));
    await store.set("e2", makeExpense({ userId: "user-2", category: "gas", amount: 999 }));

    const result = await svc.getExpensesByCategory("user-1", "gas");
    expect(result.data).toHaveLength(1);
    expect(result.data![0].amount).toBe(50);
  });

  it("returns all matching records across different months", async () => {
    const { svc, store } = freshService();
    await store.set("e1", makeExpense({ category: "insurance", amount: 300, dueDate: "2025-01-15T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ category: "insurance", amount: 300, dueDate: "2025-02-15T00:00:00.000Z" }));
    await store.set("e3", makeExpense({ category: "insurance", amount: 300, dueDate: "2025-03-15T00:00:00.000Z" }));
    await store.set("e4", makeExpense({ category: "water", amount: 100, dueDate: "2025-03-15T00:00:00.000Z" }));

    const result = await svc.getExpensesByCategory("user-1", "insurance");
    expect(result.data).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getDashboardData — expenseRatio (Req 3.4, 6.5)
// ---------------------------------------------------------------------------
describe("DashboardService.getDashboardData — expenseRatio", () => {
  it("returns null expenseRatio when user has no monthlyIncome (Req 6.5)", async () => {
    const { svc, userStore } = freshService();
    await userStore.set("user-1", {
      id: "user-1",
      email: "test@example.com",
      monthlyIncome: null,
      createdAt: new Date().toISOString(),
    });

    const result = await svc.getDashboardData("user-1", "2025-03");
    expect(result.error).toBeNull();
    expect(result.data!.expenseRatio).toBeNull();
  });

  it("returns null expenseRatio when user does not exist", async () => {
    const { svc } = freshService();
    const result = await svc.getDashboardData("nonexistent-user", "2025-03");
    expect(result.data!.expenseRatio).toBeNull();
  });

  it("returns expenseRatio data when user has monthlyIncome set", async () => {
    const { svc, store, userStore } = freshService();
    await userStore.set("user-1", {
      id: "user-1",
      email: "test@example.com",
      monthlyIncome: 50000,
      createdAt: new Date().toISOString(),
    });
    await store.set("e1", makeExpense({ amount: 15000, dueDate: "2025-03-10T00:00:00.000Z" }));
    await store.set("e2", makeExpense({ amount: 10000, category: "water", dueDate: "2025-03-15T00:00:00.000Z" }));

    const result = await svc.getDashboardData("user-1", "2025-03");
    const ratio = result.data!.expenseRatio;

    expect(ratio).not.toBeNull();
    expect(ratio!.skipped).toBe(false);
    expect(ratio!.ratio).not.toBeNull();
    expect(ratio!.ratio!.totalExpense).toBe(25000);
    expect(ratio!.ratio!.totalIncome).toBe(50000);
    expect(ratio!.ratio!.ratio).toBe(0.5);
    expect(ratio!.ratio!.isHealthy).toBe(true);
  });

  it("returns unhealthy ratio with suggestions when ratio > 0.7", async () => {
    const { svc, store, userStore } = freshService();
    await userStore.set("user-1", {
      id: "user-1",
      email: "test@example.com",
      monthlyIncome: 30000,
      createdAt: new Date().toISOString(),
    });
    await store.set("e1", makeExpense({ amount: 25000, dueDate: "2025-03-10T00:00:00.000Z" }));

    const result = await svc.getDashboardData("user-1", "2025-03");
    const ratio = result.data!.expenseRatio;

    expect(ratio).not.toBeNull();
    expect(ratio!.ratio!.ratio).toBeCloseTo(0.83, 1);
    expect(ratio!.ratio!.isHealthy).toBe(false);
    expect(ratio!.suggestions.length).toBeGreaterThan(0);
  });
});
