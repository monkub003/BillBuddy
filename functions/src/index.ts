import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createAuthRouter } from "./routes/authRoutes";
import { createExpenseRouter } from "./routes/expenseRoutes";
import { createPredictionRouter } from "./routes/predictionRoutes";
import { createUserRouter } from "./routes/userRoutes";
import { createDashboardRouter } from "./routes/dashboardRoutes";
import { createBudgetRouter } from "./routes/budgetRoutes";
import { createFinancialRouter } from "./routes/financialRoutes";
import { createScheduledRouter } from "./routes/scheduledRoutes";
import { errorHandlerMiddleware } from "./middleware/responseHelper";
import { createInMemoryStore } from "./services/firestore";
import { UserRecord } from "./services/authService";
import { Expense } from "./types/expense";
import { Budget } from "./types/budget";
import { Notification } from "./types/notification";
import { StoredNotificationPreferences } from "./services/notificationService";
import { UserCorrection } from "./services/categorizationService";

dotenv.config();

// Shared stores so routes operate on the same data
const userStore = createInMemoryStore<UserRecord>();
const expenseStore = createInMemoryStore<Expense>();
const budgetStore = createInMemoryStore<Budget>();
const notificationStore = createInMemoryStore<Notification>();
const notificationPreferencesStore = createInMemoryStore<StoredNotificationPreferences>();
const correctionsStore = createInMemoryStore<UserCorrection>();

// Cast userStore for routes that expect FirestoreStore<User>.
// UserRecord is a superset of User so this is structurally compatible at runtime.
const userStoreAsUser = userStore as unknown as typeof userStore;

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ data: { status: "ok" }, error: null });
});

// Public routes (no auth required)
app.use("/auth", createAuthRouter({ userStore }));

// Protected routes (auth middleware applied inside each router)
app.use("/expenses", createExpenseRouter({
  expenseStore,
  budgetStore,
  userStore: userStoreAsUser as any,
  categorizationDeps: { correctionsStore },
}));
app.use("/predictions", createPredictionRouter({ expenseStore }));
app.use("/users", createUserRouter({ userStore, expenseStore, budgetStore, notificationStore, notificationPreferencesStore }));
app.use("/dashboard", createDashboardRouter({ expenseStore, userStore: userStoreAsUser as any }));
app.use("/budgets", createBudgetRouter({ expenseStore, userStore: userStoreAsUser as any, budgetStore }));
app.use("/financial", createFinancialRouter({ expenseStore, userStore: userStoreAsUser as any, budgetStore }));

// System-level scheduled endpoints (no user auth, protected by API key)
app.use("/scheduled", createScheduledRouter({
  userStore: userStoreAsUser as any,
  expenseStore,
  budgetStore,
  notificationStore,
  notificationPreferencesStore,
}));

// Error handler (must be registered last)
app.use(errorHandlerMiddleware);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`BillBuddy API running on port ${PORT}`);
});

export default app;
