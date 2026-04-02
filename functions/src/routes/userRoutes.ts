import { Router, Request, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { sanitizeBody, validateBody, incomeSchema } from "../middleware/inputSanitizer";
import { FirestoreStore } from "../services/firestore";
import { UserRecord } from "../services/authService";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { Notification } from "../types/notification";
import { createAccountService } from "../services/accountService";
import { createNotificationService, StoredNotificationPreferences } from "../services/notificationService";
import { StorageBucket } from "../services/storageCleanup";

export interface UserRoutesDeps {
  userStore: FirestoreStore<UserRecord>;
  expenseStore?: FirestoreStore<Expense>;
  budgetStore?: FirestoreStore<Budget>;
  notificationStore?: FirestoreStore<Notification>;
  notificationPreferencesStore?: FirestoreStore<StoredNotificationPreferences>;
  storageBucket?: StorageBucket;
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

  // --- Notification Preferences ---
  const notificationService = createNotificationService({
    notificationStore: deps.notificationStore,
    notificationPreferencesStore: deps.notificationPreferencesStore,
  });

  // GET /users/notification-preferences — get notification preferences
  router.get("/notification-preferences", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    try {
      const prefs = await notificationService.getNotificationPreferences(userId);
      res.status(200).json({ data: prefs, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // PUT /users/notification-preferences — update notification preferences
  router.put("/notification-preferences", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    const prefs = req.body;

    if (!prefs || typeof prefs !== "object") {
      res.status(400).json({ data: null, error: "invalid preferences" });
      return;
    }

    try {
      await notificationService.updateNotificationPreferences(userId, prefs);
      const updated = await notificationService.getNotificationPreferences(userId);
      res.status(200).json({ data: updated, error: null });
    } catch {
      res.status(500).json({ data: null, error: "internal server error" });
    }
  });

  // DELETE /users/account — delete authenticated user's account and all data
  router.delete("/account", async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;

    const record = await userStore.get(userId);
    if (!record) {
      res.status(404).json({ data: null, error: "user not found" });
      return;
    }

    const accountService = createAccountService({
      userStore,
      expenseStore: deps.expenseStore!,
      budgetStore: deps.budgetStore!,
      notificationStore: deps.notificationStore!,
      storageBucket: deps.storageBucket,
    });

    const result = await accountService.deleteAccount(userId);

    res.status(200).json({ data: result, error: null });
  });

  return router;
}
