import { Router, Request, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { FirestoreStore } from "../services/firestore";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { User } from "../types/user";
import { createFinancialPlanner } from "../services/financialPlanner";

export interface FinancialRoutesDeps {
  expenseStore: FirestoreStore<Expense>;
  userStore: FirestoreStore<User>;
  budgetStore: FirestoreStore<Budget>;
}

export function createFinancialRouter(deps: FinancialRoutesDeps): Router {
  const router = Router();
  const { expenseStore, userStore, budgetStore } = deps;
  const financialPlanner = createFinancialPlanner({ expenseStore, userStore, budgetStore });

  router.use(authMiddleware);

  // GET /financial/ratio-history — expense-to-income ratio for past N months
  router.get("/ratio-history", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 6;

    try {
      const history = await financialPlanner.getExpenseRatioHistory(userId, months);
      res.status(200).json({ data: history, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // GET /financial/forecast — forecast expenses for N months ahead
  router.get("/forecast", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 3;

    try {
      const forecast = await financialPlanner.forecastExpenses(userId, months);
      res.status(200).json({ data: forecast, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // GET /financial/suggestions — cost reduction suggestions
  router.get("/suggestions", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    try {
      const suggestions = await financialPlanner.suggestCostReduction(userId);
      res.status(200).json({ data: suggestions, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  return router;
}
