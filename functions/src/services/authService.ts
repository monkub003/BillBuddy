import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { ApiResponse } from "../types/api";
import { User } from "../types/user";
import { FirestoreStore, createInMemoryStore } from "./firestore";

/** Internal user record stored in Firestore (includes password hash). */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  monthlyIncome: number | null;
  createdAt: string;
}

/** Basic RFC 5322-ish email validation. */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export interface AuthServiceDeps {
  userStore: FirestoreStore<UserRecord>;
}

export function createAuthService(deps?: Partial<AuthServiceDeps>) {
  const userStore =
    deps?.userStore ?? createInMemoryStore<UserRecord>();

  async function signup(
    email: string,
    password: string
  ): Promise<ApiResponse<{ token: string; user: User }>> {
    if (!isValidEmail(email)) {
      return { data: null, error: "invalid email" };
    }

    if (!password || password.length < 8) {
      return { data: null, error: "password too short" };
    }

    const existing = await userStore.findBy("email", email);
    if (existing) {
      return { data: null, error: "email already registered" };
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = new Date().toISOString();

    const record: UserRecord = { id, email, passwordHash, monthlyIncome: null, createdAt };
    await userStore.set(id, record);

    const token = jwt.sign({ userId: id }, getJwtSecret(), {
      expiresIn: "24h",
    });

    const user: User = { id, email, monthlyIncome: null, createdAt };
    return { data: { token, user }, error: null };
  }

  async function login(
    email: string,
    password: string
  ): Promise<ApiResponse<{ token: string; user: User }>> {
    const record = await userStore.findBy("email", email);
    if (!record) {
      return { data: null, error: "invalid credentials" };
    }

    const match = await bcrypt.compare(password, record.passwordHash);
    if (!match) {
      return { data: null, error: "invalid credentials" };
    }

    const token = jwt.sign({ userId: record.id }, getJwtSecret(), {
      expiresIn: "24h",
    });

    const user: User = {
      id: record.id,
      email: record.email,
      monthlyIncome: record.monthlyIncome,
      createdAt: record.createdAt,
    };
    return { data: { token, user }, error: null };
  }

  async function verifyToken(token: string): Promise<{ userId: string }> {
    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret) as { userId: string };
    return { userId: payload.userId };
  }

  return { signup, login, verifyToken, _userStore: userStore };
}
