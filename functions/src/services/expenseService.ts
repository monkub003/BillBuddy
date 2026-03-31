import { v4 as uuidv4 } from "uuid";
import { ApiResponse, ExpenseCategory } from "../types/api";
import { Expense, CreateExpenseInput, ExpenseFilters } from "../types/expense";
import { FirestoreStore, createInMemoryStore } from "./firestore";

const ALLOWED_CATEGORIES: ExpenseCategory[] = [
  "electricity",
  "water",
  "insurance",
  "loan",
  "gas",
  "manual",
];

export interface ExpenseServiceDeps {
  expenseStore: FirestoreStore<Expense>;
}

export function createExpenseService(deps?: Partial<ExpenseServiceDeps>) {
  const expenseStore =
    deps?.expenseStore ?? createInMemoryStore<Expense>();

  async function createExpense(
    userId: string,
    data: CreateExpenseInput
  ): Promise<ApiResponse<Expense>> {
    if (data.amount <= 0) {
      return { data: null, error: "amount must be positive" };
    }

    if (!ALLOWED_CATEGORIES.includes(data.category)) {
      return { data: null, error: "invalid category" };
    }

    const expense: Expense = {
      id: uuidv4(),
      userId,
      category: data.category,
      amount: data.amount,
      currency: "THB",
      dueDate: data.dueDate,
      isPaid: data.isPaid,
      extractedVia: data.extractedVia,
      rawSourceRef: data.rawSourceRef,
      createdAt: new Date().toISOString(),
    };

    await expenseStore.set(expense.id, expense);
    return { data: expense, error: null };
  }

  async function getExpenses(
    userId: string,
    filters?: ExpenseFilters
  ): Promise<ApiResponse<Expense[]>> {
    const all = await expenseStore.getAll();
    let results = all.filter((e) => e.userId === userId);

    if (filters?.category) {
      results = results.filter((e) => e.category === filters.category);
    }

    if (filters?.isPaid !== undefined) {
      results = results.filter((e) => e.isPaid === filters.isPaid);
    }

    if (filters?.month !== undefined && filters?.year !== undefined) {
      results = results.filter((e) => {
        const d = new Date(e.dueDate);
        return d.getMonth() + 1 === filters.month && d.getFullYear() === filters.year;
      });
    }

    return { data: results, error: null };
  }

  async function updateExpense(
    userId: string,
    expenseId: string,
    data: Partial<Expense>
  ): Promise<ApiResponse<Expense>> {
    const existing = await expenseStore.get(expenseId);

    if (!existing) {
      return { data: null, error: "access denied" };
    }

    if (existing.userId !== userId) {
      return { data: null, error: "access denied" };
    }

    if (data.amount !== undefined && data.amount <= 0) {
      return { data: null, error: "amount must be positive" };
    }

    if (data.category !== undefined && !ALLOWED_CATEGORIES.includes(data.category)) {
      return { data: null, error: "invalid category" };
    }

    const updated: Expense = {
      ...existing,
      ...data,
      // Immutable fields — always keep original values
      id: existing.id,
      userId: existing.userId,
      currency: "THB",
      createdAt: existing.createdAt,
    };

    await expenseStore.set(expenseId, updated);
    return { data: updated, error: null };
  }

  async function deleteExpense(
    userId: string,
    expenseId: string
  ): Promise<ApiResponse<void>> {
    const existing = await expenseStore.get(expenseId);

    if (!existing) {
      return { data: null, error: "access denied" };
    }

    if (existing.userId !== userId) {
      return { data: null, error: "access denied" };
    }

    await expenseStore.delete(expenseId);
    return { data: undefined as unknown as void, error: null };
  }

  return { createExpense, getExpenses, updateExpense, deleteExpense, _expenseStore: expenseStore };
}
