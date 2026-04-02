import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { PredictionResult } from "@/types";
import { useExpenseStore } from "@/store/expenseStore";

export interface MonthlyTotal {
  month: string;
  amount: number;
  isForecast: boolean;
}

export interface AiInsight {
  id: string;
  type: "warning" | "info" | "suggestion";
  title: string;
  description: string;
  confidence: number;
}

const SHORT_THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function useTrends() {
  const expenses = useExpenseStore((s) => s.expenses);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch predictions and AI insights in parallel
      const [predData, insightData] = await Promise.allSettled([
        apiClient<{ predictions?: PredictionResult[]; insufficientData?: boolean }>("/predictions"),
        apiClient<{ insights: AiInsight[] }>("/insights"),
      ]);

      if (predData.status === "fulfilled") {
        setPredictions(predData.value.predictions ?? []);
      }

      if (insightData.status === "fulfilled" && insightData.value.insights?.length > 0) {
        setInsights(insightData.value.insights);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trends");
    } finally {
      setLoading(false);
    }
  }, []);

  // Build monthly totals from local expense data
  const now = new Date();
  const monthlyTotals: MonthlyTotal[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const total = expenses
      .filter((e) => {
        const ed = new Date(e.dueDate);
        return ed.getMonth() === m && ed.getFullYear() === y;
      })
      .reduce((sum, e) => sum + e.amount, 0);
    monthlyTotals.push({
      month: SHORT_THAI_MONTHS[m],
      amount: total,
      isForecast: false,
    });
  }

  // Append 3 forecast months from predictions average
  const avgPrediction =
    predictions.length > 0
      ? predictions.reduce((s, p) => s + (p.predictedMin + p.predictedMax) / 2, 0)
      : 0;

  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthlyTotals.push({
      month: SHORT_THAI_MONTHS[d.getMonth()],
      amount: Math.round(avgPrediction * (1 + i * 0.03)),
      isForecast: true,
    });
  }

  return { monthlyTotals, insights, predictions, loading, error, fetchTrends };
}
