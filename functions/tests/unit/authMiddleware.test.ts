import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../../src/middleware/authMiddleware";

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
