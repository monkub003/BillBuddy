import express from "express";
import request from "supertest";
import { createScheduledRouter } from "../../src/routes/scheduledRoutes";
import { createInMemoryStore } from "../../src/services/firestore";
import { User } from "../../src/types/user";
import { Expense } from "../../src/types/expense";
import { Budget } from "../../src/types/budget";

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

function createTestApp(envApiKey?: string) {
  const originalKey = process.env.SCHEDULER_API_KEY;

  if (envApiKey !== undefined) {
    process.env.SCHEDULER_API_KEY = envApiKey;
  } else {
    delete process.env.SCHEDULER_API_KEY;
  }

  const app = express();
  app.use(express.json());

  const router = createScheduledRouter({
    userStore: createInMemoryStore<User>(),
    expenseStore: createInMemoryStore<Expense>(),
    budgetStore: createInMemoryStore<Budget>(),
  });

  app.use("/scheduled", router);

  // Cleanup helper
  const cleanup = () => {
    if (originalKey !== undefined) {
      process.env.SCHEDULER_API_KEY = originalKey;
    } else {
      delete process.env.SCHEDULER_API_KEY;
    }
  };

  return { app, cleanup };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /scheduled/daily-notifications", () => {
  it("returns 200 with result when no API key is configured (dev mode)", async () => {
    const { app, cleanup } = createTestApp();
    try {
      const res = await request(app).post("/scheduled/daily-notifications");
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.usersProcessed).toBe(0);
      expect(res.body.error).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("returns 403 when API key is configured but not provided", async () => {
    const { app, cleanup } = createTestApp("my-secret-key");
    try {
      const res = await request(app).post("/scheduled/daily-notifications");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("forbidden");
    } finally {
      cleanup();
    }
  });

  it("returns 403 when wrong API key is provided", async () => {
    const { app, cleanup } = createTestApp("my-secret-key");
    try {
      const res = await request(app)
        .post("/scheduled/daily-notifications")
        .set("x-scheduler-api-key", "wrong-key");
      expect(res.status).toBe(403);
    } finally {
      cleanup();
    }
  });

  it("returns 200 when correct API key is provided", async () => {
    const { app, cleanup } = createTestApp("my-secret-key");
    try {
      const res = await request(app)
        .post("/scheduled/daily-notifications")
        .set("x-scheduler-api-key", "my-secret-key");
      expect(res.status).toBe(200);
      expect(res.body.data.usersProcessed).toBe(0);
    } finally {
      cleanup();
    }
  });
});

describe("POST /scheduled/weekly-trends", () => {
  it("returns 200 with result when no API key is configured", async () => {
    const { app, cleanup } = createTestApp();
    try {
      const res = await request(app).post("/scheduled/weekly-trends");
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.usersProcessed).toBe(0);
      expect(res.body.error).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("returns 403 when API key is configured but missing", async () => {
    const { app, cleanup } = createTestApp("secret-123");
    try {
      const res = await request(app).post("/scheduled/weekly-trends");
      expect(res.status).toBe(403);
    } finally {
      cleanup();
    }
  });

  it("returns 200 when correct API key is provided", async () => {
    const { app, cleanup } = createTestApp("secret-123");
    try {
      const res = await request(app)
        .post("/scheduled/weekly-trends")
        .set("x-scheduler-api-key", "secret-123");
      expect(res.status).toBe(200);
      expect(res.body.data.usersProcessed).toBe(0);
    } finally {
      cleanup();
    }
  });
});
