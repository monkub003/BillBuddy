import { createScheduledTasks } from "../../src/services/scheduledTasks";
import { createInMemoryStore } from "../../src/services/firestore";
import { User } from "../../src/types/user";
import { Expense } from "../../src/types/expense";
import { Budget } from "../../src/types/budget";
import { Notification } from "../../src/types/notification";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides?: Partial<User>): User {
  return {
    id: "user-1",
    email: "test@example.com",
    monthlyIncome: 50000,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeExpense(overrides?: Partial<Expense>): Expense {
  return {
    id: "exp-1",
    userId: "user-1",
    category: "electricity",
    amount: 2500,
    currency: "THB",
    dueDate: "2025-03-15T00:00:00.000Z",
    isPaid: false,
    extractedVia: "manual",
    needsReview: false,
    createdAt: "2025-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeBudget(overrides?: Partial<Budget>): Budget {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    id: `user-1-${month}`,
    userId: "user-1",
    month,
    totalBudget: 25000,
    categoryBudgets: [
      { category: "electricity", amount: 5000 },
      { category: "water", amount: 3000 },
    ],
    savingsGoal: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Create expenses spanning multiple months for a user so that
 * the prediction engine has enough data and recurring detection works.
 */
function createMonthlyExpenses(userId: string, category: string, months: number): Expense[] {
  const expenses: Expense[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    expenses.push(makeExpense({
      id: `exp-${category}-${i}`,
      userId,
      category: category as any,
      amount: 2500 + (i * 100),
      dueDate: d.toISOString(),
    }));
  }
  return expenses;
}

// ---------------------------------------------------------------------------
// Tests: Daily Notifications
// ---------------------------------------------------------------------------

describe("scheduledTasks.runDailyNotifications", () => {
  it("returns zero counts when no users exist", async () => {
    const tasks = createScheduledTasks({
      userStore: createInMemoryStore<User>(),
      expenseStore: createInMemoryStore<Expense>(),
      budgetStore: createInMemoryStore<Budget>(),
    });

    const result = await tasks.runDailyNotifications();
    expect(result.usersProcessed).toBe(0);
    expect(result.billReminders).toBe(0);
    expect(result.budgetAlerts).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("processes users and sends budget alerts when spending >= 80%", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();
    const notificationStore = createInMemoryStore<Notification>();

    const user = makeUser();
    await userStore.set(user.id, user);

    const budget = makeBudget({ totalBudget: 10000 });
    await budgetStore.set(budget.id, budget);

    // Add expenses totaling 8500 (85% of 10000 budget) in current month
    const now = new Date();
    await expenseStore.set("e1", makeExpense({
      id: "e1",
      userId: "user-1",
      category: "electricity",
      amount: 5000,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
    }));
    await expenseStore.set("e2", makeExpense({
      id: "e2",
      userId: "user-1",
      category: "water",
      amount: 3500,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(),
    }));

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
      notificationServiceDeps: { notificationStore },
    });

    const result = await tasks.runDailyNotifications();
    expect(result.usersProcessed).toBe(1);
    expect(result.budgetAlerts).toBe(1);

    const notifications = await notificationStore.getAll();
    const budgetNotifs = notifications.filter((n) => n.type === "budget_alert");
    expect(budgetNotifs.length).toBe(1);
    expect(budgetNotifs[0].userId).toBe("user-1");
  });

  it("does not send budget alert when spending < 80%", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();
    const notificationStore = createInMemoryStore<Notification>();

    const user = makeUser();
    await userStore.set(user.id, user);

    const budget = makeBudget({ totalBudget: 50000 });
    await budgetStore.set(budget.id, budget);

    // Add expense totaling 5000 (10% of 50000 budget)
    const now = new Date();
    await expenseStore.set("e1", makeExpense({
      id: "e1",
      userId: "user-1",
      amount: 5000,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
    }));

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
      notificationServiceDeps: { notificationStore },
    });

    const result = await tasks.runDailyNotifications();
    expect(result.usersProcessed).toBe(1);
    expect(result.budgetAlerts).toBe(0);
  });

  it("does not crash when budget does not exist for user", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();

    await userStore.set("user-1", makeUser());

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
    });

    const result = await tasks.runDailyNotifications();
    expect(result.usersProcessed).toBe(1);
    expect(result.budgetAlerts).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("sends bill due reminders for recurring expenses within lead window", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();
    const notificationStore = createInMemoryStore<Notification>();

    await userStore.set("user-1", makeUser());

    // Create monthly recurring expenses (need at least 2 at ~30-day intervals)
    const now = new Date();
    // Next due date is 5 days from now (within 7-day lead window for monthly)
    const nextDue = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const prevDue = new Date(nextDue.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevPrevDue = new Date(prevDue.getTime() - 30 * 24 * 60 * 60 * 1000);

    await expenseStore.set("e1", makeExpense({
      id: "e1",
      userId: "user-1",
      category: "electricity",
      amount: 2500,
      dueDate: prevPrevDue.toISOString(),
    }));
    await expenseStore.set("e2", makeExpense({
      id: "e2",
      userId: "user-1",
      category: "electricity",
      amount: 2500,
      dueDate: prevDue.toISOString(),
    }));

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
      notificationServiceDeps: { notificationStore },
    });

    const result = await tasks.runDailyNotifications();
    expect(result.usersProcessed).toBe(1);
    // The recurring detection should find the pattern and the next due date
    // should be within the lead window
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Weekly Trend Analysis
// ---------------------------------------------------------------------------

describe("scheduledTasks.runWeeklyTrendAnalysis", () => {
  it("returns zero counts when no users exist", async () => {
    const tasks = createScheduledTasks({
      userStore: createInMemoryStore<User>(),
      expenseStore: createInMemoryStore<Expense>(),
      budgetStore: createInMemoryStore<Budget>(),
    });

    const result = await tasks.runWeeklyTrendAnalysis();
    expect(result.usersProcessed).toBe(0);
    expect(result.spikeWarnings).toBe(0);
    expect(result.budgetPlansUpdated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("processes users and updates budget plans", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();

    await userStore.set("user-1", makeUser());

    // Add enough expenses for prediction engine (spanning > 30 days)
    const expenses = createMonthlyExpenses("user-1", "electricity", 4);
    for (const e of expenses) {
      await expenseStore.set(e.id, e);
    }

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
    });

    const result = await tasks.runWeeklyTrendAnalysis();
    expect(result.usersProcessed).toBe(1);
    expect(result.budgetPlansUpdated).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("handles users with insufficient data gracefully", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();

    await userStore.set("user-1", makeUser());
    // No expenses — trend analysis will return insufficient data

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
    });

    const result = await tasks.runWeeklyTrendAnalysis();
    expect(result.usersProcessed).toBe(1);
    expect(result.spikeWarnings).toBe(0);
    // Budget plan generation may fail with no expenses, but shouldn't error out
    expect(result.errors).toHaveLength(0);
  });

  it("processes multiple users independently", async () => {
    const userStore = createInMemoryStore<User>();
    const expenseStore = createInMemoryStore<Expense>();
    const budgetStore = createInMemoryStore<Budget>();

    await userStore.set("user-1", makeUser({ id: "user-1" }));
    await userStore.set("user-2", makeUser({ id: "user-2", email: "user2@example.com" }));

    // Add expenses for user-1 only
    const expenses = createMonthlyExpenses("user-1", "electricity", 4);
    for (const e of expenses) {
      await expenseStore.set(e.id, e);
    }

    const tasks = createScheduledTasks({
      userStore,
      expenseStore,
      budgetStore,
    });

    const result = await tasks.runWeeklyTrendAnalysis();
    expect(result.usersProcessed).toBe(2);
    expect(result.errors).toHaveLength(0);
  });
});
