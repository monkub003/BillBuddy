import { Router } from "express";
import { FirestoreStore } from "../services/firestore";
import { User } from "../types/user";
import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { Notification } from "../types/notification";
import { StoredNotificationPreferences } from "../services/notificationService";
export interface ScheduledRouterDeps {
    userStore: FirestoreStore<User>;
    expenseStore: FirestoreStore<Expense>;
    budgetStore: FirestoreStore<Budget>;
    notificationStore?: FirestoreStore<Notification>;
    notificationPreferencesStore?: FirestoreStore<StoredNotificationPreferences>;
}
export declare function createScheduledRouter(deps: ScheduledRouterDeps): Router;
//# sourceMappingURL=scheduledRoutes.d.ts.map