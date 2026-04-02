"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserRouter = createUserRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const inputSanitizer_1 = require("../middleware/inputSanitizer");
const accountService_1 = require("../services/accountService");
const notificationService_1 = require("../services/notificationService");
/**
 * Factory that creates the user router.
 * Accepts UserRoutesDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
function createUserRouter(deps) {
    const router = (0, express_1.Router)();
    const { userStore } = deps;
    // All user routes require authentication
    router.use(authMiddleware_1.authMiddleware);
    // GET /users/me — return current user profile
    router.get("/me", async (req, res) => {
        const userId = req.userId;
        const record = await userStore.get(userId);
        if (!record) {
            res.status(404).json({ data: null, error: "user not found" });
            return;
        }
        res.status(200).json({
            data: {
                id: record.id,
                email: record.email,
                monthlyIncome: record.monthlyIncome,
                createdAt: record.createdAt,
            },
            error: null,
        });
    });
    // PUT /users/income — update monthly_income for authenticated user
    router.put("/income", inputSanitizer_1.sanitizeBody, (0, inputSanitizer_1.validateBody)(inputSanitizer_1.incomeSchema), async (req, res) => {
        const userId = req.userId;
        const { monthlyIncome } = req.body;
        if (typeof monthlyIncome !== "number" || monthlyIncome <= 0) {
            res.status(400).json({ data: null, error: "income must be positive" });
            return;
        }
        const record = await userStore.get(userId);
        if (!record) {
            res.status(404).json({ data: null, error: "user not found" });
            return;
        }
        const updated = { ...record, monthlyIncome };
        await userStore.set(userId, updated);
        res.status(200).json({
            data: {
                id: updated.id,
                email: updated.email,
                monthlyIncome: updated.monthlyIncome,
                createdAt: updated.createdAt,
            },
            error: null,
        });
    });
    // --- Notification Preferences ---
    const notificationService = (0, notificationService_1.createNotificationService)({
        notificationStore: deps.notificationStore,
        notificationPreferencesStore: deps.notificationPreferencesStore,
    });
    // GET /users/notification-preferences — get notification preferences
    router.get("/notification-preferences", async (req, res) => {
        const userId = req.userId;
        try {
            const prefs = await notificationService.getNotificationPreferences(userId);
            res.status(200).json({ data: prefs, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // PUT /users/notification-preferences — update notification preferences
    router.put("/notification-preferences", async (req, res) => {
        const userId = req.userId;
        const prefs = req.body;
        if (!prefs || typeof prefs !== "object") {
            res.status(400).json({ data: null, error: "invalid preferences" });
            return;
        }
        try {
            await notificationService.updateNotificationPreferences(userId, prefs);
            const updated = await notificationService.getNotificationPreferences(userId);
            res.status(200).json({ data: updated, error: null });
        }
        catch {
            res.status(500).json({ data: null, error: "internal server error" });
        }
    });
    // DELETE /users/account — delete authenticated user's account and all data
    router.delete("/account", async (req, res) => {
        const userId = req.userId;
        const record = await userStore.get(userId);
        if (!record) {
            res.status(404).json({ data: null, error: "user not found" });
            return;
        }
        const accountService = (0, accountService_1.createAccountService)({
            userStore,
            expenseStore: deps.expenseStore,
            budgetStore: deps.budgetStore,
            notificationStore: deps.notificationStore,
            storageBucket: deps.storageBucket,
        });
        const result = await accountService.deleteAccount(userId);
        res.status(200).json({ data: result, error: null });
    });
    return router;
}
//# sourceMappingURL=userRoutes.js.map