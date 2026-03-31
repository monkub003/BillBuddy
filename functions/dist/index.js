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
const responseHelper_1 = require("./middleware/responseHelper");
const firestore_1 = require("./services/firestore");
dotenv_1.default.config();
// Shared user store so auth and user routes operate on the same data
const userStore = (0, firestore_1.createInMemoryStore)();
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
app.use("/expenses", (0, expenseRoutes_1.createExpenseRouter)());
app.use("/predictions", (0, predictionRoutes_1.createPredictionRouter)());
app.use("/users", (0, userRoutes_1.createUserRouter)({ userStore }));
// Error handler (must be registered last)
app.use(responseHelper_1.errorHandlerMiddleware);
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`BillBuddy API running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map