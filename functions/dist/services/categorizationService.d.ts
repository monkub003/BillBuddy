import { ExpenseCategory } from "../types/api";
import { CreateExpenseInput } from "../types/expense";
import { FirestoreStore } from "./firestore";
export interface CategorizationResult {
    category: string;
    confidence: number;
    needsUserConfirmation: boolean;
    alternatives: Array<{
        category: string;
        confidence: number;
    }>;
}
export interface UserCorrection {
    expenseId: string;
    correctCategory: ExpenseCategory;
    correctedAt: string;
}
export interface CategorizationServiceDeps {
    /** Additional user-created category keywords (category name → keywords) */
    customKeywords?: Record<string, string[]>;
    /** Store for user corrections (optional — uses in-memory fallback if omitted) */
    correctionsStore?: FirestoreStore<UserCorrection>;
}
export declare function createCategorizationService(deps?: CategorizationServiceDeps): {
    categorize: (expense: CreateExpenseInput) => Promise<CategorizationResult>;
    recordUserCorrection: (expenseId: string, correctCategory: ExpenseCategory) => Promise<void>;
    getCorrection: (expenseId: string) => Promise<UserCorrection | undefined>;
};
//# sourceMappingURL=categorizationService.d.ts.map