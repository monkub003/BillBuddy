import { Router } from "express";
import { FirestoreStore } from "../services/firestore";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { User } from "../types/user";
export interface FinancialRoutesDeps {
    expenseStore: FirestoreStore<Expense>;
    userStore: FirestoreStore<User>;
    budgetStore: FirestoreStore<Budget>;
}
export declare function createFinancialRouter(deps: FinancialRoutesDeps): Router;
//# sourceMappingURL=financialRoutes.d.ts.map