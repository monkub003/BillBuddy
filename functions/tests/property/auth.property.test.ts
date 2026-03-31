import fc from "fast-check";
import bcrypt from "bcryptjs";
import { createAuthService } from "../../src/services/authService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { UserRecord } from "../../src/services/authService";

const TEST_JWT_SECRET = "test-secret-key-for-property-tests";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

// Feature: billbuddy-mvp, Property 1: Signup produces bcrypt hash, never plaintext
// **Validates: Requirements 1.1, 1.5**
describe("Property 1: Signup produces bcrypt hash, never plaintext", () => {
  it("for any valid email and password (≥8 chars), the stored passwordHash is a valid bcrypt hash and does not equal the plaintext password", async () => {
    // bcrypt hashing is intentionally slow; increase timeout for 100 iterations
    jest.setTimeout(120_000);
    await fc.assert(
      fc.asyncProperty(
        // Generate random valid emails
        fc.tuple(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
          fc.constantFrom("example.com", "test.org", "mail.net")
        ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
        // Generate random passwords with length ≥ 8
        fc.string({ minLength: 8, maxLength: 64 }).filter((s) => s.length >= 8),
        async (email, password) => {
          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          const result = await authService.signup(email, password);

          // Signup should succeed for valid inputs
          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();

          // Retrieve the stored record
          const stored = await authService._userStore.get(result.data!.user.id);
          expect(stored).toBeDefined();

          const hash = stored!.passwordHash;

          // Hash must be a valid bcrypt hash (starts with $2a$ or $2b$)
          expect(hash).toMatch(/^\$2[ab]\$/);

          // Hash must NOT equal the plaintext password
          expect(hash).not.toBe(password);

          // Hash must verify against the original password
          expect(bcrypt.compareSync(password, hash)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 2: Short passwords are rejected
// **Validates: Requirements 1.3**
describe("Property 2: Short passwords are rejected", () => {
  it("for any password with length < 8, signup returns 'password too short' error", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random strings with length 0-7
        fc.string({ minLength: 0, maxLength: 7 }),
        async (shortPassword) => {
          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          // Use a valid email for each test run
          const email = "testuser@example.com";

          const result = await authService.signup(email, shortPassword);

          // Signup must fail
          expect(result.data).toBeNull();
          expect(result.error).toBe("password too short");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 3: Invalid emails are rejected
// **Validates: Requirements 1.4**
describe("Property 3: Invalid emails are rejected", () => {
  it("for any string that does not conform to a valid email format, signup returns 'invalid email' error", async () => {
    /**
     * The auth service uses /^[^\s@]+@[^\s@]+\.[^\s@]+$/ to validate emails.
     * We generate random strings and filter out any that accidentally match
     * this pattern, ensuring we only test truly invalid emails.
     */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Strategy: generate strings from several "invalid email" categories
    const invalidEmailArb = fc.oneof(
      // 1. Arbitrary strings with no @ sign at all
      fc.string({ minLength: 0, maxLength: 30 }).filter((s) => !s.includes("@")),
      // 2. Strings with @ but missing domain dot (e.g. "user@domain")
      fc.tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 })
      ).map(([local, domain]) => `${local}@${domain}`),
      // 3. Strings with @ at the start (e.g. "@domain.com")
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz.'.split('')), { minLength: 1, maxLength: 15 })
        .map((s) => `@${s}`),
      // 4. Strings with @ at the end (e.g. "user@")
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 })
        .map((s) => `${s}@`),
      // 5. Empty string
      fc.constant("")
    ).filter((s) => !emailRegex.test(s));

    await fc.assert(
      fc.asyncProperty(
        invalidEmailArb,
        async (invalidEmail) => {
          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          // Use a valid password (≥8 chars) so only email validation triggers
          const validPassword = "securePass123";

          const result = await authService.signup(invalidEmail, validPassword);

          // Signup must fail with "invalid email"
          expect(result.data).toBeNull();
          expect(result.error).toBe("invalid email");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 4: Duplicate email signup is rejected
// **Validates: Requirements 1.2**
describe("Property 4: Duplicate email signup is rejected", () => {
  it("for any email that already exists, a subsequent signup with that email is rejected with 'email already registered'", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random valid emails
        fc.tuple(
          fc.stringOf(
            fc.constantFrom(
              ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
            ),
            { minLength: 1, maxLength: 10 }
          ),
          fc.stringOf(
            fc.constantFrom(
              ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
            ),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom("example.com", "test.org", "mail.net")
        ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
        // Generate two valid passwords (≥ 8 chars)
        fc
          .string({ minLength: 8, maxLength: 64 })
          .filter((s) => s.length >= 8),
        fc
          .string({ minLength: 8, maxLength: 64 })
          .filter((s) => s.length >= 8),
        async (email, password1, password2) => {
          // Use the SAME authService instance (same store) for both signups
          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          // First signup should succeed
          const first = await authService.signup(email, password1);
          expect(first.error).toBeNull();
          expect(first.data).not.toBeNull();

          // Second signup with the same email should fail
          const second = await authService.signup(email, password2);
          expect(second.data).toBeNull();
          expect(second.error).toBe("email already registered");
        }
      ),
      { numRuns: 100 }
    );
  }, 120_000);
});

// Feature: billbuddy-mvp, Property 5: Signup-then-login round trip
// **Validates: Requirements 2.1, 2.4**
describe("Property 5: Signup-then-login round trip", () => {
  it("for any valid email and password, after signup, login with the same credentials succeeds and returns a JWT with the correct userId", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random valid emails
        fc.tuple(
          fc.stringOf(
            fc.constantFrom(
              ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
            ),
            { minLength: 1, maxLength: 10 }
          ),
          fc.stringOf(
            fc.constantFrom(
              ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
            ),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom("example.com", "test.org", "mail.net")
        ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
        // Generate random passwords with length ≥ 8
        fc.string({ minLength: 8, maxLength: 64 }).filter((s) => s.length >= 8),
        async (email, password) => {
          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          // Signup with valid credentials
          const signupResult = await authService.signup(email, password);
          expect(signupResult.error).toBeNull();
          expect(signupResult.data).not.toBeNull();

          const signupUserId = signupResult.data!.user.id;

          // Login with the same credentials
          const loginResult = await authService.login(email, password);
          expect(loginResult.error).toBeNull();
          expect(loginResult.data).not.toBeNull();

          const loginToken = loginResult.data!.token;

          // Token must be a non-empty string
          expect(typeof loginToken).toBe("string");
          expect(loginToken.length).toBeGreaterThan(0);

          // Decode the JWT and verify it contains the correct userId
          const jwt = require("jsonwebtoken");
          const decoded = jwt.verify(loginToken, process.env.JWT_SECRET!) as {
            userId: string;
          };
          expect(decoded.userId).toBe(signupUserId);
        }
      ),
      { numRuns: 100 }
    );
  }, 120_000);
});

// Feature: billbuddy-mvp, Property 6: Login with invalid credentials fails
// **Validates: Requirements 2.2, 2.3**
describe("Property 6: Login with invalid credentials fails", () => {
  // Valid email arbitrary
  const validEmailArb = fc
    .tuple(
      fc.stringOf(
        fc.constantFrom(
          ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
        ),
        { minLength: 1, maxLength: 10 }
      ),
      fc.stringOf(
        fc.constantFrom(
          ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
        ),
        { minLength: 1, maxLength: 10 }
      ),
      fc.constantFrom("example.com", "test.org", "mail.net")
    )
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

  // Valid password arbitrary (≥ 8 chars)
  const validPasswordArb = fc
    .string({ minLength: 8, maxLength: 64 })
    .filter((s) => s.length >= 8);

  it("login with nonexistent email returns 'invalid credentials'", async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        async (email, password) => {
          // Fresh store with no users — every email is nonexistent
          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          const result = await authService.login(email, password);

          expect(result.data).toBeNull();
          expect(result.error).toBe("invalid credentials");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("login with correct email but wrong password returns 'invalid credentials'", async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        validPasswordArb,
        async (email, signupPassword, loginPassword) => {
          // Ensure the login password differs from the signup password
          fc.pre(loginPassword !== signupPassword);

          const authService = createAuthService({
            userStore: createInMemoryStore<UserRecord>(),
          });

          // First, sign up with the correct password
          const signupResult = await authService.signup(email, signupPassword);
          expect(signupResult.error).toBeNull();

          // Attempt login with a different password
          const loginResult = await authService.login(email, loginPassword);

          expect(loginResult.data).toBeNull();
          expect(loginResult.error).toBe("invalid credentials");
        }
      ),
      { numRuns: 100 }
    );
  }, 120_000);
});

// Feature: billbuddy-mvp, Property 7: Invalid or missing JWT returns 401
// **Validates: Requirements 3.1, 3.2, 3.3**

import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { authMiddleware } from "../../src/middleware/authMiddleware";

/**
 * Helper to create mock Express req/res/next for middleware testing.
 */
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

describe("Property 7: Invalid or missing JWT returns 401", () => {
  it("requests with no Authorization header return 401 with { data: null, error: 'unauthorized' }", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary request paths (irrelevant to the middleware, but proves universality)
        fc.string({ minLength: 1, maxLength: 50 }),
        (_path) => {
          const { req, res, next, resBody } = createMockReqRes();

          authMiddleware(req, res, next);

          expect(resBody.statusCode).toBe(401);
          expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
          expect(next).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("requests with random Bearer tokens return 401 with { data: null, error: 'unauthorized' }", () => {
    fc.assert(
      fc.property(
        // Generate random strings as invalid tokens
        fc.string({ minLength: 1, maxLength: 200 }),
        (randomToken) => {
          const { req, res, next, resBody } = createMockReqRes(
            `Bearer ${randomToken}`
          );

          authMiddleware(req, res, next);

          expect(resBody.statusCode).toBe(401);
          expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
          expect(next).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("requests with expired JWT tokens return 401 with { data: null, error: 'unauthorized' }", () => {
    fc.assert(
      fc.property(
        // Generate random user IDs for the expired token payload
        fc.string({ minLength: 1, maxLength: 36 }),
        (userId) => {
          // Create a token that is already expired
          const expiredToken = jwt.sign(
            { userId },
            process.env.JWT_SECRET!,
            { expiresIn: "-1s" }
          );

          const { req, res, next, resBody } = createMockReqRes(
            `Bearer ${expiredToken}`
          );

          authMiddleware(req, res, next);

          expect(resBody.statusCode).toBe(401);
          expect(resBody.body).toEqual({ data: null, error: "unauthorized" });
          expect(next).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
