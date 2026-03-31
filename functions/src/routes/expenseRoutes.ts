import { Router, Request, Response } from "express";
import {
  createExpenseService,
  ExpenseServiceDeps,
} from "../services/expenseService";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { sanitizeBody, validateBody, expenseSchema } from "../middleware/inputSanitizer";
import { ExpenseFilters } from "../types/expense";

/**
 * Factory that creates the expense router.
 * Accepts optional ExpenseServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export function createExpenseRouter(deps?: Partial<ExpenseServiceDeps>): Router {
  const router = Router();
  const expenseService = createExpenseService(deps);

  // All expense routes require authentication
  router.use(authMiddleware);

  // POST /expenses — create expense
  router.post("/", sanitizeBody, validateBody(expenseSchema), async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const result = await expenseService.createExpense(userId, req.body);

    if (result.error) {
      const status = mapErrorToStatus(result.error);
      res.status(status).json(result);
      return;
    }

    res.status(200).json(result);
  });

  // GET /expenses — list expenses with optional query filters
  router.get("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    const filters: ExpenseFilters = {};

    if (req.query.category) {
      filters.category = req.query.category as ExpenseFilters["category"];
    }

    if (req.query.month) {
      filters.month = parseInt(req.query.month as string, 10);
    }

    if (req.query.year) {
      filters.year = parseInt(req.query.year as string, 10);
    }

    if (req.query.isPaid !== undefined) {
      filters.isPaid = req.query.isPaid === "true";
    }

    const result = await expenseService.getExpenses(userId, filters);
    res.status(200).json(result);
  });

  // PUT /expenses/:id — update expense
  router.put("/:id", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const expenseId = req.params.id as string;
    const result = await expenseService.updateExpense(userId, expenseId, req.body);

    if (result.error) {
      const status = mapErrorToStatus(result.error);
      res.status(status).json(result);
      return;
    }

    res.status(200).json(result);
  });

  // DELETE /expenses/:id — delete expense
  router.delete("/:id", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const expenseId = req.params.id as string;
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
function mapErrorToStatus(error: string): number {
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
