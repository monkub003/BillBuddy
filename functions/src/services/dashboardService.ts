import { ApiResponse, ExpenseCategory } from "../types/api";
import { Expense } from "../types/expense";
import { User } from "../types/user";
import { FirestoreStore, createInMemoryStore } from "./firestore";
import { createFinancialPlanner, ExpenseRatioResult } from "./financialPlanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
}

export interface MonthlyHistoryPoint {
  month: string; // "YYYY-MM"
  total: number;
}

export interface DashboardData {
  monthlyTotal: number;
  categoryBreakdown: CategoryBreakdown[];
  monthlyHistory: MonthlyHistoryPoint[];
  expenseRatio: ExpenseRatioResult | null;
}

export interface DashboardServiceDeps {
  expenseStore: FirestoreStore<Expense>;
  userStore: FirestoreStore<User>;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createDashboardService(deps?: Partial<DashboardServiceDeps>) {
  const expenseStore = deps?.expenseStore ?? createInMemoryStore<Expense>();
  const userStore = deps?.userStore ?? createInMemoryStore<User>();

  const financialPlanner = createFinancialPlanner({ expenseStore, userStore });

  /**
   * Returns aggregated dashboard data for a user.
   *
   * @param userId  – authenticated user id
   * @param month   – optional target month as "YYYY-MM" (defaults to current month)
   */
  async function getDashboardData(
    userId: string,
    month?: string
  ): Promise<ApiResponse<DashboardData>> {
    const allExpenses = await expenseStore.findAllBy("userId", userId);

    // Determine target month
    const targetMonth = month ?? currentMonth();
    const [targetYear, targetMon] = targetMonth.split("-").map(Number);

    // --- Monthly total & category breakdown (for the target month) ---
    const monthExpenses = allExpenses.filter((e) => {
      const d = new Date(e.dueDate);
      return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMon;
    });

    const monthlyTotal = roundTwo(
      monthExpenses.reduce((sum, e) => sum + e.amount, 0)
    );

    // Group by category
    const categoryMap = new Map<ExpenseCategory, number>();
    for (const e of monthExpenses) {
      categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amount);
    }

    const categoryBreakdown: CategoryBreakdown[] = [];
    for (const [category, amount] of categoryMap.entries()) {
      const rounded = roundTwo(amount);
      categoryBreakdown.push({
        category,
        amount: rounded,
        percentage: monthlyTotal > 0 ? roundTwo((rounded / monthlyTotal) * 100) : 0,
      });
    }

    // Sort by amount descending for consistent output
    categoryBreakdown.sort((a, b) => b.amount - a.amount);

    // --- Monthly history (last 6 months ending at target month) ---
    const monthlyHistory: MonthlyHistoryPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const { year, mon } = subtractMonths(targetYear, targetMon, i);
      const key = formatMonth(year, mon);
      const total = roundTwo(
        allExpenses
          .filter((e) => {
            const d = new Date(e.dueDate);
            return d.getFullYear() === year && d.getMonth() + 1 === mon;
          })
          .reduce((sum, e) => sum + e.amount, 0)
      );
      monthlyHistory.push({ month: key, total });
    }

    // --- Expense-to-income ratio (Req 3.4, 6.5) ---
    let expenseRatio: ExpenseRatioResult | null = null;
    try {
      const ratioResult = await financialPlanner.calculateExpenseRatio(userId, targetMonth);
      // When monthlyIncome is null (skipped), set to null so the UI hides the card
      expenseRatio = ratioResult.skipped ? null : ratioResult;
    } catch {
      // Non-critical — dashboard still works without ratio
      expenseRatio = null;
    }

    return {
      data: { monthlyTotal, categoryBreakdown, monthlyHistory, expenseRatio },
      error: null,
    };
  }

  /**
   * Returns all expenses for a user filtered by category.
   */
  async function getExpensesByCategory(
    userId: string,
    category: ExpenseCategory
  ): Promise<ApiResponse<Expense[]>> {
    const allExpenses = await expenseStore.findAllBy("userId", userId);
    const filtered = allExpenses.filter((e) => e.category === category);
    return { data: filtered, error: null };
  }

  return { getDashboardData, getExpensesByCategory, _expenseStore: expenseStore };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentMonth(): string {
  const now = new Date();
  return formatMonth(now.getFullYear(), now.getMonth() + 1);
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function subtractMonths(year: number, month: number, n: number) {
  let y = year;
  let m = month - n;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return { year: y, mon: m };
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}
