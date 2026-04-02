"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_PREFERENCES = void 0;
exports.getLeadDays = getLeadDays;
exports.shouldSendReminder = shouldSendReminder;
exports.isPredictedSpike = isPredictedSpike;
exports.isBudgetAlertNeeded = isBudgetAlertNeeded;
exports.createNotificationService = createNotificationService;
const firestore_1 = require("./firestore");
const noopFCMClient = {
    async send() {
        /* no-op for MVP / testing */
    },
};
// ---------------------------------------------------------------------------
// Default preferences returned when none exist yet
// ---------------------------------------------------------------------------
exports.DEFAULT_NOTIFICATION_PREFERENCES = {
    channels: ["push"],
    billReminder: { enabled: true, daysBefore: 7 },
    budgetAlert: { enabled: true, threshold: 0.8 },
    trendWarning: { enabled: true },
    yearlyExpenseReminder: { enabled: true, daysBefore: 30 },
};
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LEAD_DAYS_MONTHLY_QUARTERLY = 7;
const LEAD_DAYS_YEARLY = 30;
const EXPENSE_SPIKE_THRESHOLD = 0.15; // >15%
const BUDGET_USAGE_THRESHOLD = 0.80; // ≥80%
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId() {
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function nowISO() {
    return new Date().toISOString();
}
/**
 * Calculate the lead time in days for a bill reminder based on its frequency.
 * - monthly / quarterly → 7 days
 * - yearly → 30 days
 */
function getLeadDays(frequency) {
    return frequency === "yearly"
        ? LEAD_DAYS_YEARLY
        : LEAD_DAYS_MONTHLY_QUARTERLY;
}
/**
 * Determine whether a bill due reminder should fire for the given bill
 * relative to `referenceDate`. Returns true when the bill's nextDueDate
 * falls within the appropriate lead-time window (inclusive of the due date
 * itself, exclusive of dates already past).
 */
function shouldSendReminder(bill, referenceDate = new Date()) {
    const dueDate = new Date(bill.nextDueDate);
    const leadDays = getLeadDays(bill.frequency);
    const diffMs = dueDate.getTime() - referenceDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Reminder window: 0 ≤ diffDays ≤ leadDays
    return diffDays >= 0 && diffDays <= leadDays;
}
/**
 * Determine whether a prediction represents a >15% spike.
 */
function isPredictedSpike(prediction) {
    const midpoint = (prediction.predictedMin + prediction.predictedMax) / 2;
    // We treat the factors.economicFactor as the baseline average when available,
    // otherwise fall back to predictedMin as a conservative baseline.
    const baseline = prediction.factors.economicFactor > 0
        ? prediction.factors.economicFactor
        : prediction.predictedMin;
    if (baseline <= 0)
        return false;
    const increase = (midpoint - baseline) / baseline;
    return increase > EXPENSE_SPIKE_THRESHOLD;
}
/**
 * Determine whether budget usage has reached the alert threshold (≥80%).
 */
function isBudgetAlertNeeded(budgetStatus) {
    return budgetStatus.usagePercentage >= BUDGET_USAGE_THRESHOLD;
}
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createNotificationService(deps) {
    const notificationStore = deps?.notificationStore ?? (0, firestore_1.createInMemoryStore)();
    const notificationPreferencesStore = deps?.notificationPreferencesStore ?? (0, firestore_1.createInMemoryStore)();
    const fcmClient = deps?.fcmClient ?? noopFCMClient;
    // -----------------------------------------------------------------------
    // sendBillDueReminder
    // Req 5.1, 5.3 – 7 days for monthly/quarterly, 30 days for yearly
    // -----------------------------------------------------------------------
    async function sendBillDueReminder(userId, bill) {
        const leadDays = getLeadDays(bill.frequency);
        const title = `Bill Due Reminder: ${bill.category}`;
        const body = `Your ${bill.category} bill of ฿${bill.amount.toLocaleString()} ` +
            `is due on ${bill.nextDueDate}. ` +
            `(${leadDays}-day advance notice for ${bill.frequency} bills)`;
        const notification = {
            id: generateId(),
            userId,
            type: "bill_due",
            title,
            body,
            data: {
                category: bill.category,
                amount: bill.amount,
                dueDate: bill.nextDueDate,
                frequency: bill.frequency,
                leadDays,
            },
            channel: "push",
            sentAt: nowISO(),
            readAt: null,
        };
        await notificationStore.set(notification.id, notification);
        await fcmClient.send(userId, title, body);
    }
    // -----------------------------------------------------------------------
    // sendExpenseWarning
    // Req 5.2 – predicted >15% spike
    // -----------------------------------------------------------------------
    async function sendExpenseWarning(userId, prediction) {
        const midpoint = (prediction.predictedMin + prediction.predictedMax) / 2;
        const baseline = prediction.factors.economicFactor > 0
            ? prediction.factors.economicFactor
            : prediction.predictedMin;
        const increasePercent = baseline > 0
            ? Math.round(((midpoint - baseline) / baseline) * 100)
            : 0;
        const title = `Expense Warning: ${prediction.category}`;
        const body = `Predicted ${prediction.category} expense is ฿${midpoint.toLocaleString()} ` +
            `(~${increasePercent}% above average). Consider budgeting accordingly.`;
        const notification = {
            id: generateId(),
            userId,
            type: "trend_warning",
            title,
            body,
            data: {
                category: prediction.category,
                predictedMin: prediction.predictedMin,
                predictedMax: prediction.predictedMax,
                increasePercent,
                confidence: prediction.confidence,
            },
            channel: "push",
            sentAt: nowISO(),
            readAt: null,
        };
        await notificationStore.set(notification.id, notification);
        await fcmClient.send(userId, title, body);
    }
    // -----------------------------------------------------------------------
    // sendBudgetAlert
    // Req 5.4 – spending ≥ 80% of budget
    // -----------------------------------------------------------------------
    async function sendBudgetAlert(userId, budgetStatus) {
        const pct = Math.round(budgetStatus.usagePercentage * 100);
        const title = "Budget Alert";
        const body = `You've spent ฿${budgetStatus.spentTotal.toLocaleString()} ` +
            `of your ฿${budgetStatus.budgetTotal.toLocaleString()} budget ` +
            `(${pct}%) for ${budgetStatus.month}.`;
        const overBudgetInfo = budgetStatus.overBudgetCategories.length > 0
            ? budgetStatus.overBudgetCategories.join(", ")
            : "none";
        const notification = {
            id: generateId(),
            userId,
            type: "budget_alert",
            title,
            body,
            data: {
                month: budgetStatus.month,
                budgetTotal: budgetStatus.budgetTotal,
                spentTotal: budgetStatus.spentTotal,
                usagePercentage: budgetStatus.usagePercentage,
                overBudgetCategories: overBudgetInfo,
            },
            channel: "push",
            sentAt: nowISO(),
            readAt: null,
        };
        await notificationStore.set(notification.id, notification);
        await fcmClient.send(userId, title, body);
    }
    // -----------------------------------------------------------------------
    // getNotificationPreferences
    // Req 5.5 – retrieve user preferences, return defaults if none exist
    // -----------------------------------------------------------------------
    async function getNotificationPreferences(userId) {
        const stored = await notificationPreferencesStore.findBy("userId", userId);
        if (!stored) {
            return {
                ...exports.DEFAULT_NOTIFICATION_PREFERENCES,
                channels: [...exports.DEFAULT_NOTIFICATION_PREFERENCES.channels],
                billReminder: { ...exports.DEFAULT_NOTIFICATION_PREFERENCES.billReminder },
                budgetAlert: { ...exports.DEFAULT_NOTIFICATION_PREFERENCES.budgetAlert },
                trendWarning: { ...exports.DEFAULT_NOTIFICATION_PREFERENCES.trendWarning },
                yearlyExpenseReminder: { ...exports.DEFAULT_NOTIFICATION_PREFERENCES.yearlyExpenseReminder },
            };
        }
        const { id: _id, userId: _uid, ...prefs } = stored;
        return prefs;
    }
    // -----------------------------------------------------------------------
    // updateNotificationPreferences
    // Req 5.5 – upsert user preferences
    // -----------------------------------------------------------------------
    async function updateNotificationPreferences(userId, prefs) {
        const existing = await notificationPreferencesStore.findBy("userId", userId);
        const id = existing?.id ?? `pref-${userId}`;
        await notificationPreferencesStore.set(id, { ...prefs, id, userId });
    }
    return {
        sendBillDueReminder,
        sendExpenseWarning,
        sendBudgetAlert,
        getNotificationPreferences,
        updateNotificationPreferences,
        // Expose stores for testing / downstream use
        notificationStore,
        notificationPreferencesStore,
    };
}
//# sourceMappingURL=notificationService.js.map