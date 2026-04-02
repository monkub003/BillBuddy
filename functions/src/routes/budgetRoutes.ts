import { Router, Request, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { FirestoreStore } from "../services/firestore";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { User } from "../types/user";
import { createFinancialPlanner } from "../services/financialPlanner";

export interface BudgetRoutesDeps {
  expenseStore: FirestoreStore<Expense>;
  userStore: FirestoreStore<User>;
  budgetStore: FirestoreStore<Budget>;
}

export function createBudgetRouter(deps: BudgetRoutesDeps): Router {
  const router = Router();
  const { expenseStore, userStore, budgetStore } = deps;
  const financialPlanner = createFinancialPlanner({ expenseStore, userStore, budgetStore });

  router.use(authMiddleware);

  // GET /budgets — get current budget plan for the authenticated user
  router.get("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    try {
      const plan = await financialPlanner.generateBudgetPlan(userId);
      res.status(200).json({ data: plan, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // POST /budgets — generate a budget plan (optionally with savings goal)
  router.post("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const { savingsGoal } = req.body;

    try {
      let plan;
      if (typeof savingsGoal === "number" && savingsGoal > 0) {
        plan = await financialPlanner.calculateBudgetFromSavingsGoal(userId, savingsGoal);
      } else {
        plan = await financialPlanner.generateBudgetPlan(userId);
      }
      res.status(200).json({ data: plan, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // PUT /budgets — update budget with savings goal
  router.put("/", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const { savingsGoal } = req.body;

    if (typeof savingsGoal !== "number" || savingsGoal < 0) {
      res.status(400).json({ data: null, error: "savingsGoal must be a non-negative number" });
      return;
    }

    try {
      const plan = await financialPlanner.calculateBudgetFromSavingsGoal(userId, savingsGoal);
      res.status(200).json({ data: plan, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  return router;
}
