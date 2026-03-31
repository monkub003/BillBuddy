import { Router, Request, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { sanitizeBody, validateBody, incomeSchema } from "../middleware/inputSanitizer";
import { FirestoreStore } from "../services/firestore";
import { UserRecord } from "../services/authService";

export interface UserRoutesDeps {
  userStore: FirestoreStore<UserRecord>;
}

/**
 * Factory that creates the user router.
 * Accepts UserRoutesDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export function createUserRouter(deps: UserRoutesDeps): Router {
  const router = Router();
  const { userStore } = deps;

  // All user routes require authentication
  router.use(authMiddleware);

  // GET /users/me — return current user profile
  router.get("/me", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

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
  router.put("/income", sanitizeBody, validateBody(incomeSchema), async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
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

    const updated: UserRecord = { ...record, monthlyIncome };
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

  return router;
}
