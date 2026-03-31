import { ApiResponse, ExpenseCategory } from "../types/api";
import { Expense } from "../types/expense";
import { PredictionResult, PredictionContext } from "../types/prediction";
import { FirestoreStore, createInMemoryStore } from "./firestore";

// ---------------------------------------------------------------------------
// External API client interfaces (dependency injection)
// ---------------------------------------------------------------------------

export interface WeatherData {
  temperatureAvg: number; // °C
  humidityAvg: number;    // 0-100
}

export interface EconomicData {
  inflationRate: number;  // e.g. 0.03 for 3%
  interestRate: number;   // e.g. 0.05 for 5%
}

export interface ExchangeRateData {
  thbToUsd: number; // e.g. 35.5
  changePercent: number; // e.g. 0.02 for 2% change
}

export interface WeatherClient {
  getWeather(): Promise<WeatherData>;
}

export interface EconomicClient {
  getIndicators(): Promise<EconomicData>;
}

export interface ExchangeRateClient {
  getRates(): Promise<ExchangeRateData>;
}

// ---------------------------------------------------------------------------
// Prediction engine dependencies
// ---------------------------------------------------------------------------

export interface PredictionEngineDeps {
  expenseStore: FirestoreStore<Expense>;
  weatherClient?: WeatherClient;
  economicClient?: EconomicClient;
  exchangeRateClient?: ExchangeRateClient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UTILITY_CATEGORIES: ExpenseCategory[] = ["electricity", "water", "gas"];
const FINANCIAL_CATEGORIES: ExpenseCategory[] = ["insurance", "loan"];
const ALL_CATEGORIES: ExpenseCategory[] = [
  "electricity", "water", "insurance", "loan", "gas", "manual",
];

const BASE_RANGE_FACTOR = 0.2; // ±20% base range

// ---------------------------------------------------------------------------
// Prediction engine factory
// ---------------------------------------------------------------------------

export function createPredictionEngine(deps?: Partial<PredictionEngineDeps>) {
  const expenseStore = deps?.expenseStore ?? createInMemoryStore<Expense>();
  const weatherClient = deps?.weatherClient;
  const economicClient = deps?.economicClient;
  const exchangeRateClient = deps?.exchangeRateClient;

  /**
   * Check if user has at least 1 month of historical data.
   */
  async function hasEnoughData(userId: string): Promise<boolean> {
    const all = await expenseStore.getAll();
    const userExpenses = all.filter((e) => e.userId === userId);

    if (userExpenses.length === 0) return false;

    const dates = userExpenses.map((e) => new Date(e.dueDate).getTime());
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);

    // At least 30 days span
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    return (latest - earliest) >= ONE_MONTH_MS;
  }

  /**
   * Generate predictions for the user's expenses.
   */
  async function generatePredictions(
    userId: string
  ): Promise<ApiResponse<PredictionResult[]>> {
    const enough = await hasEnoughData(userId);

    if (!enough) {
      return {
        data: null,
        error: "insufficient data: need at least 1 month of expense history",
      };
    }

    // Fetch all user expenses
    const all = await expenseStore.getAll();
    const userExpenses = all.filter((e) => e.userId === userId);

    // Group by category and compute averages
    const categoryAverages = computeCategoryAverages(userExpenses);

    // Fetch external data (gracefully handle failures)
    const excludedFactors: string[] = [];

    let weather: WeatherData | null = null;
    let economic: EconomicData | null = null;
    let exchangeRate: ExchangeRateData | null = null;

    if (weatherClient) {
      try {
        weather = await weatherClient.getWeather();
      } catch {
        excludedFactors.push("weather");
      }
    } else {
      excludedFactors.push("weather");
    }

    if (economicClient) {
      try {
        economic = await economicClient.getIndicators();
      } catch {
        excludedFactors.push("economic");
      }
    } else {
      excludedFactors.push("economic");
    }

    if (exchangeRateClient) {
      try {
        exchangeRate = await exchangeRateClient.getRates();
      } catch {
        excludedFactors.push("exchangeRate");
      }
    } else {
      excludedFactors.push("exchangeRate");
    }

    // Build predictions per category
    const predictions: PredictionResult[] = [];

    for (const category of ALL_CATEGORIES) {
      const avg = categoryAverages.get(category);
      if (avg === undefined || avg === 0) continue;

      const { min, max, factors } = computePrediction(
        category,
        avg,
        weather,
        economic,
        exchangeRate,
        excludedFactors
      );

      predictions.push({
        category,
        predictedMin: Math.max(0, roundTwo(min)),
        predictedMax: Math.max(0, roundTwo(max)),
        factors,
      });
    }

    return { data: predictions, error: null };
  }

  return { generatePredictions, hasEnoughData };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeCategoryAverages(expenses: Expense[]): Map<ExpenseCategory, number> {
  const sums = new Map<ExpenseCategory, number>();
  const counts = new Map<ExpenseCategory, number>();

  for (const e of expenses) {
    sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount);
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }

  const averages = new Map<ExpenseCategory, number>();
  for (const [cat, sum] of sums) {
    averages.set(cat, sum / (counts.get(cat) ?? 1));
  }

  return averages;
}

function computePrediction(
  category: ExpenseCategory,
  average: number,
  weather: WeatherData | null,
  economic: EconomicData | null,
  exchangeRate: ExchangeRateData | null,
  _excludedFactors: string[]
): { min: number; max: number; factors: PredictionContext } {
  let multiplier = 1.0;
  let weatherImpact = "none";
  let economicFactor = 0;
  let exchangeRateValue: number | undefined;

  // Weather affects utility categories
  if (weather && UTILITY_CATEGORIES.includes(category)) {
    // Higher temperature → higher electricity (AC), lower gas
    // Higher humidity → higher water usage
    if (category === "electricity") {
      const tempEffect = (weather.temperatureAvg - 25) * 0.01; // 1% per degree above 25
      multiplier += tempEffect;
      weatherImpact = `temperature ${weather.temperatureAvg}°C`;
    } else if (category === "water") {
      const humidityEffect = (weather.humidityAvg - 50) * 0.005; // 0.5% per point above 50
      multiplier += humidityEffect;
      weatherImpact = `humidity ${weather.humidityAvg}%`;
    } else if (category === "gas") {
      const coldEffect = (25 - weather.temperatureAvg) * 0.01; // more gas when cold
      multiplier += coldEffect;
      weatherImpact = `temperature ${weather.temperatureAvg}°C`;
    }
  }

  // Economic indicators affect financial categories
  if (economic && FINANCIAL_CATEGORIES.includes(category)) {
    if (category === "insurance") {
      multiplier += economic.inflationRate;
      economicFactor = economic.inflationRate;
    } else if (category === "loan") {
      multiplier += economic.interestRate;
      economicFactor = economic.interestRate;
    }
  }

  // Exchange rate affects all categories
  if (exchangeRate) {
    multiplier += exchangeRate.changePercent;
    exchangeRateValue = exchangeRate.thbToUsd;
  }

  const adjustedAvg = average * multiplier;
  const min = adjustedAvg * (1 - BASE_RANGE_FACTOR);
  const max = adjustedAvg * (1 + BASE_RANGE_FACTOR);

  const factors: PredictionContext = {
    weatherImpact,
    economicFactor,
    exchangeRate: exchangeRateValue,
  };

  return { min, max, factors };
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}
