import { Router } from "express";
import { ExpenseServiceDeps } from "../services/expenseService";
/**
 * Factory that creates the expense router.
 * Accepts optional ExpenseServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export declare function createExpenseRouter(deps?: Partial<ExpenseServiceDeps>): Router;
//# sourceMappingURL=expenseRoutes.d.ts.map