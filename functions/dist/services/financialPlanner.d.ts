import { ExpenseCategory } from "../types/api";
import { Budget } from "../types/budget";
import { Expense } from "../types/expense";
import { PredictionResult } from "../types/prediction";
import { User } from "../types/user";
import { FirestoreStore } from "./firestore";
import { PredictionEngineDeps } from "./predictionEngine";
export interface ExpenseRatio {
    month: string;
    totalExpense: number;
    totalIncome: number;
    ratio: number;
    isHealthy: boolean;
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
    skipped: boolean;
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
export interface FinancialPlannerDeps {
    expenseStore: FirestoreStore<Expense>;
    userStore: FirestoreStore<User>;
    budgetStore: FirestoreStore<Budget>;
    predictionEngineDeps?: Partial<PredictionEngineDeps>;
}
export declare function createFinancialPlanner(deps?: Partial<FinancialPlannerDeps>): {
    calculateExpenseRatio: (userId: string, month: string) => Promise<ExpenseRatioResult>;
    generateBudgetPlan: (userId: string) => Promise<BudgetPlan>;
    calculateBudgetFromSavingsGoal: (userId: string, savingsGoal: number) => Promise<BudgetPlan>;
    forecastExpenses: (userId: string, months: number) => Promise<PredictionResult[][]>;
    onExpenseAdded: (userId: string) => Promise<void>;
    suggestCostReduction: (userId: string) => Promise<CostReductionSuggestion[]>;
    getExpenseRatioHistory: (userId: string, months?: number) => Promise<ExpenseRatioResult[]>;
};
//# sourceMappingURL=financialPlanner.d.ts.map