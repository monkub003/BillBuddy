import { createPredictionEngine, WeatherClient, EconomicClient, ExchangeRateClient } from "../../src/services/predictionEngine";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense } from "../../src/types/expense";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: `exp-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    category: "electricity",
    amount: 1000,
    currency: "THB",
    dueDate: "2024-01-15T00:00:00.000Z",
    isPaid: false,
    extractedVia: "manual",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Seed expenses spanning > 1 month for a user */
async function seedExpenses(store: ReturnType<typeof createInMemoryStore<Expense>>, userId: string, expenses: Partial<Expense>[]) {
  for (const e of expenses) {
    const expense = makeExpense({ userId, ...e });
    await store.set(expense.id, expense);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PredictionEngine", () => {
  describe("hasEnoughData", () => {
    it("returns false when user has no expenses", async () => {
      const store = createInMemoryStore<Expense>();
      const engine = createPredictionEngine({ expenseStore: store });

      expect(await engine.hasEnoughData("user-1")).toBe(false);
    });

    it("returns false when user has expenses spanning less than 1 month", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { dueDate: "2024-01-01T00:00:00.000Z" },
        { dueDate: "2024-01-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      expect(await engine.hasEnoughData("user-1")).toBe(false);
    });

    it("returns true when user has expenses spanning >= 1 month", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { dueDate: "2024-01-01T00:00:00.000Z" },
        { dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      expect(await engine.hasEnoughData("user-1")).toBe(true);
    });
  });

  describe("generatePredictions", () => {
    it("returns insufficient data error when < 1 month of history", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { dueDate: "2024-01-01T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.generatePredictions("user-1");

      expect(result.data).toBeNull();
      expect(result.error).toContain("insufficient data");
    });

    it("returns predictions with min <= max and both >= 0", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity", amount: 1200, dueDate: "2024-02-01T00:00:00.000Z" },
        { category: "water", amount: 300, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "water", amount: 350, dueDate: "2024-02-01T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.generatePredictions("user-1");

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.data!.length).toBeGreaterThan(0);

      for (const pred of result.data!) {
        expect(pred.predictedMin).toBeLessThanOrEqual(pred.predictedMax);
        expect(pred.predictedMin).toBeGreaterThanOrEqual(0);
        expect(pred.predictedMax).toBeGreaterThanOrEqual(0);
      }
    });

    it("still returns predictions when external APIs fail", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity", amount: 1200, dueDate: "2024-02-01T00:00:00.000Z" },
      ]);

      const failingWeather: WeatherClient = {
        getWeather: () => Promise.reject(new Error("API down")),
      };
      const failingEconomic: EconomicClient = {
        getIndicators: () => Promise.reject(new Error("API down")),
      };
      const failingExchange: ExchangeRateClient = {
        getRates: () => Promise.reject(new Error("API down")),
      };

      const engine = createPredictionEngine({
        expenseStore: store,
        weatherClient: failingWeather,
        economicClient: failingEconomic,
        exchangeRateClient: failingExchange,
      });

      const result = await engine.generatePredictions("user-1");

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it("weather data influences utility category predictions", async () => {
      const store = createInMemoryStore<Expense>();
      const expenses = [
        { category: "electricity" as const, amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity" as const, amount: 1000, dueDate: "2024-02-01T00:00:00.000Z" },
      ];
      await seedExpenses(store, "user-1", expenses);

      // Without weather
      const engineNoWeather = createPredictionEngine({ expenseStore: store });
      const resultNoWeather = await engineNoWeather.generatePredictions("user-1");

      // With hot weather (should increase electricity)
      const hotWeather: WeatherClient = {
        getWeather: () => Promise.resolve({ temperatureAvg: 40, humidityAvg: 70 }),
      };
      const engineWithWeather = createPredictionEngine({
        expenseStore: store,
        weatherClient: hotWeather,
      });
      const resultWithWeather = await engineWithWeather.generatePredictions("user-1");

      const elecNoWeather = resultNoWeather.data!.find((p) => p.category === "electricity")!;
      const elecWithWeather = resultWithWeather.data!.find((p) => p.category === "electricity")!;

      // Hot weather should increase electricity predictions
      expect(elecWithWeather.predictedMax).not.toBe(elecNoWeather.predictedMax);
    });
  });
});
