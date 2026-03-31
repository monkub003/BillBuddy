"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpenseRouter = createExpenseRouter;
const express_1 = require("express");
const expenseService_1 = require("../services/expenseService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const inputSanitizer_1 = require("../middleware/inputSanitizer");
/**
 * Factory that creates the expense router.
 * Accepts optional ExpenseServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
function createExpenseRouter(deps) {
    const router = (0, express_1.Router)();
    const expenseService = (0, expenseService_1.createExpenseService)(deps);
    // All expense routes require authentication
    router.use(authMiddleware_1.authMiddleware);
    // POST /expenses — create expense
    router.post("/", inputSanitizer_1.sanitizeBody, (0, inputSanitizer_1.validateBody)(inputSanitizer_1.expenseSchema), async (req, res) => {
        const userId = req.userId;
        const result = await expenseService.createExpense(userId, req.body);
        if (result.error) {
            const status = mapErrorToStatus(result.error);
            res.status(status).json(result);
            return;
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