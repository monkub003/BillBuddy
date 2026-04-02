/**
 * Integration tests for auth endpoints.
 *
 * Spins up the full Express app in-process (same as Docker runs)
 * and tests signup/login flows end-to-end using supertest.
 *
 * Run with:
 *   npx jest tests/integration/auth-e2e.test.ts
 */

import express from "express";
import request from "supertest";
import { createAuthRouter } from "../../src/routes/authRoutes";
import { createExpenseRouter } from "../../src/routes/expenseRoutes";
import { createUserRouter } from "../../src/routes/userRoutes";
import { createInMemoryStore } from "../../src/services/firestore";
import type { UserRecord } from "../../src/services/authService";
import type { Expense } from "../../src/types/expense";
import type { Budget } from "../../src/types/budget";
import type { Notification } from "../../src/types/notification";
import type { StoredNotificationPreferences } from "../../src/services/notificationService";
import type { UserCorrection } from "../../src/services/categorizationService";
import cors from "cors";

const TEST_JWT_SECRET = "integration-test-secret";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

/**
 * Build a full app with shared stores — mirrors what Docker runs.
 */
function buildApp() {
  const userStore = createInMemoryStore<UserRecord>();
  const expenseStore = createInMemoryStore<Expense>();
  const budgetStore = createInMemoryStore<Budget>();
  const notificationStore = createInMemoryStore<Notification>();
  const notificationPreferencesStore = createInMemoryStore<StoredNotificationPreferences>();
  const correctionsStore = createInMemoryStore<UserCorrection>();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok" }, error: null });
  });

  app.use("/auth", createAuthRouter({ userStore }));
  app.use("/expenses", createExpenseRouter({
    expenseStore,
    budgetStore,
    userStore: userStore as any,
    categorizationDeps: { correctionsStore },
  }));
  app.use("/users", createUserRouter({
    userStore,
    expenseStore,
    budgetStore,
    notificationStore,
    notificationPreferencesStore,
  }));

  return app;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe("API health", () => {
  it("GET /health returns ok", async () => {
    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

describe("POST /auth/signup", () => {
  it("creates a new user and returns token + user", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "new@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.email).toBe("new@example.com");
    expect(res.body.data.user.id).toBeDefined();
  });

  it("rejects invalid email", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("invalid email");
  });

  it("rejects password shorter than 8 characters", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "user@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("password too short");
  });

  it("rejects duplicate email", async () => {
    const app = buildApp();
    await request(app)
      .post("/auth/signup")
      .send({ email: "dup@example.com", password: "password123" });

    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "dup@example.com", password: "otherpass123" });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("email already registered");
  });

  it("rejects empty email", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "", password: "password123" });

    expect(res.status).toBe(400);
  });

  it("rejects missing password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe("POST /auth/login", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp();
    // Create a user to log in with
    await request(app)
      .post("/auth/signup")
      .send({ email: "user@example.com", password: "password123" });
  });

  it("returns token on valid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("user@example.com");
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("invalid credentials");
  });

  it("rejects nonexistent email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("invalid credentials");
  });

  it("returns same error for wrong email and wrong password (no enumeration)", async () => {
    const wrongEmail = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    const wrongPass = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "wrongpassword" });

    expect(wrongEmail.body.error).toBe(wrongPass.body.error);
    expect(wrongEmail.body.error).toBe("invalid credentials");
  });
});

// ---------------------------------------------------------------------------
// Full flow: signup → login → access protected route
// ---------------------------------------------------------------------------

describe("Full auth flow: signup → login → protected route", () => {
  it("signup token can access GET /users/me", async () => {
    const app = buildApp();
    const signup = await request(app)
      .post("/auth/signup")
      .send({ email: "flow@example.com", password: "password123" });

    const token = signup.body.data.token;

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("flow@example.com");
  });

  it("login token can access GET /users/me", async () => {
    const app = buildApp();
    await request(app)
      .post("/auth/signup")
      .send({ email: "flow2@example.com", password: "password123" });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "flow2@example.com", password: "password123" });

    const token = login.body.data.token;

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("flow2@example.com");
  });

  it("no token returns 401 on protected route", async () => {
    const app = buildApp();
    const res = await request(app).get("/users/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("invalid token returns 401 on protected route", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/users/me")
      .set("Authorization", "Bearer garbage-token");

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("signup → create expense → list expenses (full pipeline)", async () => {
    const app = buildApp();
    const signup = await request(app)
      .post("/auth/signup")
      .send({ email: "pipeline@example.com", password: "password123" });

    const token = signup.body.data.token;

    // Create an expense
    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "electricity",
        amount: 2500,
        dueDate: "2026-04-15T00:00:00.000Z",
        isPaid: false,
        extractedVia: "manual",
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.data.amount).toBe(2500);

    // List expenses
    const listRes = await request(app)
      .get("/expenses")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].category).toBe("electricity");
  });
});
