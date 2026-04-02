import { Expense } from "../types/expense";
import { FirestoreStore } from "./firestore";
export interface AiInsight {
    id: string;
    type: "warning" | "info" | "suggestion";
    title: string;
    description: string;
    confidence: number;
}
export interface AiInsightServiceDeps {
    expenseStore: FirestoreStore<Expense>;
    aiApiKey?: string;
}
export declare function createAiInsightService(deps?: Partial<AiInsightServiceDeps>): {
    generateInsights: (userId: string) => Promise<AiInsight[]>;
};
//# sourceMappingURL=aiInsightService.d.ts.map