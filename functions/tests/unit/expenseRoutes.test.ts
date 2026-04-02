import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createExpenseRouter } from "../../src/routes/expenseRoutes";
import { createInMemoryStore } from "../../src/services/firestore";
import type { Expense } from "../../src/types/expense";

const TEST_JWT_SECRET = "test-secret-key-for-expense-routes";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

function makeToken(userId: string): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: "1h" });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const expenseStore = createInMemoryStore<Expense>();
  app.use("/expenses", createExpenseRouter({ expenseStore }));
  return { app, expenseStore };
}

const validExpense = {
  category: "electricity",
  amount: 500,
  dueDate: "2025-02-15",
  isPaid: false,
  extractedVia: "manual",
};

describe("POST /expenses", () => {
  it("returns 200 with created expense on valid input", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toBeDefined();
    expect(res.body.data.category).toBe("electricity");
    expect(res.body.data.amount).toBe(500);
    expect(res.body.data.userId).toBe("user-1");
    expect(res.body.data.currency).toBe("THB");
  });

  it("returns 401 without auth token", async () => {
    const { app } = buildApp();

    const res = await request(app).post("/expenses").send(validExpense);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 400 for non-positive amount", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, amount: -10 });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("amount must be positive");
  });

  it("returns 400 for invalid category", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, category: "food" });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("category must be one of: electricity, water, insurance, loan, gas, manual");
  });
});

describe("GET /expenses", () => {
  it("returns 200 with expenses for authenticated user", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    // Create two expenses
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, category: "water", amount: 200 });

    const res = await request(app)
      .get("/expenses")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toHaveLength(2);
  });

  it("returns only expenses belonging to the authenticated user", async () => {
    const { app } = buildApp();
    const tokenA = makeToken("user-a");
    const tokenB = makeToken("user-b");

    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(validExpense);
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ ...validExpense, amount: 300 });

    const resA = await request(app)
      .get("/expenses")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(resA.body.data).toHaveLength(1);
    expect(resA.body.data[0].userId).toBe("user-a");
  });

  it("filters by category", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, category: "water" });

    const res = await request(app)
      .get("/expenses?category=water")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe("water");
  });

  it("filters by isPaid", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, isPaid: false });
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, isPaid: true });

    const res = await request(app)
      .get("/expenses?isPaid=true")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isPaid).toBe(true);
  });

  it("filters by month and year", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, dueDate: "2025-02-15" });
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, dueDate: "2025-03-10" });

    const res = await request(app)
      .get("/expenses?month=2&year=2025")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dueDate).toBe("2025-02-15");
  });

  it("returns 401 without auth token", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/expenses");
    expect(res.status).toBe(401);
  });
});

describe("PUT /expenses/:id", () => {
  it("returns 200 with updated expense", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    const res = await request(app)
      .put(`/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 750 });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.amount).toBe(750);
    expect(res.body.data.id).toBe(expenseId);
  });

  it("returns 403 when updating another user's expense", async () => {
    const { app } = buildApp();
    const tokenA = makeToken("user-a");
    const tokenB = makeToken("user-b");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    const res = await request(app)
      .put(`/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ amount: 999 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access denied");
  });

  it("returns 400 for invalid amount on update", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    const res = await request(app)
      .put(`/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("amount must be positive");
  });

  it("returns 403 for nonexistent expense", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .put("/expenses/nonexistent-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access denied");
  });
});

describe("DELETE /expenses/:id", () => {
  it("returns 200 on successful delete", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    // Verify it's gone
    const listRes = await request(app)
      .get("/expenses")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body.data).toHaveLength(0);
  });

  it("returns 403 when deleting another user's expense", async () => {
    const { app } = buildApp();
    const tokenA = makeToken("user-a");
    const tokenB = makeToken("user-b");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access denied");
  });

  it("returns 403 for nonexistent expense", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .delete("/expenses/nonexistent-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access denied");
  });
});

describe("PUT /expenses/:id/confirm", () => {
  it("returns 200 and sets needsReview to false", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    // Set needsReview to true first (simulating extraction)
    await request(app)
      .put(`/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ needsReview: true });

    const res = await request(app)
      .put(`/expenses/${expenseId}/confirm`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.needsReview).toBe(false);
    expect(res.body.data.id).toBe(expenseId);
  });

  it("returns 403 when confirming another user's expense", async () => {
    const { app } = buildApp();
    const tokenA = makeToken("user-a");
    const tokenB = makeToken("user-b");

    const createRes = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(validExpense);
    const expenseId = createRes.body.data.id;

    const res = await request(app)
      .put(`/expenses/${expenseId}/confirm`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access denied");
  });

  it("returns 403 for nonexistent expense", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .put("/expenses/nonexistent-id/confirm")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access denied");
  });

  it("returns 401 without auth token", async () => {
    const { app } = buildApp();

    const res = await request(app).put("/expenses/some-id/confirm");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });
});

describe("API response envelope conformance", () => {
  it("success responses have data non-null and error null", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send(validExpense);

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("error");
    expect(res.body.data).not.toBeNull();
    expect(res.body.error).toBeNull();
  });

  it("error responses have data null and error non-null", async () => {
    const { app } = buildApp();
    const token = makeToken("user-1");

    const res = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validExpense, amount: -1 });

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("error");
    expect(res.body.data).toBeNull();
    expect(res.body.error).not.toBeNull();
  });
});
