import jwt from "jsonwebtoken";
import express from "express";
import request from "supertest";
import { Request, Response, NextFunction } from "express";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../../src/middleware/authMiddleware";
import { createDashboardRouter } from "../../src/routes/dashboardRoutes";
import { createPredictionRouter } from "../../src/routes/predictionRoutes";
import { createUserRouter } from "../../src/routes/userRoutes";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense } from "../../src/types/expense";
import type { User } from "../../src/types/user";
import type { UserRecord } from "../../src/services/authService";

const TEST_JWT_SECRET = "test-secret-key-for-middleware-tests";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

function createMockReqRes(authHeader?: string) {
  const req = {
    headers: {
      ...(authHeader !== undefined ? { authorization: authHeader } : {}),
    },
  } as unknown as Request;

  const resBody: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      resBody.statusCode = code;
      return res;
    },
    json(data: unknown) {
      resBody.body = data;
      return res;
    },
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next, resBody };
}

describe("authMiddleware", () => {
  it("returns 401 when no Authorization header is present", () => {
    const { req, res, next, resBody } = createMockReqRes();

    authMiddleware(req, res, next);

    expect(resBody.statusCode).toBe(401);
    expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not start with 'Bearer '", () => {
    const { req, res, next, resBody } = createMockReqRes("Basic abc123");

    authMiddleware(req, res, next);

    expect(resBody.statusCode).toBe(401);
    expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Bearer token is empty", () => {
    const { req, res, next, resBody } = createMockReqRes("Bearer ");

    authMiddleware(req, res, next);

    expect(resBody.statusCode).toBe(401);
    expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid/malformed token", () => {
    const { req, res, next, resBody } = createMockReqRes(
      "Bearer not.a.valid.jwt"
    );

    authMiddleware(req, res, next);

    expect(resBody.statusCode).toBe(401);
    expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a token signed with a different secret", () => {
    const token = jwt.sign({ userId: "user-123" }, "wrong-secret", {
      expiresIn: "1h",
    });
    const { req, res, next, resBody } = createMockReqRes(`Bearer ${token}`);

    authMiddleware(req, res, next);

    expect(resBody.statusCode).toBe(401);
    expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired token", () => {
    const token = jwt.sign({ userId: "user-123" }, TEST_JWT_SECRET, {
      expiresIn: "-1s",
    });
    const { req, res, next, resBody } = createMockReqRes(`Bearer ${token}`);

    authMiddleware(req, res, next);

    expect(resBody.statusCode).toBe(401);
    expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches userId for a valid token", () => {
    const userId = "user-abc-123";
    const token = jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: "1h" });
    const { req, res, next, resBody } = createMockReqRes(`Bearer ${token}`);

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(resBody.statusCode).toBeUndefined();
    expect((req as AuthenticatedRequest).userId).toBe(userId);
  });

  it("attaches the correct userId from the token payload", () => {
    const userId = "specific-user-id-456";
    const token = jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: "24h" });
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as AuthenticatedRequest).userId).toBe(userId);
  });
});


// ---------------------------------------------------------------------------
// Integration-level: verify all protected routes enforce auth & userId scoping
// ---------------------------------------------------------------------------

function makeToken(userId: string): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: "1h" });
}

describe("Protected route auth enforcement", () => {
  describe("Dashboard routes", () => {
    function buildDashboardApp() {
      const app = express();
      app.use(express.json());
      const expenseStore = createInMemoryStore<Expense>();
      const userStore = createInMemoryStore<User>();
      app.use("/dashboard", createDashboardRouter({ expenseStore, userStore }));
      return { app, expenseStore };
    }

    it("GET /dashboard returns 401 without auth token", async () => {
      const { app } = buildDashboardApp();
      const res = await request(app).get("/dashboard");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });

    it("GET /dashboard returns 401 with invalid token", async () => {
      const { app } = buildDashboardApp();
      const res = await request(app)
        .get("/dashboard")
        .set("Authorization", "Bearer invalid.token.here");
      expect(res.status).toBe(401);
    });

    it("GET /dashboard scopes data to authenticated user (IDOR prevention)", async () => {
      const { app, expenseStore } = buildDashboardApp();

      // Seed expenses for two different users
      await expenseStore.set("e1", {
        id: "e1", userId: "user-a", category: "electricity", amount: 100,
        currency: "THB", dueDate: new Date().toISOString(), isPaid: false,
        extractedVia: "manual", createdAt: new Date().toISOString(),
      });
      await expenseStore.set("e2", {
        id: "e2", userId: "user-b", category: "water", amount: 200,
        currency: "THB", dueDate: new Date().toISOString(), isPaid: false,
        extractedVia: "manual", createdAt: new Date().toISOString(),
      });

      const tokenA = makeToken("user-a");
      const res = await request(app)
        .get("/dashboard")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      // user-a should only see their own expense total (100), not user-b's (200)
      expect(res.body.data.monthlyTotal).toBe(100);
    });

    it("GET /dashboard/category/:category returns 401 without auth token", async () => {
      const { app } = buildDashboardApp();
      const res = await request(app).get("/dashboard/category/electricity");
      expect(res.status).toBe(401);
    });
  });

  describe("Prediction routes", () => {
    function buildPredictionApp() {
      const app = express();
      app.use(express.json());
      const expenseStore = createInMemoryStore<Expense>();
      app.use("/predictions", createPredictionRouter({ expenseStore }));
      return { app, expenseStore };
    }

    it("GET /predictions returns 401 without auth token", async () => {
      const { app } = buildPredictionApp();
      const res = await request(app).get("/predictions");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });

    it("GET /predictions returns 401 with expired token", async () => {
      const { app } = buildPredictionApp();
      const expiredToken = jwt.sign({ userId: "user-1" }, TEST_JWT_SECRET, {
        expiresIn: "-1s",
      });
      const res = await request(app)
        .get("/predictions")
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it("GET /predictions scopes data to authenticated user", async () => {
      const { app, expenseStore } = buildPredictionApp();

      // Seed enough data for user-a to get predictions (need >30 days span)
      const now = new Date();
      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      await expenseStore.set("e1", {
        id: "e1", userId: "user-a", category: "electricity", amount: 500,
        currency: "THB", dueDate: twoMonthsAgo.toISOString(), isPaid: true,
        extractedVia: "manual", createdAt: twoMonthsAgo.toISOString(),
      });
      await expenseStore.set("e2", {
        id: "e2", userId: "user-a", category: "electricity", amount: 600,
        currency: "THB", dueDate: now.toISOString(), isPaid: false,
        extractedVia: "manual", createdAt: now.toISOString(),
      });
      // user-b's expense should not affect user-a's predictions
      await expenseStore.set("e3", {
        id: "e3", userId: "user-b", category: "electricity", amount: 9999,
        currency: "THB", dueDate: now.toISOString(), isPaid: false,
        extractedVia: "manual", createdAt: now.toISOString(),
      });

      const tokenA = makeToken("user-a");
      const res = await request(app)
        .get("/predictions")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      if (res.body.data) {
        // Predictions should be based on user-a's data (~550 avg), not user-b's 9999
        for (const pred of res.body.data) {
          expect(pred.predictedMax).toBeLessThan(2000);
        }
      }
    });
  });

  describe("User routes", () => {
    function buildUserApp() {
      const app = express();
      app.use(express.json());
      const userStore = createInMemoryStore<UserRecord>();
      app.use("/users", createUserRouter({ userStore }));
      return { app, userStore };
    }

    it("GET /users/me returns 401 without auth token", async () => {
      const { app } = buildUserApp();
      const res = await request(app).get("/users/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });

    it("PUT /users/income returns 401 without auth token", async () => {
      const { app } = buildUserApp();
      const res = await request(app)
        .put("/users/income")
        .send({ monthlyIncome: 50000 });
      expect(res.status).toBe(401);
    });

    it("GET /users/me returns only the authenticated user's data", async () => {
      const { app, userStore } = buildUserApp();

      await userStore.set("user-a", {
        id: "user-a", email: "a@example.com", passwordHash: "hash",
        monthlyIncome: 30000, createdAt: new Date().toISOString(),
      });
      await userStore.set("user-b", {
        id: "user-b", email: "b@example.com", passwordHash: "hash",
        monthlyIncome: 80000, createdAt: new Date().toISOString(),
      });

      const tokenA = makeToken("user-a");
      const res = await request(app)
        .get("/users/me")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe("a@example.com");
      expect(res.body.data.monthlyIncome).toBe(30000);
    });
  });
});
