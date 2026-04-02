import { ExpenseCategory } from "./api";
export interface PredictionContext {
    weatherImpact: string;
    economicFactor: number;
    exchangeRate?: number;
}
export interface PredictionResult {
    category: ExpenseCategory;
    predictedMin: number;
    predictedMax: number;
    confidence: number;
    factors: PredictionContext;
}
export interface TrendResult {
    category: ExpenseCategory;
    direction: "increasing" | "decreasing" | "stable";
    changePercentage: number;
    confidence: number;
    dataPoints: Array<{
        month: string;
        amount: number;
    }>;
}
export interface RecurringExpense {
    category: ExpenseCategory;
    amount: number;
    frequency: "monthly" | "quarterly" | "yearly";
    nextDueDate: string;
    confidence: number;
}
//# sourceMappingURL=prediction.d.ts.map