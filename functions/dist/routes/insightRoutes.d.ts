import { Router } from "express";
import { FirestoreStore } from "../services/firestore";
import { Expense } from "../types/expense";
interface InsightRoutesDeps {
    expenseStore: FirestoreStore<Expense>;
}
export declare function createInsightRouter(deps: InsightRoutesDeps): Router;
export {};
//# sourceMappingURL=insightRoutes.d.ts.map