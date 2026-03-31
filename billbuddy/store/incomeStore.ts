import { create } from "zustand";

type AlertLevel = "none" | "warning" | "critical";

interface IncomeState {
  monthlyIncome: number | null;
  alertLevel: AlertLevel;
  setMonthlyIncome: (income: number | null) => void;
  setAlertLevel: (level: AlertLevel) => void;
}

export const useIncomeStore = create<IncomeState>((set) => ({
  monthlyIncome: null,
  alertLevel: "none",
  setMonthlyIncome: (income) => set({ monthlyIncome: income }),
  setAlertLevel: (level) => set({ alertLevel: level }),
}));
