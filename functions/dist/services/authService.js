"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.createAuthService = createAuthService;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const firestore_1 = require("./firestore");
/** Basic RFC 5322-ish email validation. */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}
const SALT_ROUNDS = 10;
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not configured");
    return secret;
}
function createAuthService(deps) {
    const userStore = deps?.userStore ?? (0, firestore_1.createInMemoryStore)();
    async function signup(email, password) {
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
        const id = (0, uuid_1.v4)();
        const passwordHash = await bcryptjs_1.default.hash(password, SALT_ROUNDS);
        const createdAt = new Date().toISOString();
        const record = { id, email, passwordHash, monthlyIncome: null, createdAt };
        await userStore.set(id, record);
        const token = jsonwebtoken_1.default.sign({ userId: id }, getJwtSecret(), {
            expiresIn: "24h",
        });
        const user = { id, email, monthlyIncome: null, createdAt };
        return { data: { token, user }, error: null };
    }
    async function login(email, password) {
        const record = await userStore.findBy("email", email);
        if (!record) {
            return { data: null, error: "invalid credentials" };
        }
        const match = await bcryptjs_1.default.compare(password, record.passwordHash);
        if (!match) {
            return { data: null, error: "invalid credentials" };
        }
        const token = jsonwebtoken_1.default.sign({ userId: record.id }, getJwtSecret(), {
            expiresIn: "24h",
        });
        const user = {
            id: record.id,
            email: record.email,
            monthlyIncome: record.monthlyIncome,
            createdAt: record.createdAt,
        };
        return { data: { token, user }, error: null };
    }
    async function verifyToken(token) {
        const secret = getJwtSecret();
        const payload = jsonwebtoken_1.default.verify(token, secret);
        return { userId: payload.userId };
    }
    return { signup, login, verifyToken, _userStore: userStore };
}
//# sourceMappingURL=authService.js.map