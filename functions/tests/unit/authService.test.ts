import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAuthService, isValidEmail } from "../../src/services/authService";
import { createInMemoryStore } from "../../src/services/firestore";
import type { UserRecord } from "../../src/services/authService";

const TEST_JWT_SECRET = "test-secret-key-for-unit-tests";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

describe("isValidEmail", () => {
  it("accepts a standard email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejects missing @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects missing domain", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});

describe("AuthService.signup", () => {
  let authService: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    authService = createAuthService({
      userStore: createInMemoryStore<UserRecord>(),
    });
  });

  it("creates a user and returns a JWT on valid input", async () => {
    const result = await authService.signup("test@example.com", "password123");

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data!.user.email).toBe("test@example.com");
    expect(result.data!.token).toBeDefined();

    // Verify the JWT contains userId
    const decoded = jwt.verify(result.data!.token, TEST_JWT_SECRET) as { userId: string };
    expect(decoded.userId).toBe(result.data!.user.id);
  });

  it("stores a bcrypt hash, not plaintext", async () => {
    const password = "password123";
    const result = await authService.signup("test@example.com", password);
    expect(result.data).toBeDefined();

    const stored = await authService._userStore.get(result.data!.user.id);
    expect(stored).toBeDefined();
    expect(stored!.passwordHash).not.toBe(password);
    expect(bcrypt.compareSync(password, stored!.passwordHash)).toBe(true);
  });

  it("rejects invalid email format", async () => {
    const result = await authService.signup("not-an-email", "password123");
    expect(result.data).toBeNull();
    expect(result.error).toBe("invalid email");
  });

  it("rejects password shorter than 8 characters", async () => {
    const result = await authService.signup("test@example.com", "short");
    expect(result.data).toBeNull();
    expect(result.error).toBe("password too short");
  });

  it("rejects exactly 7-char password (boundary)", async () => {
    const result = await authService.signup("test@example.com", "1234567");
    expect(result.data).toBeNull();
    expect(result.error).toBe("password too short");
  });

  it("accepts exactly 8-char password (boundary)", async () => {
    const result = await authService.signup("test@example.com", "12345678");
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });

  it("rejects duplicate email", async () => {
    await authService.signup("dup@example.com", "password123");
    const result = await authService.signup("dup@example.com", "otherpass123");
    expect(result.data).toBeNull();
    expect(result.error).toBe("email already registered");
  });
});

describe("AuthService.login", () => {
  let authService: ReturnType<typeof createAuthService>;

  beforeEach(async () => {
    authService = createAuthService({
      userStore: createInMemoryStore<UserRecord>(),
    });
    await authService.signup("user@example.com", "password123");
  });

  it("returns a JWT on valid credentials", async () => {
    const result = await authService.login("user@example.com", "password123");
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data!.token).toBeDefined();
    expect(result.data!.user.email).toBe("user@example.com");
  });

  it("returns generic error for wrong password", async () => {
    const result = await authService.login("user@example.com", "wrongpassword");
    expect(result.data).toBeNull();
    expect(result.error).toBe("invalid credentials");
  });

  it("returns generic error for nonexistent email", async () => {
    const result = await authService.login("nobody@example.com", "password123");
    expect(result.data).toBeNull();
    expect(result.error).toBe("invalid credentials");
  });

  it("uses the same error message for wrong email and wrong password (no enumeration)", async () => {
    const wrongEmail = await authService.login("nobody@example.com", "password123");
    const wrongPass = await authService.login("user@example.com", "wrongpassword");
    expect(wrongEmail.error).toBe(wrongPass.error);
    expect(wrongEmail.error).toBe("invalid credentials");
  });

  it("JWT payload contains the correct userId", async () => {
    const result = await authService.login("user@example.com", "password123");
    const decoded = jwt.verify(result.data!.token, TEST_JWT_SECRET) as { userId: string };
    expect(decoded.userId).toBe(result.data!.user.id);
  });
});

describe("AuthService.verifyToken", () => {
  let authService: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    authService = createAuthService({
      userStore: createInMemoryStore<UserRecord>(),
    });
  });

  it("decodes a valid token and returns userId", async () => {
    const signupResult = await authService.signup("verify@example.com", "password123");
    const token = signupResult.data!.token;

    const { userId } = await authService.verifyToken(token);
    expect(userId).toBe(signupResult.data!.user.id);
  });

  it("throws on an invalid token", async () => {
    await expect(authService.verifyToken("garbage.token.here")).rejects.toThrow();
  });

  it("throws on a token signed with a different secret", async () => {
    const fakeToken = jwt.sign({ userId: "fake-id" }, "wrong-secret");
    await expect(authService.verifyToken(fakeToken)).rejects.toThrow();
  });
});
