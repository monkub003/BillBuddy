import { Router } from "express";
import { FirestoreStore } from "../services/firestore";
import { UserRecord } from "../services/authService";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { Notification } from "../types/notification";
import { StoredNotificationPreferences } from "../services/notificationService";
import { StorageBucket } from "../services/storageCleanup";
export interface UserRoutesDeps {
    userStore: FirestoreStore<UserRecord>;
    expenseStore?: FirestoreStore<Expense>;
    budgetStore?: FirestoreStore<Budget>;
    notificationStore?: FirestoreStore<Notification>;
    notificationPreferencesStore?: FirestoreStore<StoredNotificationPreferences>;
    storageBucket?: StorageBucket;
}
/**
 * Factory that creates the user router.
 * Accepts UserRoutesDeps so callers can inject a custom store
 * (e.g. in-memory for tests, real Firestore in production).
 */
export declare function createUserRouter(deps: UserRoutesDeps): Router;
//# sourceMappingURL=userRoutes.d.ts.map