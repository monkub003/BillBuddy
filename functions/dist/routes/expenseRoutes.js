"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpenseRouter = createExpenseRouter;
const express_1 = require("express");
const expenseService_1 = require("../services/expenseService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const inputSanitizer_1 = require("../middleware/inputSanitizer");
const categorizationService_1 = require("../services/categorizationService");
const financialPlanner_1 = require("../services/financialPlanner");
/**
 * Factory that creates the expense router.
 * Accepts optional deps so callers can inject custom stores.
 * Wires categorization into the expense creation pipeline:
 * when creating an expense, auto-categorize if the category is "manual" or not explicitly set.
 */
function createExpenseRouter(deps) {
    const router = (0, express_1.Router)();
    const expenseService = (0, expenseService_1.createExpenseService)(deps);
    const categorizationService = (0, categorizationService_1.createCategorizationService)(deps?.categorizationDeps);
    // Financial planner for budget auto-update on new expense (Req 7.5)
    const financialPlanner = (deps?.budgetStore && deps?.expenseStore)
        ? (0, financialPlanner_1.createFinancialPlanner)({
            expenseStore: deps.expenseStore,
            userStore: deps.userStore,
            budgetStore: deps.budgetStore,
        })
        : null;
    // All expense routes require authentication
    router.use(authMiddleware_1.authMiddleware);
    // POST /expenses — create expense (with auto-categorization pipeline)
    router.post("/", inputSanitizer_1.sanitizeBody, (0, inputSanitizer_1.validateBody)(inputSanitizer_1.expenseSchema), async (req, res) => {
        const userId = req.userId;
        const data = { ...req.body };
        // Auto-categorize if extracted via email/image (not manual entry)
        if (data.extractedVia !== "manual") {
            // Mark extracted expenses for review (Req 1.3)
            data.needsReview = true;
            try {
                const catResult = await categorizationService.categorize(data);
                // Only override category if categorization is confident enough
                if (!catResult.needsUserConfirmation) {
                    data.category = catResult.category;
                }
            }
            catch {
                // Categorization failure is non-fatal — proceed with original category
            }
        }
        const result = await expenseService.createExpense(userId, data);
        if (result.error) {
            const status = mapErrorToStatus(result.error);
            res.status(status).json(result);
            return;
        }
        // Auto-update budget plan when a new expense is added (Req 7.5)
        if (financialPlanner) {
            try {
                await financialPlanner.onExpenseAdded(userId);
            }
            catch {
                // Budget update failure is non-fatal
            }
        }
        res.status(200).json(result);
    });
    // GET /expenses — list expenses with optional query filters
    router.get("/", async (req, res) => {
        const userId = req.userId;
        const filters = {};
        if (req.query.category) {
            filters.category = req.query.category;
        }
        if (req.query.month) {
            filters.month = parseInt(req.query.month, 10);
        }
        if (req.query.year) {
            filters.year = parseInt(req.query.year, 10);
        }
        if (req.query.isPaid !== undefined) {
            filters.isPaid = req.query.isPaid === "true";
        }
        const result = await expenseService.getExpenses(userId, filters);
        res.status(200).json(result);
    });
    // PUT /expenses/:id/confirm — confirm an extracted expense (sets needsReview to false)
    router.put("/:id/confirm", async (req, res) => {
        const userId = req.userId;
        const expenseId = req.params.id;
        const result = await expenseService.confirmExpense(userId, expenseId);
        if (result.error) {
            const status = mapErrorToStatus(result.error);
            res.status(status).json(result);
            return;
        }
        res.status(200).json(result);
    });
    // PUT /expenses/:id — update expense
    router.put("/:id", async (req, res) => {
        const userId = req.userId;
        const expenseId = req.params.id;
        const result = await expenseService.updateExpense(userId, expenseId, req.body);
        if (result.error) {
            const status = mapErrorToStatus(result.error);
            res.status(status).json(result);
            return;
        }
        res.status(200).json(result);
    });
    // DELETE /expenses/:id — delete expense
    router.delete("/:id", async (req, res) => {
        const userId = req.userId;
        const expenseId = req.params.id;
        const result = await expenseService.deleteExpense(userId, expenseId);
        if (result.error) {
            const status = mapErrorToStatus(result.error);
            res.status(status).json(result);
            return;
        }
        res.status(200).json(result);
    });
    return router;
}
/**
 * Maps known error messages to HTTP status codes.
 */
function mapErrorToStatus(error) {
    switch (error) {
        case "amount must be positive":
        case "invalid category":
            return 400;
        case "access denied":
            return 403;
        default:
            return 500;
    }
}
//# sourceMappingURL=expenseRoutes.js.map