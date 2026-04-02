import { Router } from "express";
import { FirestoreStore } from "../services/firestore";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { User } from "../types/user";
export interface BudgetRoutesDeps {
    expenseStore: FirestoreStore<Expense>;
    userStore: FirestoreStore<User>;
    budgetStore: FirestoreStore<Budget>;
}
export declare function createBudgetRouter(deps: BudgetRoutesDeps): Router;
//# sourceMappingURL=budgetRoutes.d.ts.map