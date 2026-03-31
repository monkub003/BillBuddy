import { ApiResponse } from "../types/api";
import { User } from "../types/user";
import { FirestoreStore } from "./firestore";
/** Internal user record stored in Firestore (includes password hash). */
export interface UserRecord {
    id: string;
    email: string;
    passwordHash: string;
    monthlyIncome: number | null;
    createdAt: string;
}
/** Basic RFC 5322-ish email validation. */
export declare function isValidEmail(email: string): boolean;
export interface AuthServiceDeps {
    userStore: FirestoreStore<UserRecord>;
}
export declare function createAuthService(deps?: Partial<AuthServiceDeps>): {
    signup: (email: string, password: string) => Promise<ApiResponse<{
        token: string;
        user: User;
    }>>;
    login: (email: string, password: string) => Promise<ApiResponse<{
        token: string;
        user: User;
    }>>;
    verifyToken: (token: string) => Promise<{
        userId: string;
    }>;
    _userStore: FirestoreStore<UserRecord>;
};
//# sourceMappingURL=authService.d.ts.map