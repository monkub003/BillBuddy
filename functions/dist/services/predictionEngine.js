"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPredictionEngine = createPredictionEngine;
const firestore_1 = require("./firestore");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const UTILITY_CATEGORIES = ["electricity", "water", "gas"];
const FINANCIAL_CATEGORIES = ["insurance", "loan"];
const ALL_CATEGORIES = [
    "electricity", "water", "insurance", "loan", "gas", "manual",
];
const BASE_RANGE_FACTOR = 0.2; // ±20% base range
// ---------------------------------------------------------------------------
// Prediction engine factory
// ---------------------------------------------------------------------------
function createPredictionEngine(deps) {
    const expenseStore = deps?.expenseStore ?? (0, firestore_1.createInMemoryStore)();
    const weatherClient = deps?.weatherClient;
    const economicClient = deps?.economicClient;
    const exchangeRateClient = deps?.exchangeRateClient;
    /**
     * Check if user has at least 1 month of historical data.
     */
    async function hasEnoughData(userId) {
        const all = await expenseStore.getAll();
        const userExpenses = all.filter((e) => e.userId === userId);
        if (userExpenses.length === 0)
            return false;
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
    async function generatePredictions(userId) {
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
        const excludedFactors = [];
        let weather = null;
        let economic = null;
        let exchangeRate = null;
        if (weatherClient) {
            try {
                weather = await weatherClient.getWeather();
            }
            catch {
                excludedFactors.push("weather");
            }
        }
        else {
            excludedFactors.push("weather");
        }
        if (economicClient) {
            try {
                economic = await economicClient.getIndicators();
            }
            catch {
                excludedFactors.push("economic");
            }
        }
        else {
            excludedFactors.push("economic");
        }
        if (exchangeRateClient) {
            try {
                exchangeRate = await exchangeRateClient.getRates();
            }
            catch {
                excludedFactors.push("exchangeRate");
            }
        }
        else {
            excludedFactors.push("exchangeRate");
        }
        // Build predictions per category
        const predictions = [];
        for (const category of ALL_CATEGORIES) {
            const avg = categoryAverages.get(category);
            if (avg === undefined || avg === 0)
                continue;
            const { min, max, factors } = computePrediction(category, avg, weather, economic, exchangeRate, excludedFactors);
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
function computeCategoryAverages(expenses) {
    const sums = new Map();
    const counts = new Map();
    for (const e of expenses) {
        sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount);
        counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    const averages = new Map();
    for (const [cat, sum] of sums) {
        averages.set(cat, sum / (counts.get(cat) ?? 1));
    }
    return averages;
}
function computePrediction(category, average, weather, economic, exchangeRate, _excludedFactors) {
    let multiplier = 1.0;
    let weatherImpact = "none";
    let economicFactor = 0;
    let exchangeRateValue;
    // Weather affects utility categories
    if (weather && UTILITY_CATEGORIES.includes(category)) {
        // Higher temperature → higher electricity (AC), lower gas
        // Higher humidity → higher water usage
        if (category === "electricity") {
            const tempEffect = (weather.temperatureAvg - 25) * 0.01; // 1% per degree above 25
            multiplier += tempEffect;
            weatherImpact = `temperature ${weather.temperatureAvg}°C`;
        }
        else if (category === "water") {
            const humidityEffect = (weather.humidityAvg - 50) * 0.005; // 0.5% per point above 50
            multiplier += humidityEffect;
            weatherImpact = `humidity ${weather.humidityAvg}%`;
        }
        else if (category === "gas") {
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
        }
        else if (category === "loan") {
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
    const factors = {
        weatherImpact,
        economicFactor,
        exchangeRate: exchangeRateValue,
    };
    return { min, max, factors };
}
function roundTwo(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=predictionEngine.js.map