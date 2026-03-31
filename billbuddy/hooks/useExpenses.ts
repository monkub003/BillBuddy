import { useState, useCallback } from "react";
import { useExpenseStore } from "@/store/expenseStore";
import { apiClient } from "@/lib/api";
import { Expense, CreateExpenseInput, ExpenseFilters } from "@/types";

export function useExpenses() {
  const {
    expenses,
    filters,
    loading,
    error,
    setExpenses,
    addExpense,
    updateExpense: storeUpdate,
    removeExpense,
    setFilters,
    setLoading,
    setError,
  } = useExpenseStore();

  const fetchExpenses = useCallback(
    async (filterOverrides?: ExpenseFilters) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        const active = filterOverrides ?? filters;
        if (active.category) params.set("category", active.category);
        if (active.month !== undefined)
          params.set("month", String(active.month));
        if (active.year !== undefined) params.set("year", String(active.year));
        if (active.isPaid !== undefined)
          params.set("isPaid", String(active.isPaid));

        const query = params.toString();
        const path = `/expenses${query ? `?${query}` : ""}`;
        const data = await apiClient<Expense[]>(path);
        setExpenses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch expenses");
      } finally {
        setLoading(false);
      }
    },
    [filters, setExpenses, setLoading, setError]
  );

  const createExpense = useCallback(
    async (input: CreateExpenseInput) => {
      setLoading(true);
      setError(null);
      try {
        const created = await apiClient<Expense>("/expenses", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addExpense(created);
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create expense");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addExpense, setLoading, setError]
  );

  const updateExpense = useCallback(
    async (id: string, data: Partial<Expense>) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await apiClient<Expense>(`/expenses/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        storeUpdate(id, updated);
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update expense");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [storeUpdate, setLoading, setError]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await apiClient<void>(`/expenses/${id}`, { method: "DELETE" });
        removeExpense(id);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete expense");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [removeExpense, setLoading, setError]
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
    setFilters,
  };
}
