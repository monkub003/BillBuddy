import { ExpenseCategory, ExtractionSource } from "./api";

export interface Expense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  currency: "THB";
  dueDate: string;
  isPaid: boolean;
  extractedVia: ExtractionSource;
  rawSourceRef?: string;
  needsReview?: boolean;
  createdAt: string;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  extractedVia: ExtractionSource;
  rawSourceRef?: string;
}

export interface ExpenseFilters {
  category?: ExpenseCategory;
  month?: number;
  year?: number;
  isPaid?: boolean;
}
