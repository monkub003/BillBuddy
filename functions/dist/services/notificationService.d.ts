import { FirestoreStore } from "./firestore";
import { Notification, NotificationPreferences, BudgetStatus } from "../types/notification";
import { RecurringExpense, PredictionResult } from "../types/prediction";
export interface FCMClient {
    send(userId: string, title: string, body: string): Promise<void>;
}
export interface StoredNotificationPreferences extends NotificationPreferences {
    id: string;
    userId: string;
}
export declare const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences;
export interface NotificationServiceDeps {
    notificationStore: FirestoreStore<Notification>;
    notificationPreferencesStore: FirestoreStore<StoredNotificationPreferences>;
    fcmClient: FCMClient;
}
/**
 * Calculate the lead time in days for a bill reminder based on its frequency.
 * - monthly / quarterly → 7 days
 * - yearly → 30 days
 */
export declare function getLeadDays(frequency: RecurringExpense["frequency"]): number;
/**
 * Determine whether a bill due reminder should fire for the given bill
 * relative to `referenceDate`. Returns true when the bill's nextDueDate
 * falls within the appropriate lead-time window (inclusive of the due date
 * itself, exclusive of dates already past).
 */
export declare function shouldSendReminder(bill: RecurringExpense, referenceDate?: Date): boolean;
/**
 * Determine whether a prediction represents a >15% spike.
 */
export declare function isPredictedSpike(prediction: PredictionResult): boolean;
/**
 * Determine whether budget usage has reached the alert threshold (≥80%).
 */
export declare function isBudgetAlertNeeded(budgetStatus: BudgetStatus): boolean;
export declare function createNotificationService(deps?: Partial<NotificationServiceDeps>): {
    sendBillDueReminder: (userId: string, bill: RecurringExpense) => Promise<void>;
    sendExpenseWarning: (userId: string, prediction: PredictionResult) => Promise<void>;
    sendBudgetAlert: (userId: string, budgetStatus: BudgetStatus) => Promise<void>;
    getNotificationPreferences: (userId: string) => Promise<NotificationPreferences>;
    updateNotificationPreferences: (userId: string, prefs: NotificationPreferences) => Promise<void>;
    notificationStore: FirestoreStore<Notification>;
    notificationPreferencesStore: FirestoreStore<StoredNotificationPreferences>;
};
//# sourceMappingURL=notificationService.d.ts.map