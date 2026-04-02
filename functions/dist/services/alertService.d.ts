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
export declare function createAlertService(deps: AlertServiceDeps): {
    getAlert: () => Promise<AlertResult>;
};
/**
 * Pure function for computing alert level from income and total expenses.
 * Useful for direct testing without async deps.
 */
export declare function computeAlertLevel(monthlyIncome: number, totalExpenses: number): AlertLevel;
//# sourceMappingURL=alertService.d.ts.map