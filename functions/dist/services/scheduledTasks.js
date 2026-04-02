"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScheduledTasks = createScheduledTasks;
const notificationService_1 = require("./notificationService");
const predictionEngine_1 = require("./predictionEngine");
const financialPlanner_1 = require("./financialPlanner");
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createScheduledTasks(deps) {
    const { userStore, expenseStore, budgetStore } = deps;
    const notificationService = (0, notificationService_1.createNotificationService)(deps.notificationServiceDeps);
    const predictionEngine = (0, predictionEngine_1.createPredictionEngine)({
        expenseStore,
        ...deps.predictionEngineDeps,
    });
    const financialPlanner = (0, financialPlanner_1.createFinancialPlanner)({
        expenseStore,
        userStore,
        budgetStore,
    });
    /**
     * Daily notification check (Req 5.1, 5.3, 5.4).
     *
     * For each user:
     * 1. Detect recurring expenses and send bill due reminders for those
     *    within the lead-time window (7 days for monthly/quarterly, 30 days for yearly).
     * 2. Check budget status and send budget alerts when spending >= 80% of budget.
     */
    async function runDailyNotifications() {
        const result = {
            usersProcessed: 0,
            billReminders: 0,
            budgetAlerts: 0,
            errors: [],
        };
        const allUsers = await userStore.getAll();
        const now = new Date();
        for (const user of allUsers) {
            try {
                result.usersProcessed++;
                // --- Bill due reminders (Req 5.1, 5.3) ---
                const recurringExpenses = await predictionEngine.detectRecurringExpenses(user.id);
                for (const bill of recurringExpenses) {
                    if ((0, notificationService_1.shouldSendReminder)(bill, now)) {
                        await notificationService.sendBillDueReminder(user.id, bill);
                        result.billReminders++;
                    }
                }
                // --- Budget alerts (Req 5.4) ---
                const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                const budgetId = `${user.id}-${month}`;
                const budget = await budgetStore.get(budgetId);
                if (budget && budget.totalBudget > 0) {
                    const allExpenses = await expenseStore.findAllBy("userId", user.id);
                    const monthExpenses = allExpenses.filter((e) => {
                        const d = new Date(e.dueDate);
                        const expMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        return expMonth === month;
                    });
                    const spentTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
                    const usagePercentage = spentTotal / budget.totalBudget;
                    // Find over-budget categories
                    const categorySpending = new Map();
                    for (const e of monthExpenses) {
                        categorySpending.set(e.category, (categorySpending.get(e.category) ?? 0) + e.amount);
                    }
                    const overBudgetCategories = [];
                    for (const cb of budget.categoryBudgets) {
                        const spent = categorySpending.get(cb.category) ?? 0;
                        if (cb.amount > 0 && spent > cb.amount) {
                            overBudgetCategories.push(cb.category);
                        }
                    }
                    const budgetStatus = {
                        month,
                        budgetTotal: budget.totalBudget,
                        spentTotal,
                        usagePercentage,
                        overBudgetCategories,
                    };
                    if ((0, notificationService_1.isBudgetAlertNeeded)(budgetStatus)) {
                        await notificationService.sendBudgetAlert(user.id, budgetStatus);
                        result.budgetAlerts++;
                    }
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                result.errors.push(`User ${user.id}: ${msg}`);
            }
        }
        return result;
    }
    /**
     * Weekly trend analysis update (Req 4.4, 7.5).
     *
     * For each user:
     * 1. Run trend analysis for each expense category.
     * 2. Detect spending spikes (>20% vs 3-month average) and send warnings.
     * 3. Update budget plans with latest trend data.
     */
    async function runWeeklyTrendAnalysis() {
        const result = {
            usersProcessed: 0,
            spikeWarnings: 0,
            budgetPlansUpdated: 0,
            errors: [],
        };
        const allUsers = await userStore.getAll();
        const categories = [
            "electricity", "water", "insurance", "loan", "gas",
            "food", "transport", "household", "entertainment", "health", "education", "manual",
        ];
        for (const user of allUsers) {
            try {
                result.usersProcessed++;
                // --- Trend analysis per category (Req 4.4) ---
                for (const category of categories) {
                    const trendResult = await predictionEngine.analyzeTrend(user.id, category, 6);
                    if (trendResult.data && trendResult.data.changePercentage > 20) {
                        // Spike detected — generate prediction-based warning
                        const predictions = await predictionEngine.generatePredictions(user.id);
                        if (predictions.data) {
                            const categoryPrediction = predictions.data.find((p) => p.category === category);
                            if (categoryPrediction && (0, notificationService_1.isPredictedSpike)(categoryPrediction)) {
                                await notificationService.sendExpenseWarning(user.id, categoryPrediction);
                                result.spikeWarnings++;
                            }
                        }
                    }
                }
                // --- Update budget plan with latest trend data (Req 7.5) ---
                try {
                    await financialPlanner.generateBudgetPlan(user.id);
                    result.budgetPlansUpdated++;
                }
                catch {
                    // Budget plan generation may fail if user has no expenses — that's ok
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                result.errors.push(`User ${user.id}: ${msg}`);
            }
        }
        return result;
    }
    return {
        runDailyNotifications,
        runWeeklyTrendAnalysis,
    };
}
//# sourceMappingURL=scheduledTasks.js.map