import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createAuthRouter } from "./routes/authRoutes";
import { createExpenseRouter } from "./routes/expenseRoutes";
import { createPredictionRouter } from "./routes/predictionRoutes";
import { createUserRouter } from "./routes/userRoutes";
import { errorHandlerMiddleware } from "./middleware/responseHelper";
import { createInMemoryStore } from "./services/firestore";
import { UserRecord } from "./services/authService";

dotenv.config();

// Shared user store so auth and user routes operate on the same data
const userStore = createInMemoryStore<UserRecord>();

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
app.use("/expenses", createExpenseRouter());
app.use("/predictions", createPredictionRouter());
app.use("/users", createUserRouter({ userStore }));

// Error handler (must be registered last)
app.use(errorHandlerMiddleware);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`BillBuddy API running on port ${PORT}`);
});

export default app;
