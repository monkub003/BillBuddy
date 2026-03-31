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
  factors: PredictionContext;
}
