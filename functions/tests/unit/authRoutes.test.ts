import express from "express";
import request from "supertest";
import { createAuthRouter } from "../../src/routes/authRoutes";
import { createInMemoryStore } from "../../src/services/firestore";
import type { UserRecord } from "../../src/services/authService";

const TEST_JWT_SECRET = "test-secret-key-for-routes";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

function buildApp() {
  const app = express();
  app.use(express.json());
  const userStore = createInMemoryStore<UserRecord>();
  app.use("/auth", createAuthRouter({ userStore }));
  return app;
}

describe("POST /auth/signup", () => {
  it("returns 200 with { data, error: null } on valid signup", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "new@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("new@example.com");
  });

  it("returns 400 for invalid email", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "bad-email", password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("invalid email");
  });

  it("returns 400 for short password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "user@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("password too short");
  });

  it("returns 400 for duplicate email", async () => {
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
});

describe("POST /auth/login", () => {
  it("returns 200 with token on valid credentials", async () => {
    const app = buildApp();
    await request(app)
      .post("/auth/signup")
      .send({ email: "login@example.com", password: "password123" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("login@example.com");
  });

  it("returns 401 for wrong password", async () => {
    const app = buildApp();
    await request(app)
      .post("/auth/signup")
      .send({ email: "login@example.com", password: "password123" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("invalid credentials");
  });

  it("returns 401 for nonexistent email", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe("invalid credentials");
  });
});

describe("API response envelope conformance", () => {
  it("success responses have data non-null and error null", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "envelope@example.com", password: "password123" });

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("error");
    expect(res.body.data).not.toBeNull();
    expect(res.body.error).toBeNull();
  });

  it("error responses have data null and error non-null", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "bad", password: "password123" });

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("error");
    expect(res.body.data).toBeNull();
    expect(res.body.error).not.toBeNull();
  });
});
