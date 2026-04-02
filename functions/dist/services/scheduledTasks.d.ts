import { Expense } from "../types/expense";
import { Budget } from "../types/budget";
import { User } from "../types/user";
import { FirestoreStore } from "./firestore";
import { NotificationServiceDeps } from "./notificationService";
import { PredictionEngineDeps } from "./predictionEngine";
export interface ScheduledTasksDeps {
    userStore: FirestoreStore<User>;
    expenseStore: FirestoreStore<Expense>;
    budgetStore: FirestoreStore<Budget>;
    notificationServiceDeps?: Partial<NotificationServiceDeps>;
    predictionEngineDeps?: Partial<PredictionEngineDeps>;
}
export interface DailyNotificationResult {
    usersProcessed: number;
    billReminders: number;
    budgetAlerts: number;
    errors: string[];
}
export interface WeeklyTrendResult {
    usersProcessed: number;
    spikeWarnings: number;
    budgetPlansUpdated: number;
    errors: string[];
}
export declare function createScheduledTasks(deps: ScheduledTasksDeps): {
    runDailyNotifications: () => Promise<DailyNotificationResult>;
    runWeeklyTrendAnalysis: () => Promise<WeeklyTrendResult>;
};
//# sourceMappingURL=scheduledTasks.d.ts.map