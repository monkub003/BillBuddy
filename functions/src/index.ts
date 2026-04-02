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
import { createInsightRouter } from "./routes/insightRoutes";
import { errorHandlerMiddleware } from "./middleware/responseHelper";
import { initFirebase, createFirestoreStore } from "./services/firestore";
import { UserRecord } from "./services/authService";
import { Expense } from "./types/expense";
import { Budget } from "./types/budget";
import { Notification } from "./types/notification";
import { StoredNotificationPreferences } from "./services/notificationService";
import { UserCorrection } from "./services/categorizationService";

dotenv.config();

// Initialize Firebase Admin SDK (auto-connects to emulator when
// FIRESTORE_EMULATOR_HOST is set)
const db = initFirebase();

// Shared stores backed by real Firestore collections
const userStore = createFirestoreStore<UserRecord>("users", db);
const expenseStore = createFirestoreStore<Expense>("expenses", db);
const budgetStore = createFirestoreStore<Budget>("budgets", db);
const notificationStore = createFirestoreStore<Notification>("notifications", db);
const notificationPreferencesStore = createFirestoreStore<StoredNotificationPreferences>("notificationPreferences", db);
const correctionsStore = createFirestoreStore<UserCorrection>("corrections", db);

// Cast userStore for routes that expect FirestoreStore<User>.
// UserRecord is a superset of User so this is structurally compatible at runtime.
const userStoreAsUser = userStore as unknown as typeof userStore;

const app = express();

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
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
app.use("/insights", createInsightRouter({ expenseStore }));

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
const HOST = process.env.HOST || "0.0.0.0";

app.listen(Number(PORT), HOST, () => {
  console.log(`BillBuddy API running on ${HOST}:${PORT}`);
});

export default app;
