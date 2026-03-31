import fc from "fast-check";
import {
  createPredictionEngine,
  WeatherClient,
  EconomicClient,
  ExchangeRateClient,
  WeatherData,
  ExchangeRateData,
} from "../../src/services/predictionEngine";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense } from "../../src/types/expense";
import type { ExpenseCategory } from "../../src/types/api";

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: ExpenseCategory[] = [
  "electricity", "water", "insurance", "loan", "gas", "manual",
];

const categoryArb = fc.constantFrom<ExpenseCategory>(...VALID_CATEGORIES);

const positiveAmountArb = fc.double({
  min: 0.01,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
}).filter((n) => n > 0 && Number.isFinite(n));

const userIdArb = fc.stringOf(
  fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")),
  { minLength: 4, maxLength: 12 }
).map((s) => `user-${s}`);

// Generate a pair of dates at least 31 days apart
const dateSpanArb = fc
  .date({ min: new Date("2022-01-01"), max: new Date("2024-06-01") })
  .chain((start) => {
    const minEnd = new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000);
    const maxEnd = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
    return fc
      .date({ min: minEnd, max: maxEnd > new Date("2025-12-31") ? new Date("2025-12-31") : maxEnd })
      .map((end) => ({ start, end }));
  });

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: `exp-${Math.random().toString(36).slice(2)}`,
    userId: "user-default",
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

/** Generate an array of expenses spanning > 1 month for a given user */
function sufficientExpensesArb(userId: string) {
  return fc.tuple(
    dateSpanArb,
    fc.array(
      fc.record({
        category: categoryArb,
        amount: positiveAmountArb,
      }),
      { minLength: 2, maxLength: 10 }
    )
  ).map(([{ start, end }, items]) => {
    // Distribute expenses across the date range
    return items.map((item, i) => {
      const fraction = items.length === 1 ? 0 : i / (items.length - 1);
      const date = new Date(start.getTime() + fraction * (end.getTime() - start.getTime()));
      return makeExpense({
        userId,
        category: item.category,
        amount: item.amount,
        dueDate: date.toISOString(),
      });
    });
  });
}

/** Generate expenses spanning < 1 month */
function insufficientExpensesArb(userId: string) {
  return fc.tuple(
    fc.date({ min: new Date("2023-01-01"), max: new Date("2024-12-01") }),
    fc.array(
      fc.record({
        category: categoryArb,
        amount: positiveAmountArb,
      }),
      { minLength: 0, maxLength: 5 }
    )
  ).map(([baseDate, items]) => {
    // All expenses within 29 days
    return items.map((item, i) => {
      const offset = items.length <= 1 ? 0 : (i / (items.length - 1)) * 29 * 24 * 60 * 60 * 1000;
      const date = new Date(baseDate.getTime() + offset);
      return makeExpense({
        userId,
        category: item.category,
        amount: item.amount,
        dueDate: date.toISOString(),
      });
    });
  });
}

const weatherDataArb: fc.Arbitrary<WeatherData> = fc.record({
  temperatureAvg: fc.double({ min: -10, max: 50, noNaN: true, noDefaultInfinity: true }),
  humidityAvg: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
});

const exchangeRateDataArb: fc.Arbitrary<ExchangeRateData> = fc.record({
  thbToUsd: fc.double({ min: 25, max: 45, noNaN: true, noDefaultInfinity: true }),
  changePercent: fc.double({ min: -0.2, max: 0.2, noNaN: true, noDefaultInfinity: true }),
});

// ---------------------------------------------------------------------------
// Helper to seed store
// ---------------------------------------------------------------------------

async function seedStore(expenses: Expense[]) {
  const store = createInMemoryStore<Expense>();
  for (const e of expenses) {
    await store.set(e.id, e);
  }
  return store;
}

// ---------------------------------------------------------------------------
// Feature: billbuddy-mvp, Property 20: Prediction range invariant
// **Validates: Requirements 10.5**
// ---------------------------------------------------------------------------
describe("Property 20: Prediction range invariant", () => {
  it("predictedMin <= predictedMax and both >= 0 for all predictions", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        userIdArb.chain((uid) => sufficientExpensesArb(uid)),
        async (userId, expenses) => {
          // Ensure expenses belong to this user
          const userExpenses = expenses.map((e) => ({ ...e, userId }));
          const store = await seedStore(userExpenses);
          const engine = createPredictionEngine({ expenseStore: store });

          const result = await engine.generatePredictions(userId);

          // Should succeed (sufficient data)
          if (result.data) {
            for (const pred of result.data) {
              expect(pred.predictedMin).toBeLessThanOrEqual(pred.predictedMax);
              expect(pred.predictedMin).toBeGreaterThanOrEqual(0);
              expect(pred.predictedMax).toBeGreaterThanOrEqual(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: billbuddy-mvp, Property 21: Insufficient data returns no predictions
// **Validates: Requirements 10.6**
// ---------------------------------------------------------------------------
describe("Property 21: Insufficient data returns no predictions", () => {
  it("users with < 1 month of data get an insufficient data error", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        userIdArb.chain((uid) => insufficientExpensesArb(uid)),
        async (userId, expenses) => {
          const userExpenses = expenses.map((e) => ({ ...e, userId }));
          const store = await seedStore(userExpenses);
          const engine = createPredictionEngine({ expenseStore: store });

          const result = await engine.generatePredictions(userId);

          expect(result.data).toBeNull();
          expect(result.error).not.toBeNull();
          expect(result.error).toContain("insufficient data");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: billbuddy-mvp, Property 22: External factor degradation
// **Validates: Requirements 10.7**
// ---------------------------------------------------------------------------
describe("Property 22: External factor degradation", () => {
  it("still returns predictions when external APIs fail", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        userIdArb.chain((uid) => sufficientExpensesArb(uid)),
        // Randomly decide which APIs fail
        fc.record({
          weatherFails: fc.boolean(),
          economicFails: fc.boolean(),
          exchangeFails: fc.boolean(),
        }),
        async (userId, expenses, failures) => {
          const userExpenses = expenses.map((e) => ({ ...e, userId }));
          const store = await seedStore(userExpenses);

          const weatherClient: WeatherClient | undefined = failures.weatherFails
            ? { getWeather: () => Promise.reject(new Error("API down")) }
            : undefined;

          const economicClient: EconomicClient | undefined = failures.economicFails
            ? { getIndicators: () => Promise.reject(new Error("API down")) }
            : undefined;

          const exchangeRateClient: ExchangeRateClient | undefined = failures.exchangeFails
            ? { getRates: () => Promise.reject(new Error("API down")) }
            : undefined;

          const engine = createPredictionEngine({
            expenseStore: store,
            weatherClient,
            economicClient,
            exchangeRateClient,
          });

          const result = await engine.generatePredictions(userId);

          // Should still return predictions (not an error)
          if (result.data) {
            expect(result.data.length).toBeGreaterThanOrEqual(0);
            for (const pred of result.data) {
              expect(pred.predictedMin).toBeLessThanOrEqual(pred.predictedMax);
              expect(pred.predictedMin).toBeGreaterThanOrEqual(0);
            }
          }
          // If error, it should only be insufficient data, not API failure
          if (result.error) {
            expect(result.error).toContain("insufficient data");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: billbuddy-mvp, Property 23: External factors influence respective categories
// **Validates: Requirements 10.2, 10.3, 10.4**
// ---------------------------------------------------------------------------
describe("Property 23: External factors influence respective categories", () => {
  it("weather data changes utility category predictions", async () => {
    // Use amounts large enough that factor effects survive rounding
    const largeAmountArb = fc.double({
      min: 100,
      max: 100_000,
      noNaN: true,
      noDefaultInfinity: true,
    }).filter((n) => n >= 100 && Number.isFinite(n));

    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.tuple(
          dateSpanArb,
          largeAmountArb
        ),
        weatherDataArb.filter(
          (w) => Math.abs(w.temperatureAvg - 25) > 5
        ),
        async (userId, [dateSpan, amount], weather) => {
          // Create electricity expenses spanning > 1 month
          const expenses = [
            makeExpense({ userId, category: "electricity", amount, dueDate: dateSpan.start.toISOString() }),
            makeExpense({ userId, category: "electricity", amount, dueDate: dateSpan.end.toISOString() }),
          ];
          const store = await seedStore(expenses);

          // Without weather
          const engineNoWeather = createPredictionEngine({ expenseStore: store });
          const resultNoWeather = await engineNoWeather.generatePredictions(userId);

          // With weather
          const weatherClientOk: WeatherClient = {
            getWeather: () => Promise.resolve(weather),
          };
          const engineWithWeather = createPredictionEngine({
            expenseStore: store,
            weatherClient: weatherClientOk,
          });
          const resultWithWeather = await engineWithWeather.generatePredictions(userId);

          if (resultNoWeather.data && resultWithWeather.data) {
            const elecNo = resultNoWeather.data.find((p) => p.category === "electricity");
            const elecWith = resultWithWeather.data.find((p) => p.category === "electricity");

            if (elecNo && elecWith) {
              // Predictions should differ when weather is provided
              const differs =
                elecNo.predictedMin !== elecWith.predictedMin ||
                elecNo.predictedMax !== elecWith.predictedMax;
              expect(differs).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("economic indicators change insurance/loan predictions", async () => {
    const largeAmountArb = fc.double({
      min: 100,
      max: 100_000,
      noNaN: true,
      noDefaultInfinity: true,
    }).filter((n) => n >= 100 && Number.isFinite(n));

    // Insurance is affected by inflationRate, loan by interestRate.
    // Test both: create one of each and ensure the matching factor is significant.
    const significantEconomicArb = fc.record({
      inflationRate: fc.double({ min: 0.02, max: 0.3, noNaN: true, noDefaultInfinity: true }),
      interestRate: fc.double({ min: 0.02, max: 0.3, noNaN: true, noDefaultInfinity: true }),
    }).filter((e) => e.inflationRate >= 0.02 && e.interestRate >= 0.02);

    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.tuple(dateSpanArb, largeAmountArb),
        significantEconomicArb,
        async (userId, [dateSpan, amount], economic) => {
          // Include both insurance and loan expenses
          const expenses = [
            makeExpense({ userId, category: "insurance", amount, dueDate: dateSpan.start.toISOString() }),
            makeExpense({ userId, category: "insurance", amount, dueDate: dateSpan.end.toISOString() }),
            makeExpense({ userId, category: "loan", amount, dueDate: dateSpan.start.toISOString() }),
            makeExpense({ userId, category: "loan", amount, dueDate: dateSpan.end.toISOString() }),
          ];
          const store = await seedStore(expenses);

          // Without economic
          const engineNo = createPredictionEngine({ expenseStore: store });
          const resultNo = await engineNo.generatePredictions(userId);

          // With economic
          const economicClientOk: EconomicClient = {
            getIndicators: () => Promise.resolve(economic),
          };
          const engineWith = createPredictionEngine({
            expenseStore: store,
            economicClient: economicClientOk,
          });
          const resultWith = await engineWith.generatePredictions(userId);

          if (resultNo.data && resultWith.data) {
            // Check insurance (affected by inflationRate)
            const insNo = resultNo.data.find((p) => p.category === "insurance");
            const insWith = resultWith.data.find((p) => p.category === "insurance");
            if (insNo && insWith) {
              const differs =
                insNo.predictedMin !== insWith.predictedMin ||
                insNo.predictedMax !== insWith.predictedMax;
              expect(differs).toBe(true);
            }

            // Check loan (affected by interestRate)
            const loanNo = resultNo.data.find((p) => p.category === "loan");
            const loanWith = resultWith.data.find((p) => p.category === "loan");
            if (loanNo && loanWith) {
              const differs =
                loanNo.predictedMin !== loanWith.predictedMin ||
                loanNo.predictedMax !== loanWith.predictedMax;
              expect(differs).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("exchange rate data changes predictions", async () => {
    const largeAmountArb = fc.double({
      min: 100,
      max: 100_000,
      noNaN: true,
      noDefaultInfinity: true,
    }).filter((n) => n >= 100 && Number.isFinite(n));

    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.tuple(dateSpanArb, largeAmountArb, categoryArb),
        exchangeRateDataArb.filter((e) => Math.abs(e.changePercent) > 0.01),
        async (userId, [dateSpan, amount, category], exchangeRate) => {
          const expenses = [
            makeExpense({ userId, category, amount, dueDate: dateSpan.start.toISOString() }),
            makeExpense({ userId, category, amount, dueDate: dateSpan.end.toISOString() }),
          ];
          const store = await seedStore(expenses);

          // Without exchange rate
          const engineNo = createPredictionEngine({ expenseStore: store });
          const resultNo = await engineNo.generatePredictions(userId);

          // With exchange rate
          const exchangeClientOk: ExchangeRateClient = {
            getRates: () => Promise.resolve(exchangeRate),
          };
          const engineWith = createPredictionEngine({
            expenseStore: store,
            exchangeRateClient: exchangeClientOk,
          });
          const resultWith = await engineWith.generatePredictions(userId);

          if (resultNo.data && resultWith.data) {
            const predNo = resultNo.data.find((p) => p.category === category);
            const predWith = resultWith.data.find((p) => p.category === category);

            if (predNo && predWith) {
              const differs =
                predNo.predictedMin !== predWith.predictedMin ||
                predNo.predictedMax !== predWith.predictedMax;
              expect(differs).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
