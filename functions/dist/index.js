"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = require("./routes/authRoutes");
const expenseRoutes_1 = require("./routes/expenseRoutes");
const predictionRoutes_1 = require("./routes/predictionRoutes");
const userRoutes_1 = require("./routes/userRoutes");
const dashboardRoutes_1 = require("./routes/dashboardRoutes");
const budgetRoutes_1 = require("./routes/budgetRoutes");
const financialRoutes_1 = require("./routes/financialRoutes");
const scheduledRoutes_1 = require("./routes/scheduledRoutes");
const responseHelper_1 = require("./middleware/responseHelper");
const firestore_1 = require("./services/firestore");
dotenv_1.default.config();
// Initialize Firebase Admin SDK (auto-connects to emulator when
// FIRESTORE_EMULATOR_HOST is set)
const db = (0, firestore_1.initFirebase)();
// Shared stores backed by real Firestore collections
const userStore = (0, firestore_1.createFirestoreStore)("users", db);
const expenseStore = (0, firestore_1.createFirestoreStore)("expenses", db);
const budgetStore = (0, firestore_1.createFirestoreStore)("budgets", db);
const notificationStore = (0, firestore_1.createFirestoreStore)("notifications", db);
const notificationPreferencesStore = (0, firestore_1.createFirestoreStore)("notificationPreferences", db);
const correctionsStore = (0, firestore_1.createFirestoreStore)("corrections", db);
// Cast userStore for routes that expect FirestoreStore<User>.
// UserRecord is a superset of User so this is structurally compatible at runtime.
const userStoreAsUser = userStore;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check endpoint
app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok" }, error: null });
});
// Public routes (no auth required)
app.use("/auth", (0, authRoutes_1.createAuthRouter)({ userStore }));
// Protected routes (auth middleware applied inside each router)
app.use("/expenses", (0, expenseRoutes_1.createExpenseRouter)({
    expenseStore,
    budgetStore,
    userStore: userStoreAsUser,
    categorizationDeps: { correctionsStore },
}));
app.use("/predictions", (0, predictionRoutes_1.createPredictionRouter)({ expenseStore }));
app.use("/users", (0, userRoutes_1.createUserRouter)({ userStore, expenseStore, budgetStore, notificationStore, notificationPreferencesStore }));
app.use("/dashboard", (0, dashboardRoutes_1.createDashboardRouter)({ expenseStore, userStore: userStoreAsUser }));
app.use("/budgets", (0, budgetRoutes_1.createBudgetRouter)({ expenseStore, userStore: userStoreAsUser, budgetStore }));
app.use("/financial", (0, financialRoutes_1.createFinancialRouter)({ expenseStore, userStore: userStoreAsUser, budgetStore }));
// System-level scheduled endpoints (no user auth, protected by API key)
app.use("/scheduled", (0, scheduledRoutes_1.createScheduledRouter)({
    userStore: userStoreAsUser,
    expenseStore,
    budgetStore,
    notificationStore,
    notificationPreferencesStore,
}));
// Error handler (must be registered last)
app.use(responseHelper_1.errorHandlerMiddleware);
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(Number(PORT), HOST, () => {
    console.log(`BillBuddy API running on ${HOST}:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map