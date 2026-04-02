"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScheduledRouter = createScheduledRouter;
const express_1 = require("express");
const scheduledTasks_1 = require("../services/scheduledTasks");
// ---------------------------------------------------------------------------
// API key middleware for system-level endpoints
// ---------------------------------------------------------------------------
const SCHEDULER_API_KEY_HEADER = "x-scheduler-api-key";
function schedulerAuthMiddleware(req, res, next) {
    const apiKey = req.headers[SCHEDULER_API_KEY_HEADER];
    const expectedKey = process.env.SCHEDULER_API_KEY;
    // If no key is configured, allow access (dev/test mode)
    if (!expectedKey) {
        next();
        return;
    }
    if (!apiKey || apiKey !== expectedKey) {
        res.status(403).json({ data: null, error: "forbidden: invalid scheduler API key" });
        return;
    }
    next();
}
function createScheduledRouter(deps) {
    const router = (0, express_1.Router)();
    const tasksDeps = {
        userStore: deps.userStore,
        expenseStore: deps.expenseStore,
        budgetStore: deps.budgetStore,
        notificationServiceDeps: {
            notificationStore: deps.notificationStore,
            notificationPreferencesStore: deps.notificationPreferencesStore,
        },
        predictionEngineDeps: {
            expenseStore: deps.expenseStore,
        },
    };
    const scheduledTasks = (0, scheduledTasks_1.createScheduledTasks)(tasksDeps);
    // All scheduled endpoints require the scheduler API key
    router.use(schedulerAuthMiddleware);
    // POST /scheduled/daily-notifications
    router.post("/daily-notifications", async (_req, res) => {
        try {
            const result = await scheduledTasks.runDailyNotifications();
            res.json({ data: result, error: null });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ data: null, error: message });
        }
    });
    // POST /scheduled/weekly-trends
    router.post("/weekly-trends", async (_req, res) => {
        try {
            const result = await scheduledTasks.runWeeklyTrendAnalysis();
            res.json({ data: result, error: null });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ data: null, error: message });
        }
    });
    return router;
}
//# sourceMappingURL=scheduledRoutes.js.map