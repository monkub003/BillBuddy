import { Router } from "express";
import { FirestoreStore } from "../services/firestore";
import { UserRecord } from "../services/authService";
export interface UserRoutesDeps {
    userStore: FirestoreStore<UserRecord>;
}
/**
 * Factory that creates the user router.
 * Accepts UserRoutesDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export declare function createUserRouter(deps: UserRoutesDeps): Router;
//# sourceMappingURL=userRoutes.d.ts.map