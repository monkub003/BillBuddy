import { Router, Request, Response } from "express";
import {
  createDashboardService,
  DashboardServiceDeps,
} from "../services/dashboardService";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { ExpenseCategory } from "../types/api";

/**
 * Factory that creates the dashboard router.
 * Accepts optional DashboardServiceDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export function createDashboardRouter(deps?: Partial<DashboardServiceDeps>): Router {
  const router = Router();
  const dashboardService = createDashboardService(deps);

  // All dashboard routes require authentication
  router.use(authMiddleware);

  // GET /dashboard — aggregated dashboard data
  router.get("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const month = req.query.month as string | undefined;

    try {
      const result = await dashboardService.getDashboardData(userId, month);
      res.status(200).json(result);
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // GET /dashboard/category/:category — expenses filtered by category
  router.get("/category/:category", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const category = req.params.category as string;

    const validCategories: ExpenseCategory[] = [
      "electricity", "water", "insurance", "loan", "gas", "manual",
    ];

    if (!validCategories.includes(category as ExpenseCategory)) {
      res.status(400).json({ data: null, error: "invalid category" });
      return;
    }

    try {
      const result = await dashboardService.getExpensesByCategory(userId, category as ExpenseCategory);
      res.status(200).json(result);
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  return router;
}
