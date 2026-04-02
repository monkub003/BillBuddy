import { ExpenseCategory } from "./api";

export interface Budget {
  id: string;
  userId: string;
  month: string; // "YYYY-MM"
  totalBudget: number;
  categoryBudgets: Array<{
    category: ExpenseCategory;
    amount: number;
  }>;
  savingsGoal: number | null;
  createdAt: string;
  updatedAt: string;
}
