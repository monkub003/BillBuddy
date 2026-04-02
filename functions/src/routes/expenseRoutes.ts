import { Router, Request, Response } from "express";
import {
  createExpenseService,
  ExpenseServiceDeps,
} from "../services/expenseService";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { sanitizeBody, validateBody, expenseSchema } from "../middleware/inputSanitizer";
import { ExpenseFilters } from "../types/expense";
import { Budget } from "../types/budget";
import { User } from "../types/user";
import { FirestoreStore } from "../services/firestore";
import { createCategorizationService, CategorizationServiceDeps } from "../services/categorizationService";
import { createFinancialPlanner } from "../services/financialPlanner";

export interface ExpenseRoutesDeps extends Partial<ExpenseServiceDeps> {
  categorizationDeps?: CategorizationServiceDeps;
  budgetStore?: FirestoreStore<Budget>;
  userStore?: FirestoreStore<User>;
}

/**
 * Factory that creates the expense router.
 * Accepts optional deps so callers can inject custom stores.
 * Wires categorization into the expense creation pipeline:
 * when creating an expense, auto-categorize if the category is "manual" or not explicitly set.
 */
export function createExpenseRouter(deps?: ExpenseRoutesDeps): Router {
  const router = Router();
  const expenseService = createExpenseService(deps);
  const categorizationService = createCategorizationService(deps?.categorizationDeps);

  // Financial planner for budget auto-update on new expense (Req 7.5)
  const financialPlanner = (deps?.budgetStore && deps?.expenseStore)
    ? createFinancialPlanner({
        expenseStore: deps.expenseStore,
        userStore: deps.userStore,
        budgetStore: deps.budgetStore,
      })
    : null;

  // All expense routes require authentication
  router.use(authMiddleware);

  // POST /expenses — create expense (with auto-categorization pipeline)
  router.post("/", sanitizeBody, validateBody(expenseSchema), async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
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
      } catch {
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
      } catch {
        // Budget update failure is non-fatal
      }
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

  // PUT /expenses/:id/confirm — confirm an extracted expense (sets needsReview to false)
  router.put("/:id/confirm", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const expenseId = req.params.id as string;
    const result = await expenseService.confirmExpense(userId, expenseId);

    if (result.error) {
      const status = mapErrorToStatus(result.error);
      res.status(status).json(result);
      return;
    }

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
