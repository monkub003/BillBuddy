import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { PredictionResult } from "@/types";

interface PredictionState {
  predictions: PredictionResult[];
  insufficientData: boolean;
  loading: boolean;
  error: string | null;
}

export function usePrediction() {
  const [state, setState] = useState<PredictionState>({
    predictions: [],
    insufficientData: false,
    loading: false,
    error: null,
  });

  const fetchPredictions = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiClient<{
        predictions?: PredictionResult[];
        insufficientData?: boolean;
        message?: string;
      }>("/predictions");

      if (data.insufficientData) {
        setState({
          predictions: [],
          insufficientData: true,
          loading: false,
          error: null,
        });
      } else {
        setState({
          predictions: data.predictions ?? [],
          insufficientData: false,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch predictions",
      }));
    }
  }, []);

  return { ...state, fetchPredictions };
}
