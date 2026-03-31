import { Expense } from "../types/expense";

export type AlertLevel = "none" | "warning" | "critical";

export interface AlertResult {
  level: AlertLevel;
  ratio: number;
  message: string | null;
}

export interface AlertServiceDeps {
  getMonthlyIncome: () => Promise<number | null>;
  getCurrentMonthExpenses: () => Promise<Expense[]>;
}

/**
 * Creates an alert service that evaluates income-to-expense ratio.
 *
 * - No alert when expenses ≤ 90% of income
 * - Warning when expenses > 90% of income
 * - Critical when expenses > 100% of income
 */
export function createAlertService(deps: AlertServiceDeps) {
  async function getAlert(): Promise<AlertResult> {
    const income = await deps.getMonthlyIncome();

    if (income === null || income <= 0) {
      return { level: "none", ratio: 0, message: null };
    }

    const expenses = await deps.getCurrentMonthExpenses();
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const ratio = totalExpenses / income;

    if (ratio > 1.0) {
      return {
        level: "critical",
        ratio,
        message: "Expenses exceed your monthly income!",
      };
    }

    if (ratio > 0.9) {
      return {
        level: "warning",
        ratio,
        message: "Expenses are over 90% of your monthly income.",
      };
    }

    return { level: "none", ratio, message: null };
  }

  return { getAlert };
}

/**
 * Pure function for computing alert level from income and total expenses.
 * Useful for direct testing without async deps.
 */
export function computeAlertLevel(
  monthlyIncome: number,
  totalExpenses: number
): AlertLevel {
  if (monthlyIncome <= 0) return "none";
  const ratio = totalExpenses / monthlyIncome;
  if (ratio > 1.0) return "critical";
  if (ratio > 0.9) return "warning";
  return "none";
}
