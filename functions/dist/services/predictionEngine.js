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
    "electricity", "water", "insurance", "loan", "gas",
    "food", "transport", "household", "entertainment", "health", "education", "manual",
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
        // Compute base confidence from historical data volume
        const dataPointCount = userExpenses.length;
        // More data → higher confidence, capped at 1.0 (24+ expenses = full data confidence)
        const dataConfidence = Math.min(1.0, dataPointCount / 24);
        // Boost confidence when external factors are available (up to +0.3)
        const totalExternalFactors = 3; // weather, economic, exchangeRate
        const availableFactors = totalExternalFactors - excludedFactors.length;
        const factorBoost = (availableFactors / totalExternalFactors) * 0.3;
        // Build predictions per category
        const predictions = [];
        for (const category of ALL_CATEGORIES) {
            const avg = categoryAverages.get(category);
            if (avg === undefined || avg === 0)
                continue;
            const { min, max, factors } = computePrediction(category, avg, weather, economic, exchangeRate, excludedFactors);
            // Confidence = 70% data quality + 30% external factor availability, clamped to [0, 1]
            const confidence = Math.min(1.0, Math.max(0.0, dataConfidence * 0.7 + factorBoost));
            predictions.push({
                category,
                predictedMin: Math.max(0, roundTwo(min)),
                predictedMax: Math.max(0, roundTwo(max)),
                confidence: roundTwo(confidence),
                factors,
            });
        }
        return { data: predictions, error: null };
    }
    /**
     * Analyze spending trend for a specific category over N months.
     * Requires at least 3 months of data (Req 4.1).
     * Detects >20% spikes vs 3-month rolling average (Req 4.4).
     */
    async function analyzeTrend(userId, category, months) {
        const all = await expenseStore.getAll();
        const userExpenses = all.filter((e) => e.userId === userId && e.category === category);
        // Group expenses by month (YYYY-MM)
        const monthlyTotals = new Map();
        for (const e of userExpenses) {
            const d = new Date(e.dueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + e.amount);
        }
        // Sort months chronologically and take the last N
        const sortedMonths = Array.from(monthlyTotals.keys()).sort();
        const relevantMonths = sortedMonths.slice(-months);
        // Minimum 3-month data requirement (Req 4.1)
        if (relevantMonths.length < 3) {
            return {
                data: null,
                error: "insufficient data: need at least 3 months of expense history for trend analysis",
            };
        }
        const dataPoints = relevantMonths.map((m) => ({
            month: m,
            amount: monthlyTotals.get(m),
        }));
        // Calculate 3-month rolling average (using the 3 months before the latest)
        const latestAmount = dataPoints[dataPoints.length - 1].amount;
        const rollingWindow = dataPoints.slice(-4, -1); // 3 months before the latest
        const rollingAvg = rollingWindow.length > 0
            ? rollingWindow.reduce((sum, dp) => sum + dp.amount, 0) / rollingWindow.length
            : latestAmount;
        // Calculate change percentage
        const changePercentage = rollingAvg === 0 ? 0 : ((latestAmount - rollingAvg) / rollingAvg) * 100;
        // Determine direction: >5% increasing, <-5% decreasing, otherwise stable
        let direction;
        if (changePercentage > 5) {
            direction = "increasing";
        }
        else if (changePercentage < -5) {
            direction = "decreasing";
        }
        else {
            direction = "stable";
        }
        // Confidence based on data quality (more months = higher confidence)
        const confidence = Math.min(1.0, relevantMonths.length / 12);
        return {
            data: {
                category,
                direction,
                changePercentage: roundTwo(changePercentage),
                confidence: roundTwo(confidence),
                dataPoints,
            },
            error: null,
        };
    }
    /**
     * Detect recurring expenses from user's expense history.
     * Identifies monthly (~30d ±5), quarterly (~90d ±15), and yearly (~365d ±30) patterns.
     */
    async function detectRecurringExpenses(userId) {
        const all = await expenseStore.getAll();
        const userExpenses = all.filter((e) => e.userId === userId);
        if (userExpenses.length === 0)
            return [];
        // Group expenses by category
        const byCategory = new Map();
        for (const e of userExpenses) {
            const list = byCategory.get(e.category) ?? [];
            list.push(e);
            byCategory.set(e.category, list);
        }
        const results = [];
        for (const [category, expenses] of byCategory) {
            // Need at least 2 expenses to detect a pattern
            if (expenses.length < 2)
                continue;
            // Sort by dueDate ascending
            const sorted = [...expenses].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            // Calculate intervals between consecutive expenses (in days)
            const intervals = [];
            for (let i = 1; i < sorted.length; i++) {
                const prev = new Date(sorted[i - 1].dueDate).getTime();
                const curr = new Date(sorted[i].dueDate).getTime();
                intervals.push((curr - prev) / (1000 * 60 * 60 * 24));
            }
            if (intervals.length === 0)
                continue;
            const detected = detectFrequency(intervals);
            if (!detected)
                continue;
            // Calculate average amount
            const avgAmount = sorted.reduce((sum, e) => sum + e.amount, 0) / sorted.length;
            // Calculate next due date from last occurrence
            const lastDate = new Date(sorted[sorted.length - 1].dueDate);
            const nextDueDate = computeNextDueDate(lastDate, detected.frequency);
            results.push({
                category,
                amount: roundTwo(avgAmount),
                frequency: detected.frequency,
                nextDueDate: nextDueDate.toISOString(),
                confidence: roundTwo(detected.confidence),
            });
        }
        return results;
    }
    return { generatePredictions, hasEnoughData, analyzeTrend, detectRecurringExpenses };
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
const FREQUENCY_CONFIGS = [
    { frequency: "monthly", targetDays: 30, toleranceDays: 5 },
    { frequency: "quarterly", targetDays: 90, toleranceDays: 15 },
    { frequency: "yearly", targetDays: 365, toleranceDays: 30 },
];
function detectFrequency(intervals) {
    let bestMatch = null;
    for (const config of FREQUENCY_CONFIGS) {
        const matchingCount = intervals.filter((d) => Math.abs(d - config.targetDays) <= config.toleranceDays).length;
        if (matchingCount === 0)
            continue;
        // Confidence = proportion of intervals that match this frequency
        const confidence = matchingCount / intervals.length;
        if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = { frequency: config.frequency, confidence };
        }
    }
    return bestMatch;
}
function computeNextDueDate(lastDate, frequency) {
    const next = new Date(lastDate);
    switch (frequency) {
        case "monthly":
            next.setMonth(next.getMonth() + 1);
            break;
        case "quarterly":
            next.setMonth(next.getMonth() + 3);
            break;
        case "yearly":
            next.setFullYear(next.getFullYear() + 1);
            break;
    }
    return next;
}
//# sourceMappingURL=predictionEngine.js.map