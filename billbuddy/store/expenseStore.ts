import { create } from "zustand";
import { Expense, CreateExpenseInput, ExpenseFilters } from "@/types";
import { apiClient } from "@/lib/api";

interface ExpenseState {
  expenses: Expense[];
  filters: ExpenseFilters;
  loading: boolean;
  error: string | null;

  // Local state setters (kept for backward compatibility)
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  setFilters: (filters: ExpenseFilters) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // API-backed actions
  fetchExpenses: (filterOverrides?: ExpenseFilters) => Promise<void>;
  createExpenseAPI: (input: CreateExpenseInput) => Promise<Expense | null>;
  updateExpenseAPI: (id: string, data: Partial<Expense>) => Promise<Expense | null>;
  deleteExpenseAPI: (id: string) => Promise<boolean>;
  confirmExpense: (id: string) => Promise<Expense | null>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  filters: {},
  loading: false,
  error: null,

  // --- Local state setters ---
  setExpenses: (expenses) => set({ expenses }),
  addExpense: (expense) =>
    set((state) => ({ expenses: [...state.expenses, expense] })),
  updateExpense: (id, data) =>
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, ...data } : e
      ),
    })),
  removeExpense: (id) =>
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    })),
  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // --- API-backed actions ---
  fetchExpenses: async (filterOverrides?: ExpenseFilters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      const active = filterOverrides ?? get().filters;
      if (active.category) params.set("category", active.category);
      if (active.month !== undefined) params.set("month", String(active.month));
      if (active.year !== undefined) params.set("year", String(active.year));
      if (active.isPaid !== undefined) params.set("isPaid", String(active.isPaid));

      const query = params.toString();
      const path = `/expenses${query ? `?${query}` : ""}`;
      const data = await apiClient<Expense[]>(path);
      set({ expenses: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch expenses" });
    } finally {
      set({ loading: false });
    }
  },

  createExpenseAPI: async (input: CreateExpenseInput) => {
    set({ loading: true, error: null });
    try {
      const created = await apiClient<Expense>("/expenses", {
        method: "POST",
        body: JSON.stringify(input),
      });
      set((state) => ({ expenses: [...state.expenses, created] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create expense" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  updateExpenseAPI: async (id: string, data: Partial<Expense>) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiClient<Expense>(`/expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updated } : e)),
      }));
      return updated;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update expense" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpenseAPI: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await apiClient<void>(`/expenses/${id}`, { method: "DELETE" });
      set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== id),
      }));
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete expense" });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  confirmExpense: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const confirmed = await apiClient<Expense>(`/expenses/${id}/confirm`, {
        method: "PUT",
      });
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...confirmed } : e)),
      }));
      return confirmed;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to confirm expense" });
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));
