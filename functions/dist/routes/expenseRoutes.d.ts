import { Router } from "express";
import { ExpenseServiceDeps } from "../services/expenseService";
import { Budget } from "../types/budget";
import { User } from "../types/user";
import { FirestoreStore } from "../services/firestore";
import { CategorizationServiceDeps } from "../services/categorizationService";
export interface ExpenseRoutesDeps extends Partial<ExpenseServiceDeps> {
    categorizationDeps?: CategorizationServiceDeps;
    budgetStore?: FirestoreStore<Budget>;
    userStore?: FirestoreStore<User>;
}
/**
 * Factory that creates the expense router.
 * Accepts optional deps so callers can inject custom stores.
 * Wires categorization into the expense creation pipeline:
 * when creating an expense, auto-categorize if the category is "manual" or not explicitly set.
 */
export declare function createExpenseRouter(deps?: ExpenseRoutesDeps): Router;
//# sourceMappingURL=expenseRoutes.d.ts.map