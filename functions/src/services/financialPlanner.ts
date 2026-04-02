import { ExpenseCategory } from "../types/api";
import { Budget } from "../types/budget";
import { Expense } from "../types/expense";
import { PredictionResult } from "../types/prediction";
import { User } from "../types/user";
import { FirestoreStore, createInMemoryStore } from "./firestore";
import { createPredictionEngine, PredictionEngineDeps } from "./predictionEngine";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ExpenseRatio {
  month: string;
  totalExpense: number;
  totalIncome: number;
  ratio: number; // 0.0 - 1.0+
  isHealthy: boolean; // true if ratio <= 0.7
  categoryBreakdown: Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }>;
}

export interface CostReductionSuggestion {
  category: ExpenseCategory;
  currentAverage: number;
  suggestedBudget: number;
  potentialSaving: number;
  reason: string;
}

export interface ExpenseRatioResult {
  ratio: ExpenseRatio | null;
  suggestions: CostReductionSuggestion[];
  skipped: boolean; // true when monthlyIncome is null
}

export interface BudgetPlan {
  month: string;
  totalBudget: number;
  byCategory: Array<{
    category: ExpenseCategory;
    budgetAmount: number;
    basedOn: "historical" | "trend" | "savings_goal";
  }>;
  savingsTarget: number | null;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface FinancialPlannerDeps {
  expenseStore: FirestoreStore<Expense>;
  userStore: FirestoreStore<User>;
  budgetStore: FirestoreStore<Budget>;
  predictionEngineDeps?: Partial<PredictionEngineDeps>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEALTHY_RATIO_THRESHOLD = 0.7;
const SUGGESTION_REDUCTION_FACTOR = 0.85; // suggest 85% of current average

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFinancialPlanner(deps?: Partial<FinancialPlannerDeps>) {
  const expenseStore = deps?.expenseStore ?? createInMemoryStore<Expense>();
  const userStore = deps?.userStore ?? createInMemoryStore<User>();
  const budgetStore = deps?.budgetStore ?? createInMemoryStore<Budget>();
  const predictionEngine = createPredictionEngine({
    expenseStore,
    ...deps?.predictionEngineDeps,
  });

  /**
   * Calculate expense-to-income ratio for a given user and month.
   *
   * When the user's monthlyIncome is null, the ratio calculation is skipped
   * (Req 6.5) and the result indicates `skipped: true`.
   *
   * When ratio > 0.7, isHealthy is false and cost reduction suggestions
   * are generated (Req 6.3).
   */
  async function calculateExpenseRatio(
    userId: string,
    month: string
  ): Promise<ExpenseRatioResult> {
    // Fetch user to get monthlyIncome
    const user = await userStore.get(userId);

    if (!user) {
      return { ratio: null, suggestions: [], skipped: true };
    }

    // If monthlyIncome is null, skip ratio calculation (Req 6.5)
    if (user.monthlyIncome === null) {
      return { ratio: null, suggestions: [], skipped: true };
    }

    const totalIncome = user.monthlyIncome;

    // Fetch all expenses for this user in the given month
    const allExpenses = await expenseStore.findAllBy("userId", userId);
    const monthExpenses = allExpenses.filter((e) => {
      const d = new Date(e.dueDate);
      const expMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return expMonth === month;
    });

    // Calculate total expense
    const totalExpense = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Build category breakdown
    const categoryTotals = new Map<ExpenseCategory, number>();
    for (const e of monthExpenses) {
      categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount);
    }

    const categoryBreakdown = Array.from(categoryTotals.entries()).map(
      ([category, amount]) => ({
        category,
        amount: roundTwo(amount),
        percentage: totalExpense > 0 ? roundTwo((amount / totalExpense) * 100) : 0,
      })
    );

    // Calculate ratio
    const ratio = totalIncome > 0 ? roundTwo(totalExpense / totalIncome) : 0;
    const isHealthy = ratio <= HEALTHY_RATIO_THRESHOLD;

    const expenseRatio: ExpenseRatio = {
      month,
      totalExpense: roundTwo(totalExpense),
      totalIncome: roundTwo(totalIncome),
      ratio,
      isHealthy,
      categoryBreakdown,
    };

    // Generate cost reduction suggestions when unhealthy (Req 6.3)
    let suggestions: CostReductionSuggestion[] = [];
    if (!isHealthy) {
      suggestions = generateCostReductionSuggestions(categoryBreakdown);
    }

    return { ratio: expenseRatio, suggestions, skipped: false };
  }

  /**
   * Generate a monthly budget plan based on historical expense averages
   * and trend predictions (Req 7.1).
   */
  async function generateBudgetPlan(userId: string): Promise<BudgetPlan> {
    const allExpenses = await expenseStore.findAllBy("userId", userId);
    const userExpenses = allExpenses.filter((e) => e.userId === userId);

    // Compute per-category monthly averages from historical data
    const categoryMonthlyTotals = new Map<ExpenseCategory, Map<string, number>>();
    for (const e of userExpenses) {
      const d = new Date(e.dueDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!categoryMonthlyTotals.has(e.category)) {
        categoryMonthlyTotals.set(e.category, new Map());
      }
      const monthMap = categoryMonthlyTotals.get(e.category)!;
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + e.amount);
    }

    // Try to get trend predictions
    let predictions: PredictionResult[] | null = null;
    const predResult = await predictionEngine.generatePredictions(userId);
    if (predResult.data) {
      predictions = predResult.data;
    }

    const predictionMap = new Map<ExpenseCategory, PredictionResult>();
    if (predictions) {
      for (const p of predictions) {
        predictionMap.set(p.category, p);
      }
    }

    // Build budget per category
    const byCategory: BudgetPlan["byCategory"] = [];
    const allCategories = new Set<ExpenseCategory>();
    for (const e of userExpenses) {
      allCategories.add(e.category);
    }

    for (const category of allCategories) {
      const monthMap = categoryMonthlyTotals.get(category);
      const monthCount = monthMap ? monthMap.size : 1;
      const totalForCategory = monthMap
        ? Array.from(monthMap.values()).reduce((s, v) => s + v, 0)
        : 0;
      const historicalAvg = totalForCategory / monthCount;

      const pred = predictionMap.get(category);
      if (pred) {
        // Use midpoint of prediction range when trend data is available
        const trendBudget = (pred.predictedMin + pred.predictedMax) / 2;
        byCategory.push({
          category,
          budgetAmount: roundTwo(trendBudget),
          basedOn: "trend",
        });
      } else {
        byCategory.push({
          category,
          budgetAmount: roundTwo(historicalAvg),
          basedOn: "historical",
        });
      }
    }

    const totalBudget = roundTwo(
      byCategory.reduce((sum, c) => sum + c.budgetAmount, 0)
    );

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const plan: BudgetPlan = {
      month,
      totalBudget,
      byCategory,
      savingsTarget: null,
      lastUpdated: now.toISOString(),
    };

    // Persist budget record
    const budgetId = `${userId}-${month}`;
    await budgetStore.set(budgetId, {
      id: budgetId,
      userId,
      month,
      totalBudget: plan.totalBudget,
      categoryBudgets: plan.byCategory.map((c) => ({
        category: c.category,
        amount: c.budgetAmount,
      })),
      savingsGoal: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return plan;
  }

  /**
   * Calculate a budget plan constrained by a savings goal (Req 7.4).
   * Ensures totalBudget ≤ income - savingsGoal.
   */
  async function calculateBudgetFromSavingsGoal(
    userId: string,
    savingsGoal: number
  ): Promise<BudgetPlan> {
    const user = await userStore.get(userId);
    const income = user?.monthlyIncome ?? 0;

    if (savingsGoal >= income) {
      // Edge case: savings goal exceeds income — budget is 0
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return {
        month,
        totalBudget: 0,
        byCategory: [],
        savingsTarget: savingsGoal,
        lastUpdated: now.toISOString(),
      };
    }

    const maxBudget = roundTwo(income - savingsGoal);

    // Start from the base plan
    const basePlan = await generateBudgetPlan(userId);

    // Scale down proportionally if base plan exceeds max budget
    if (basePlan.totalBudget > maxBudget && basePlan.totalBudget > 0) {
      const scaleFactor = maxBudget / basePlan.totalBudget;
      basePlan.byCategory = basePlan.byCategory.map((c) => ({
        category: c.category,
        budgetAmount: roundTwo(c.budgetAmount * scaleFactor),
        basedOn: "savings_goal" as const,
      }));
      basePlan.totalBudget = roundTwo(
        basePlan.byCategory.reduce((sum, c) => sum + c.budgetAmount, 0)
      );
    }

    basePlan.savingsTarget = savingsGoal;
    basePlan.lastUpdated = new Date().toISOString();

    // Persist
    const now = new Date();
    const budgetId = `${userId}-${basePlan.month}`;
    await budgetStore.set(budgetId, {
      id: budgetId,
      userId,
      month: basePlan.month,
      totalBudget: basePlan.totalBudget,
      categoryBudgets: basePlan.byCategory.map((c) => ({
        category: c.category,
        amount: c.budgetAmount,
      })),
      savingsGoal,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return basePlan;
  }

  /**
   * Forecast expenses for N months ahead (Req 7.2).
   * Returns an array of PredictionResult[] — one per month.
   */
  async function forecastExpenses(
    userId: string,
    months: number
  ): Promise<PredictionResult[][]> {
    const basePredictions = await predictionEngine.generatePredictions(userId);

    if (!basePredictions.data || basePredictions.data.length === 0) {
      // No prediction data available — return empty arrays for each month
      return Array.from({ length: months }, () => []);
    }

    const results: PredictionResult[][] = [];

    for (let i = 1; i <= months; i++) {
      // Apply a drift factor per month to simulate increasing uncertainty
      const driftFactor = 1 + i * 0.02; // 2% drift per month
      const confidenceDecay = Math.max(0, 1 - i * 0.05); // 5% confidence decay per month

      const monthPredictions: PredictionResult[] = basePredictions.data.map((p) => ({
        category: p.category,
        predictedMin: roundTwo(p.predictedMin * driftFactor),
        predictedMax: roundTwo(p.predictedMax * driftFactor),
        confidence: roundTwo(Math.max(0, Math.min(1, p.confidence * confidenceDecay))),
        factors: { ...p.factors },
      }));

      results.push(monthPredictions);
    }

    return results;
  }

  /**
   * Auto-update the budget plan's lastUpdated when a new expense arrives (Req 7.5).
   * Call this after adding a new expense.
   */
  async function onExpenseAdded(userId: string): Promise<void> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const budgetId = `${userId}-${month}`;

    const existing = await budgetStore.get(budgetId);
    if (existing) {
      await budgetStore.set(budgetId, {
        ...existing,
        updatedAt: now.toISOString(),
      });
    }
  }

  /**
   * Suggest cost reductions by comparing per-category monthly averages
   * against a reduced budget target (Req 7.3).
   *
   * For each category the user has spent in, the function computes the
   * historical monthly average and suggests a budget at 85% of that average.
   * Only categories with a positive potential saving are included.
   * Results are sorted by currentAverage descending (biggest spend first).
   */
  async function suggestCostReduction(
    userId: string
  ): Promise<CostReductionSuggestion[]> {
    const allExpenses = await expenseStore.findAllBy("userId", userId);
    if (allExpenses.length === 0) return [];

    // Group expenses by category → month → total
    const categoryMonthTotals = new Map<ExpenseCategory, Map<string, number>>();
    for (const e of allExpenses) {
      const d = new Date(e.dueDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!categoryMonthTotals.has(e.category)) {
        categoryMonthTotals.set(e.category, new Map());
      }
      const monthMap = categoryMonthTotals.get(e.category)!;
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + e.amount);
    }

    // Compute per-category monthly average and build suggestions
    const suggestions: CostReductionSuggestion[] = [];

    for (const [category, monthMap] of categoryMonthTotals) {
      const monthCount = monthMap.size;
      const totalForCategory = Array.from(monthMap.values()).reduce((s, v) => s + v, 0);
      const currentAverage = roundTwo(totalForCategory / monthCount);

      const suggestedBudget = roundTwo(currentAverage * SUGGESTION_REDUCTION_FACTOR);
      const potentialSaving = roundTwo(currentAverage - suggestedBudget);

      if (potentialSaving > 0 && suggestedBudget < currentAverage) {
        suggestions.push({
          category,
          currentAverage,
          suggestedBudget,
          potentialSaving,
          reason: `${category} averages ฿${currentAverage}/month. Consider reducing to ฿${suggestedBudget} to save ฿${potentialSaving}/month.`,
        });
      }
    }

    // Sort by currentAverage descending (biggest spend first)
    suggestions.sort((a, b) => b.currentAverage - a.currentAverage);

    return suggestions;
  }

  /**
   * Retrieve expense-to-income ratio history for the past N months (Req 6.4).
   * Defaults to 6 months. Returns results ordered chronologically (oldest first).
   */
  async function getExpenseRatioHistory(
    userId: string,
    months: number = 6
  ): Promise<ExpenseRatioResult[]> {
    const now = new Date();
    const monthStrings: string[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthStrings.push(m);
    }

    const results: ExpenseRatioResult[] = [];
    for (const month of monthStrings) {
      const result = await calculateExpenseRatio(userId, month);
      results.push(result);
    }

    return results;
  }

  return {
    calculateExpenseRatio,
    generateBudgetPlan,
    calculateBudgetFromSavingsGoal,
    forecastExpenses,
    onExpenseAdded,
    suggestCostReduction,
    getExpenseRatioHistory,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generate cost reduction suggestions for categories, sorted by amount
 * descending (highest spending first). Each suggestion recommends reducing
 * to 85% of the current amount.
 */
function generateCostReductionSuggestions(
  breakdown: Array<{ category: ExpenseCategory; amount: number; percentage: number }>
): CostReductionSuggestion[] {
  // Sort by amount descending — suggest reducing the biggest categories first
  const sorted = [...breakdown].sort((a, b) => b.amount - a.amount);

  return sorted.map((item) => {
    const suggestedBudget = roundTwo(item.amount * SUGGESTION_REDUCTION_FACTOR);
    const potentialSaving = roundTwo(item.amount - suggestedBudget);

    return {
      category: item.category,
      currentAverage: item.amount,
      suggestedBudget,
      potentialSaving,
      reason: `${item.category} accounts for ${item.percentage}% of total expenses. Consider reducing by ${roundTwo((1 - SUGGESTION_REDUCTION_FACTOR) * 100)}%.`,
    };
  });
}
