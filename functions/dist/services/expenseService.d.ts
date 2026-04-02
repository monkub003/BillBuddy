import { ApiResponse } from "../types/api";
import { Expense, CreateExpenseInput, ExpenseFilters } from "../types/expense";
import { FirestoreStore } from "./firestore";
export interface ExpenseServiceDeps {
    expenseStore: FirestoreStore<Expense>;
}
export declare function createExpenseService(deps?: Partial<ExpenseServiceDeps>): {
    createExpense: (userId: string, data: CreateExpenseInput) => Promise<ApiResponse<Expense>>;
    getExpenses: (userId: string, filters?: ExpenseFilters) => Promise<ApiResponse<Expense[]>>;
    updateExpense: (userId: string, expenseId: string, data: Partial<Expense>) => Promise<ApiResponse<Expense>>;
    deleteExpense: (userId: string, expenseId: string) => Promise<ApiResponse<void>>;
    confirmExpense: (userId: string, expenseId: string) => Promise<ApiResponse<Expense>>;
    _expenseStore: FirestoreStore<Expense>;
};
//# sourceMappingURL=expenseService.d.ts.map