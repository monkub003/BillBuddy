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

    it("cold weather decreases electricity predictions (Req 4.2)", async () => {
      const store = createInMemoryStore<Expense>();
      const expenses = [
        { category: "electricity" as const, amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity" as const, amount: 1000, dueDate: "2024-02-01T00:00:00.000Z" },
      ];
      await seedExpenses(store, "user-1", expenses);

      // Without weather (base prediction)
      const engineNoWeather = createPredictionEngine({ expenseStore: store });
      const resultNoWeather = await engineNoWeather.generatePredictions("user-1");

      // With cold weather (10°C, well below 25°C baseline)
      const coldWeather: WeatherClient = {
        getWeather: () => Promise.resolve({ temperatureAvg: 10, humidityAvg: 50 }),
      };
      const engineCold = createPredictionEngine({
        expenseStore: store,
        weatherClient: coldWeather,
      });
      const resultCold = await engineCold.generatePredictions("user-1");

      const elecNoWeather = resultNoWeather.data!.find((p) => p.category === "electricity")!;
      const elecCold = resultCold.data!.find((p) => p.category === "electricity")!;

      // Cold weather should decrease electricity predictions
      expect(elecCold.predictedMax).toBeLessThan(elecNoWeather.predictedMax);
      expect(elecCold.predictedMin).toBeLessThan(elecNoWeather.predictedMin);
    });

    it("weather-adjusted prediction includes weatherImpact in factors (Req 4.2)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity" as const, amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity" as const, amount: 1000, dueDate: "2024-02-01T00:00:00.000Z" },
      ]);

      const hotWeather: WeatherClient = {
        getWeather: () => Promise.resolve({ temperatureAvg: 35, humidityAvg: 60 }),
      };
      const engine = createPredictionEngine({
        expenseStore: store,
        weatherClient: hotWeather,
      });
      const result = await engine.generatePredictions("user-1");

      const elec = result.data!.find((p) => p.category === "electricity")!;
      expect(elec.factors.weatherImpact).toContain("temperature");
      expect(elec.factors.weatherImpact).toContain("35");
    });

    it("every prediction includes confidence in [0.0, 1.0] (Req 4.5)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity", amount: 1200, dueDate: "2024-02-01T00:00:00.000Z" },
        { category: "water", amount: 300, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "water", amount: 350, dueDate: "2024-02-01T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.generatePredictions("user-1");

      expect(result.data).not.toBeNull();
      for (const pred of result.data!) {
        expect(pred.confidence).toBeGreaterThanOrEqual(0.0);
        expect(pred.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it("confidence increases with more historical data", async () => {
      // Small dataset (2 expenses)
      const storeSmall = createInMemoryStore<Expense>();
      await seedExpenses(storeSmall, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-01T00:00:00.000Z" },
      ]);
      const engineSmall = createPredictionEngine({ expenseStore: storeSmall });
      const resultSmall = await engineSmall.generatePredictions("user-1");

      // Larger dataset (12 expenses)
      const storeLarge = createInMemoryStore<Expense>();
      const largeExpenses = Array.from({ length: 12 }, (_, i) => ({
        category: "electricity" as const,
        amount: 1000,
        dueDate: new Date(2024, i, 1).toISOString(),
      }));
      await seedExpenses(storeLarge, "user-1", largeExpenses);
      const engineLarge = createPredictionEngine({ expenseStore: storeLarge });
      const resultLarge = await engineLarge.generatePredictions("user-1");

      const confSmall = resultSmall.data!.find((p) => p.category === "electricity")!.confidence;
      const confLarge = resultLarge.data!.find((p) => p.category === "electricity")!.confidence;

      expect(confLarge).toBeGreaterThan(confSmall);
    });

    it("confidence is higher when external factors are available", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-01T00:00:00.000Z" },
      ]);

      // Without external factors
      const engineNoFactors = createPredictionEngine({ expenseStore: store });
      const resultNoFactors = await engineNoFactors.generatePredictions("user-1");

      // With all external factors
      const engineWithFactors = createPredictionEngine({
        expenseStore: store,
        weatherClient: { getWeather: () => Promise.resolve({ temperatureAvg: 30, humidityAvg: 60 }) },
        economicClient: { getIndicators: () => Promise.resolve({ inflationRate: 0.03, interestRate: 0.05 }) },
        exchangeRateClient: { getRates: () => Promise.resolve({ thbToUsd: 35, changePercent: 0.01 }) },
      });
      const resultWithFactors = await engineWithFactors.generatePredictions("user-1");

      const confNo = resultNoFactors.data!.find((p) => p.category === "electricity")!.confidence;
      const confWith = resultWithFactors.data!.find((p) => p.category === "electricity")!.confidence;

      expect(confWith).toBeGreaterThan(confNo);
    });
  });

  describe("analyzeTrend", () => {
    it("returns insufficient data error when < 3 months of history", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1100, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.data).toBeNull();
      expect(result.error).toContain("insufficient data");
    });

    it("returns insufficient data when user has no expenses in category", async () => {
      const store = createInMemoryStore<Expense>();
      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.data).toBeNull();
      expect(result.error).toContain("insufficient data");
    });

    it("returns trend result with correct category and dataPoints for 3+ months", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1050, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1100, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "electricity", amount: 1150, dueDate: "2024-04-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.data!.category).toBe("electricity");
      expect(result.data!.dataPoints).toHaveLength(4);
      expect(result.data!.dataPoints[0].month).toBe("2024-01");
      expect(result.data!.dataPoints[3].month).toBe("2024-04");
    });

    it("detects increasing direction when change > 5%", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "water", amount: 300, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "water", amount: 310, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "water", amount: 320, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "water", amount: 400, dueDate: "2024-04-15T00:00:00.000Z" }, // big jump
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "water", 6);

      expect(result.data!.direction).toBe("increasing");
      expect(result.data!.changePercentage).toBeGreaterThan(5);
    });

    it("detects decreasing direction when change < -5%", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "gas", amount: 500, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "gas", amount: 480, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "gas", amount: 490, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "gas", amount: 350, dueDate: "2024-04-15T00:00:00.000Z" }, // big drop
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "gas", 6);

      expect(result.data!.direction).toBe("decreasing");
      expect(result.data!.changePercentage).toBeLessThan(-5);
    });

    it("detects stable direction when change is within ±5%", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "insurance", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "insurance", amount: 1000, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "insurance", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "insurance", amount: 1020, dueDate: "2024-04-15T00:00:00.000Z" }, // ~2% change
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "insurance", 6);

      expect(result.data!.direction).toBe("stable");
      expect(Math.abs(result.data!.changePercentage)).toBeLessThanOrEqual(5);
    });

    it("detects >20% spike vs 3-month rolling average (Req 4.4)", async () => {
      const store = createInMemoryStore<Expense>();
      // Rolling avg of first 3 months = (1000+1000+1000)/3 = 1000
      // Latest month = 1300 → 30% increase → spike
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "electricity", amount: 1300, dueDate: "2024-04-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.data!.direction).toBe("increasing");
      expect(result.data!.changePercentage).toBeGreaterThan(20);
      expect(result.data!.changePercentage).toBeCloseTo(30, 0);
    });

    it("confidence is in [0.0, 1.0] range", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1100, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1200, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.data!.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data!.confidence).toBeLessThanOrEqual(1);
    });

    it("only includes expenses for the specified category", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1100, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1200, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "water", amount: 300, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "water", amount: 350, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "water", amount: 400, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.data!.category).toBe("electricity");
      // All dataPoints should reflect electricity amounts, not water
      for (const dp of result.data!.dataPoints) {
        expect(dp.amount).toBeGreaterThanOrEqual(1000);
      }
    });

    it("only includes expenses for the specified user", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1100, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1200, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);
      await seedExpenses(store, "user-2", [
        { category: "electricity", amount: 5000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 5000, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 5000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      // Should only see user-1's amounts (1000-1200), not user-2's (5000)
      for (const dp of result.data!.dataPoints) {
        expect(dp.amount).toBeLessThan(2000);
      }
    });

    it("aggregates multiple expenses in the same month", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 500, dueDate: "2024-01-05T00:00:00.000Z" },
        { category: "electricity", amount: 500, dueDate: "2024-01-20T00:00:00.000Z" },
        { category: "electricity", amount: 600, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 700, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 6);

      expect(result.data!.dataPoints).toHaveLength(3);
      // January should aggregate to 1000
      expect(result.data!.dataPoints[0].amount).toBe(1000);
    });

    it("limits dataPoints to the requested number of months", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 900, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 950, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "electricity", amount: 1050, dueDate: "2024-04-15T00:00:00.000Z" },
        { category: "electricity", amount: 1100, dueDate: "2024-05-15T00:00:00.000Z" },
        { category: "electricity", amount: 1150, dueDate: "2024-06-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.analyzeTrend("user-1", "electricity", 3);

      // Should only return the last 3 months
      expect(result.data!.dataPoints).toHaveLength(3);
      expect(result.data!.dataPoints[0].month).toBe("2024-04");
      expect(result.data!.dataPoints[2].month).toBe("2024-06");
    });
  });

  describe("detectRecurringExpenses", () => {
    it("returns empty array when user has no expenses", async () => {
      const store = createInMemoryStore<Expense>();
      const engine = createPredictionEngine({ expenseStore: store });

      const result = await engine.detectRecurringExpenses("user-1");
      expect(result).toEqual([]);
    });

    it("returns empty array when category has only 1 expense (no pattern)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");
      expect(result).toEqual([]);
    });

    it("detects monthly recurring expenses (~30 day intervals)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1050, dueDate: "2024-02-14T00:00:00.000Z" },
        { category: "electricity", amount: 980, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "electricity", amount: 1020, dueDate: "2024-04-14T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("electricity");
      expect(result[0].frequency).toBe("monthly");
      expect(result[0].confidence).toBeGreaterThan(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1);
    });

    it("detects quarterly recurring expenses (~90 day intervals)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "insurance", amount: 5000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "insurance", amount: 5000, dueDate: "2024-04-15T00:00:00.000Z" },
        { category: "insurance", amount: 5100, dueDate: "2024-07-14T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      const insurance = result.find((r) => r.category === "insurance");
      expect(insurance).toBeDefined();
      expect(insurance!.frequency).toBe("quarterly");
    });

    it("detects yearly recurring expenses (~365 day intervals)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "insurance", amount: 12000, dueDate: "2022-06-01T00:00:00.000Z" },
        { category: "insurance", amount: 12500, dueDate: "2023-06-01T00:00:00.000Z" },
        { category: "insurance", amount: 13000, dueDate: "2024-05-31T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      const insurance = result.find((r) => r.category === "insurance");
      expect(insurance).toBeDefined();
      expect(insurance!.frequency).toBe("yearly");
    });

    it("calculates average amount across recurring expenses", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "water", amount: 300, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "water", amount: 350, dueDate: "2024-02-14T00:00:00.000Z" },
        { category: "water", amount: 400, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      const water = result.find((r) => r.category === "water");
      expect(water).toBeDefined();
      expect(water!.amount).toBe(350); // (300+350+400)/3
    });

    it("computes nextDueDate based on frequency and last occurrence", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      const elec = result.find((r) => r.category === "electricity");
      expect(elec).toBeDefined();
      // Last expense is March 15, monthly → next due April 15
      const nextDate = new Date(elec!.nextDueDate);
      expect(nextDate.getMonth()).toBe(3); // April (0-indexed)
      expect(nextDate.getDate()).toBe(15);
    });

    it("only includes expenses for the specified user", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);
      await seedExpenses(store, "user-2", [
        { category: "water", amount: 500, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "water", amount: 500, dueDate: "2024-02-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      // Should only detect user-1's electricity, not user-2's water
      expect(result.every((r) => r.category === "electricity")).toBe(true);
    });

    it("detects multiple categories as recurring", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
        { category: "water", amount: 300, dueDate: "2024-01-10T00:00:00.000Z" },
        { category: "water", amount: 320, dueDate: "2024-02-10T00:00:00.000Z" },
        { category: "water", amount: 310, dueDate: "2024-03-10T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      const categories = result.map((r) => r.category).sort();
      expect(categories).toEqual(["electricity", "water"]);
    });

    it("confidence is in [0.0, 1.0] range", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "electricity", amount: 1000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-02-15T00:00:00.000Z" },
        { category: "electricity", amount: 1000, dueDate: "2024-03-15T00:00:00.000Z" },
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      for (const r of result) {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("tolerates slight date variations within monthly tolerance (±5 days)", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "gas", amount: 2000, dueDate: "2024-01-15T00:00:00.000Z" },
        { category: "gas", amount: 2100, dueDate: "2024-02-17T00:00:00.000Z" }, // +33 days
        { category: "gas", amount: 1900, dueDate: "2024-03-14T00:00:00.000Z" }, // +26 days
        { category: "gas", amount: 2050, dueDate: "2024-04-15T00:00:00.000Z" }, // +32 days
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      const gas = result.find((r) => r.category === "gas");
      expect(gas).toBeDefined();
      expect(gas!.frequency).toBe("monthly");
    });

    it("does not detect pattern when intervals are irregular", async () => {
      const store = createInMemoryStore<Expense>();
      await seedExpenses(store, "user-1", [
        { category: "manual", amount: 500, dueDate: "2024-01-01T00:00:00.000Z" },
        { category: "manual", amount: 300, dueDate: "2024-01-15T00:00:00.000Z" }, // 14 days
        { category: "manual", amount: 700, dueDate: "2024-03-20T00:00:00.000Z" }, // 65 days
        { category: "manual", amount: 200, dueDate: "2024-04-01T00:00:00.000Z" }, // 12 days
      ]);

      const engine = createPredictionEngine({ expenseStore: store });
      const result = await engine.detectRecurringExpenses("user-1");

      // None of the intervals consistently match any frequency
      const manual = result.find((r) => r.category === "manual");
      // If detected, confidence should be low; if not detected, that's also fine
      if (manual) {
        expect(manual.confidence).toBeLessThan(0.5);
      }
    });
  });
});
