import { create } from "zustand";
import { apiClient } from "@/lib/api";
import { User } from "@/types";

type AlertLevel = "none" | "warning" | "critical";

interface IncomeState {
  monthlyIncome: number | null;
  alertLevel: AlertLevel;
  loading: boolean;
  error: string | null;

  // Local setters
  setMonthlyIncome: (income: number | null) => void;
  setAlertLevel: (level: AlertLevel) => void;

  // API-backed actions
  fetchIncome: () => Promise<void>;
  updateIncome: (income: number) => Promise<boolean>;
}

export const useIncomeStore = create<IncomeState>((set) => ({
  monthlyIncome: null,
  alertLevel: "none",
  loading: false,
  error: null,

  setMonthlyIncome: (income) => set({ monthlyIncome: income }),
  setAlertLevel: (level) => set({ alertLevel: level }),

  fetchIncome: async () => {
    set({ loading: true, error: null });
    try {
      const user = await apiClient<User>("/users/me");
      set({ monthlyIncome: user.monthlyIncome });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch income" });
    } finally {
      set({ loading: false });
    }
  },

  updateIncome: async (income: number) => {
    set({ loading: true, error: null });
    try {
      const user = await apiClient<User>("/users/income", {
        method: "PUT",
        body: JSON.stringify({ monthlyIncome: income }),
      });
      set({ monthlyIncome: user.monthlyIncome });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update income" });
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
