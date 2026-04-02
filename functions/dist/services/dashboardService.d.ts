import { ApiResponse, ExpenseCategory } from "../types/api";
import { Expense } from "../types/expense";
import { User } from "../types/user";
import { FirestoreStore } from "./firestore";
import { ExpenseRatioResult } from "./financialPlanner";
export interface CategoryBreakdown {
    category: ExpenseCategory;
    amount: number;
    percentage: number;
}
export interface MonthlyHistoryPoint {
    month: string;
    total: number;
}
export interface DashboardData {
    monthlyTotal: number;
    categoryBreakdown: CategoryBreakdown[];
    monthlyHistory: MonthlyHistoryPoint[];
    expenseRatio: ExpenseRatioResult | null;
}
export interface DashboardServiceDeps {
    expenseStore: FirestoreStore<Expense>;
    userStore: FirestoreStore<User>;
}
export declare function createDashboardService(deps?: Partial<DashboardServiceDeps>): {
    getDashboardData: (userId: string, month?: string) => Promise<ApiResponse<DashboardData>>;
    getExpensesByCategory: (userId: string, category: ExpenseCategory) => Promise<ApiResponse<Expense[]>>;
    _expenseStore: FirestoreStore<Expense>;
};
//# sourceMappingURL=dashboardService.d.ts.map