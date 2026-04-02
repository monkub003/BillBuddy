import { useMemo } from "react";
import { Expense, ExpenseCategory } from "@/types";
import { useExpenseStore } from "@/store/expenseStore";
import { useIncomeStore } from "@/store/incomeStore";

type AlertLevel = "none" | "warning" | "critical";

interface CategoryBreakdown {
  category: ExpenseCategory;
  total: number;
}

interface DashboardData {
  totalExpenses: number;
  totalPaid: number;
  totalUnpaid: number;
  categoryBreakdown: CategoryBreakdown[];
  upcomingBills: Expense[];
  alertLevel: AlertLevel;
  incomeRatio: number | null;
}

/**
 * Aggregates dashboard data from the expense store and income store.
 * Accepts an optional `expenses` parameter for backward compatibility;
 * when omitted the hook reads directly from the Zustand expense store.
 */
export function useDashboard(expensesOverride?: Expense[]): DashboardData {
  const storeExpenses = useExpenseStore((s) => s.expenses);
  const monthlyIncome = useIncomeStore((s) => s.monthlyIncome);

  const expenses = expensesOverride ?? storeExpenses;

  return useMemo(() => {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = expenses
      .filter((e) => e.isPaid)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalUnpaid = expenses
      .filter((e) => !e.isPaid)
      .reduce((sum, e) => sum + e.amount, 0);

    // Category breakdown
    const categoryMap = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amount);
    }
    const categoryBreakdown: CategoryBreakdown[] = Array.from(
      categoryMap.entries()
    ).map(([category, total]) => ({ category, total }));

    // Upcoming unpaid bills sorted by due date ascending
    const upcomingBills = expenses
      .filter((e) => !e.isPaid)
      .sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

    // Alert level based on income ratio
    let alertLevel: AlertLevel = "none";
    let incomeRatio: number | null = null;
    if (monthlyIncome && monthlyIncome > 0) {
      incomeRatio = totalExpenses / monthlyIncome;
      if (incomeRatio > 1.0) {
        alertLevel = "critical";
      } else if (incomeRatio > 0.9) {
        alertLevel = "warning";
      }
    }

    return {
      totalExpenses,
      totalPaid,
      totalUnpaid,
      categoryBreakdown,
      upcomingBills,
      alertLevel,
      incomeRatio,
    };
  }, [expenses, monthlyIncome]);
}
