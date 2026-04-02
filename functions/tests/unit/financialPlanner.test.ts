import { createFinancialPlanner } from "../../src/services/financialPlanner";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Budget } from "../../src/types/budget";
import type { Expense } from "../../src/types/expense";
import type { User } from "../../src/types/user";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: `exp-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    category: "electricity",
    amount: 1000,
    currency: "THB",
    dueDate: "2024-03-15T00:00:00.000Z",
    isPaid: false,
    extractedVia: "manual",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.com",
    monthlyIncome: 50000,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function seedExpenses(
  store: ReturnType<typeof createInMemoryStore<Expense>>,
  expenses: Partial<Expense>[]
) {
  for (const e of expenses) {
    const expense = makeExpense(e);
    await store.set(expense.id, expense);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FinancialPlanner", () => {
  describe("calculateExpenseRatio", () => {
    it("returns skipped when user does not exist", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const planner = createFinancialPlanner({ expenseStore, userStore });

      const result = await planner.calculateExpenseRatio("nonexistent", "2024-03");

      expect(result.skipped).toBe(true);
      expect(result.ratio).toBeNull();
      expect(result.suggestions).toEqual([]);
    });

    it("returns skipped when monthlyIncome is null (Req 6.5)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const user = makeUser({ monthlyIncome: null });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.skipped).toBe(true);
      expect(result.ratio).toBeNull();
      expect(result.suggestions).toEqual([]);
    });

    it("calculates correct ratio for a given month (Req 6.2)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-03-10T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 500, dueDate: "2024-03-15T00:00:00.000Z" },
        { userId: "user-1", category: "gas", amount: 1500, dueDate: "2024-03-20T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.skipped).toBe(false);
      expect(result.ratio).not.toBeNull();
      expect(result.ratio!.totalExpense).toBe(5000);
      expect(result.ratio!.totalIncome).toBe(50000);
      expect(result.ratio!.ratio).toBe(0.1);
      expect(result.ratio!.isHealthy).toBe(true);
      expect(result.ratio!.month).toBe("2024-03");
    });

    it("sets isHealthy to true when ratio <= 0.7", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 10000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 7000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.ratio).toBe(0.7);
      expect(result.ratio!.isHealthy).toBe(true);
    });

    it("sets isHealthy to false when ratio > 0.7 (Req 6.3)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 10000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 7100, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.ratio).toBeGreaterThan(0.7);
      expect(result.ratio!.isHealthy).toBe(false);
    });

    it("generates cost reduction suggestions when unhealthy (Req 6.3)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 10000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 5000, dueDate: "2024-03-10T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 3000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.isHealthy).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);

      for (const s of result.suggestions) {
        expect(s.suggestedBudget).toBeLessThan(s.currentAverage);
        expect(s.potentialSaving).toBeGreaterThan(0);
        expect(s.reason).toBeTruthy();
      }
    });

    it("does not generate suggestions when healthy", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 100000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 5000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.isHealthy).toBe(true);
      expect(result.suggestions).toEqual([]);
    });

    it("builds correct category breakdown with percentages", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-03-10T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
        { userId: "user-1", category: "gas", amount: 1000, dueDate: "2024-03-20T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      const breakdown = result.ratio!.categoryBreakdown;
      expect(breakdown.length).toBe(3);

      const elec = breakdown.find((b) => b.category === "electricity");
      expect(elec).toBeDefined();
      expect(elec!.amount).toBe(3000);
      expect(elec!.percentage).toBe(60); // 3000/5000 * 100

      const water = breakdown.find((b) => b.category === "water");
      expect(water!.percentage).toBe(20); // 1000/5000 * 100

      // Sum of percentages should be 100
      const totalPct = breakdown.reduce((sum, b) => sum + b.percentage, 0);
      expect(totalPct).toBe(100);
    });

    it("only includes expenses for the specified month", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 3000, dueDate: "2024-02-15T00:00:00.000Z" }, // Feb
        { userId: "user-1", amount: 5000, dueDate: "2024-03-15T00:00:00.000Z" }, // Mar
        { userId: "user-1", amount: 4000, dueDate: "2024-04-15T00:00:00.000Z" }, // Apr
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.totalExpense).toBe(5000);
    });

    it("only includes expenses for the specified user", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ id: "user-1", monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 2000, dueDate: "2024-03-15T00:00:00.000Z" },
        { userId: "user-2", amount: 9000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.totalExpense).toBe(2000);
    });

    it("returns zero ratio when no expenses exist for the month", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.totalExpense).toBe(0);
      expect(result.ratio!.ratio).toBe(0);
      expect(result.ratio!.isHealthy).toBe(true);
      expect(result.ratio!.categoryBreakdown).toEqual([]);
    });

    it("handles ratio > 1.0 when expenses exceed income", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 10000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 15000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.ratio!.ratio).toBe(1.5);
      expect(result.ratio!.isHealthy).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("suggestions are sorted by amount descending (highest first)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 10000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "water", amount: 1000, dueDate: "2024-03-10T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 5000, dueDate: "2024-03-15T00:00:00.000Z" },
        { userId: "user-1", category: "gas", amount: 2000, dueDate: "2024-03-20T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const result = await planner.calculateExpenseRatio("user-1", "2024-03");

      expect(result.suggestions[0].category).toBe("electricity");
      expect(result.suggestions[1].category).toBe("gas");
      expect(result.suggestions[2].category).toBe("water");
    });
  });

  describe("generateBudgetPlan", () => {
    it("generates a budget plan with historical averages per category (Req 7.1)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      // Seed 2 months of expenses so prediction engine has enough data (>30 days)
      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 500, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 3500, dueDate: "2024-02-15T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 600, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const plan = await planner.generateBudgetPlan("user-1");

      expect(plan.totalBudget).toBeGreaterThan(0);
      expect(plan.byCategory.length).toBe(2);
      expect(plan.savingsTarget).toBeNull();
      expect(plan.lastUpdated).toBeTruthy();

      // Every active category should be covered
      const categories = plan.byCategory.map((c) => c.category);
      expect(categories).toContain("electricity");
      expect(categories).toContain("water");

      // Sum of category budgets should equal totalBudget
      const catSum = plan.byCategory.reduce((s, c) => s + c.budgetAmount, 0);
      expect(Math.abs(catSum - plan.totalBudget)).toBeLessThan(0.02);
    });

    it("returns a plan with zero budget when user has no expenses", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const plan = await planner.generateBudgetPlan("user-1");

      expect(plan.totalBudget).toBe(0);
      expect(plan.byCategory).toEqual([]);
    });

    it("persists the budget record in budgetStore", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "gas", amount: 2000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "gas", amount: 2200, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const plan = await planner.generateBudgetPlan("user-1");

      const allBudgets = await budgetStore.getAll();
      expect(allBudgets.length).toBe(1);
      expect(allBudgets[0].userId).toBe("user-1");
      expect(allBudgets[0].totalBudget).toBe(plan.totalBudget);
    });
  });

  describe("calculateBudgetFromSavingsGoal", () => {
    it("ensures totalBudget ≤ income - savingsGoal (Req 7.4)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 30000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 32000, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const savingsGoal = 20000;
      const plan = await planner.calculateBudgetFromSavingsGoal("user-1", savingsGoal);

      expect(plan.totalBudget).toBeLessThanOrEqual(50000 - savingsGoal);
      expect(plan.savingsTarget).toBe(savingsGoal);
    });

    it("returns zero budget when savingsGoal >= income", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const plan = await planner.calculateBudgetFromSavingsGoal("user-1", 50000);

      expect(plan.totalBudget).toBe(0);
      expect(plan.byCategory).toEqual([]);
      expect(plan.savingsTarget).toBe(50000);
    });

    it("marks category basedOn as savings_goal when scaled down", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      // Historical spending exceeds what's left after savings
      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 25000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 20000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 25000, dueDate: "2024-02-15T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 20000, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const plan = await planner.calculateBudgetFromSavingsGoal("user-1", 30000);

      // Max budget = 50000 - 30000 = 20000, but historical is ~45000
      expect(plan.totalBudget).toBeLessThanOrEqual(20000);
      for (const c of plan.byCategory) {
        expect(c.basedOn).toBe("savings_goal");
      }
    });

    it("handles user with no income (monthlyIncome null)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: null });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const plan = await planner.calculateBudgetFromSavingsGoal("user-1", 10000);

      // income=0, savingsGoal=10000 → savingsGoal >= income → zero budget
      expect(plan.totalBudget).toBe(0);
    });
  });

  describe("forecastExpenses", () => {
    it("returns exactly N months of predictions (Req 7.2)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      // Need enough data for prediction engine (>30 days span)
      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 3200, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const forecast = await planner.forecastExpenses("user-1", 3);

      expect(forecast.length).toBe(3);
    });

    it("returns empty arrays when no historical data", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const forecast = await planner.forecastExpenses("user-1", 3);

      expect(forecast.length).toBe(3);
      for (const month of forecast) {
        expect(month).toEqual([]);
      }
    });

    it("confidence decays over further months", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 3200, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const forecast = await planner.forecastExpenses("user-1", 3);

      // Each subsequent month should have lower or equal confidence
      if (forecast[0].length > 0 && forecast[2].length > 0) {
        expect(forecast[2][0].confidence).toBeLessThanOrEqual(forecast[0][0].confidence);
      }
    });

    it("predictions increase with drift over further months", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 3200, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });
      const forecast = await planner.forecastExpenses("user-1", 3);

      if (forecast[0].length > 0 && forecast[2].length > 0) {
        expect(forecast[2][0].predictedMax).toBeGreaterThanOrEqual(forecast[0][0].predictedMax);
      }
    });
  });

  describe("suggestCostReduction", () => {
    it("returns empty array when user has no expenses", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const suggestions = await planner.suggestCostReduction("user-1");

      expect(suggestions).toEqual([]);
    });

    it("returns suggestions with suggestedBudget < currentAverage and potentialSaving > 0 (Req 7.3)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 3500, dueDate: "2024-02-15T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 500, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "water", amount: 600, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const suggestions = await planner.suggestCostReduction("user-1");

      expect(suggestions.length).toBe(2);

      for (const s of suggestions) {
        expect(s.suggestedBudget).toBeLessThan(s.currentAverage);
        expect(s.potentialSaving).toBeGreaterThan(0);
        expect(s.reason).toBeTruthy();
      }
    });

    it("computes correct monthly averages across multiple months", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 2000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 4000, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const suggestions = await planner.suggestCostReduction("user-1");

      expect(suggestions.length).toBe(1);
      // Average = (2000 + 4000) / 2 = 3000
      expect(suggestions[0].currentAverage).toBe(3000);
      // suggestedBudget = 3000 * 0.85 = 2550
      expect(suggestions[0].suggestedBudget).toBe(2550);
      // potentialSaving = 3000 - 2550 = 450
      expect(suggestions[0].potentialSaving).toBe(450);
    });

    it("sorts suggestions by currentAverage descending", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "water", amount: 500, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 5000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "gas", amount: 2000, dueDate: "2024-01-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const suggestions = await planner.suggestCostReduction("user-1");

      expect(suggestions[0].category).toBe("electricity");
      expect(suggestions[1].category).toBe("gas");
      expect(suggestions[2].category).toBe("water");
    });

    it("only includes expenses for the specified user", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-2", category: "electricity", amount: 9000, dueDate: "2024-01-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const suggestions = await planner.suggestCostReduction("user-1");

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].currentAverage).toBe(3000);
    });
  });

  describe("onExpenseAdded (auto-update)", () => {
    it("updates budget plan lastUpdated when new expense arrives (Req 7.5)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      await seedExpenses(expenseStore, [
        { userId: "user-1", category: "electricity", amount: 3000, dueDate: "2024-01-15T00:00:00.000Z" },
        { userId: "user-1", category: "electricity", amount: 3200, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });

      // Generate initial plan
      const plan = await planner.generateBudgetPlan("user-1");
      const initialUpdated = plan.lastUpdated;

      // Wait a tiny bit to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));

      // Simulate new expense added
      await planner.onExpenseAdded("user-1");

      // Check the budget record was updated
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const budgetId = `user-1-${month}`;
      const updatedBudget = await budgetStore.get(budgetId);

      expect(updatedBudget).toBeDefined();
      expect(updatedBudget!.updatedAt).not.toBe(initialUpdated);
    });

    it("does nothing when no budget plan exists for current month", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      const budgetStore = createInMemoryStore<Budget>();

      const planner = createFinancialPlanner({ expenseStore, userStore, budgetStore });

      // Should not throw
      await expect(planner.onExpenseAdded("user-1")).resolves.toBeUndefined();

      const allBudgets = await budgetStore.getAll();
      expect(allBudgets.length).toBe(0);
    });
  });

  describe("getExpenseRatioHistory", () => {
    it("returns 6 months of history by default (Req 6.4)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const history = await planner.getExpenseRatioHistory("user-1");

      expect(history.length).toBe(6);
    });

    it("returns custom number of months when specified", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const history = await planner.getExpenseRatioHistory("user-1", 3);

      expect(history.length).toBe(3);
    });

    it("returns results ordered chronologically (oldest first)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const history = await planner.getExpenseRatioHistory("user-1", 3);

      // Each result should have a month via the ratio field
      // Since user exists with income, none should be skipped
      for (const r of history) {
        expect(r.skipped).toBe(false);
        expect(r.ratio).not.toBeNull();
      }

      // Verify chronological order
      const months = history.map((r) => r.ratio!.month);
      for (let i = 1; i < months.length; i++) {
        expect(months[i] > months[i - 1]).toBe(true);
      }
    });

    it("includes correct expense data for each month", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: 50000 });
      await userStore.set(user.id, user);

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

      await seedExpenses(expenseStore, [
        { userId: "user-1", amount: 5000, dueDate: `${currentMonth}-15T00:00:00.000Z` },
        { userId: "user-1", amount: 3000, dueDate: `${prevMonth}-15T00:00:00.000Z` },
      ]);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const history = await planner.getExpenseRatioHistory("user-1", 2);

      const prevResult = history.find((r) => r.ratio?.month === prevMonth);
      const currResult = history.find((r) => r.ratio?.month === currentMonth);

      expect(prevResult).toBeDefined();
      expect(prevResult!.ratio!.totalExpense).toBe(3000);

      expect(currResult).toBeDefined();
      expect(currResult!.ratio!.totalExpense).toBe(5000);
    });

    it("returns all skipped when user has no income (Req 6.5)", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const user = makeUser({ monthlyIncome: null });
      await userStore.set(user.id, user);

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const history = await planner.getExpenseRatioHistory("user-1", 3);

      expect(history.length).toBe(3);
      for (const r of history) {
        expect(r.skipped).toBe(true);
        expect(r.ratio).toBeNull();
      }
    });

    it("returns all skipped when user does not exist", async () => {
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();

      const planner = createFinancialPlanner({ expenseStore, userStore });
      const history = await planner.getExpenseRatioHistory("nonexistent", 3);

      expect(history.length).toBe(3);
      for (const r of history) {
        expect(r.skipped).toBe(true);
        expect(r.ratio).toBeNull();
      }
    });
  });
});
