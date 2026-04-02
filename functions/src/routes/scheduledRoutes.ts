import { Router, Request, Response } from "express";
import { FirestoreStore } from "../services/firestore";
import { User } from "../types/user";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { Notification } from "../types/notification";
import { StoredNotificationPreferences } from "../services/notificationService";
import { createScheduledTasks, ScheduledTasksDeps } from "../services/scheduledTasks";

// ---------------------------------------------------------------------------
// API key middleware for system-level endpoints
// ---------------------------------------------------------------------------

const SCHEDULER_API_KEY_HEADER = "x-scheduler-api-key";

function schedulerAuthMiddleware(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers[SCHEDULER_API_KEY_HEADER] as string | undefined;
  const expectedKey = process.env.SCHEDULER_API_KEY;

  // If no key is configured, allow access (dev/test mode)
  if (!expectedKey) {
    next();
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(403).json({ data: null, error: "forbidden: invalid scheduler API key" });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export interface ScheduledRouterDeps {
  userStore: FirestoreStore<User>;
  expenseStore: FirestoreStore<Expense>;
  budgetStore: FirestoreStore<Budget>;
  notificationStore?: FirestoreStore<Notification>;
  notificationPreferencesStore?: FirestoreStore<StoredNotificationPreferences>;
}

export function createScheduledRouter(deps: ScheduledRouterDeps): Router {
  const router = Router();

  const tasksDeps: ScheduledTasksDeps = {
    userStore: deps.userStore,
    expenseStore: deps.expenseStore,
    budgetStore: deps.budgetStore,
    notificationServiceDeps: {
      notificationStore: deps.notificationStore,
      notificationPreferencesStore: deps.notificationPreferencesStore,
    },
    predictionEngineDeps: {
      expenseStore: deps.expenseStore,
    },
  };

  const scheduledTasks = createScheduledTasks(tasksDeps);

  // All scheduled endpoints require the scheduler API key
  router.use(schedulerAuthMiddleware);

  // POST /scheduled/daily-notifications
  router.post("/daily-notifications", async (_req: Request, res: Response) => {
    try {
      const result = await scheduledTasks.runDailyNotifications();
      res.json({ data: result, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ data: null, error: message });
    }
  });

  // POST /scheduled/weekly-trends
  router.post("/weekly-trends", async (_req: Request, res: Response) => {
    try {
      const result = await scheduledTasks.runWeeklyTrendAnalysis();
      res.json({ data: result, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ data: null, error: message });
    }
  });

  return router;
}
