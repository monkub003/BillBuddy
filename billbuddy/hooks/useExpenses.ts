import { useCallback } from "react";
import { useExpenseStore } from "@/store/expenseStore";
import { CreateExpenseInput, Expense, ExpenseFilters } from "@/types";

export function useExpenses() {
  const expenses = useExpenseStore((s) => s.expenses);
  const filters = useExpenseStore((s) => s.filters);
  const loading = useExpenseStore((s) => s.loading);
  const error = useExpenseStore((s) => s.error);
  const setFilters = useExpenseStore((s) => s.setFilters);
  const storeFetch = useExpenseStore((s) => s.fetchExpenses);
  const storeCreate = useExpenseStore((s) => s.createExpenseAPI);
  const storeUpdate = useExpenseStore((s) => s.updateExpenseAPI);
  const storeDelete = useExpenseStore((s) => s.deleteExpenseAPI);
  const storeConfirm = useExpenseStore((s) => s.confirmExpense);

  const fetchExpenses = useCallback(
    async (filterOverrides?: ExpenseFilters) => {
      await storeFetch(filterOverrides);
    },
    [storeFetch]
  );

  const createExpense = useCallback(
    async (input: CreateExpenseInput) => {
      return storeCreate(input);
    },
    [storeCreate]
  );

  const updateExpense = useCallback(
    async (id: string, data: Partial<Expense>) => {
      return storeUpdate(id, data);
    },
    [storeUpdate]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      return storeDelete(id);
    },
    [storeDelete]
  );

  const confirmExpense = useCallback(
    async (id: string) => {
      return storeConfirm(id);
    },
    [storeConfirm]
  );

  return {
    expenses,
    filters,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    confirmExpense,
    setFilters,
  };
}
