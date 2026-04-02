import { ExpenseCategory } from "./api";
export type NotificationType = "bill_due" | "budget_alert" | "trend_warning" | "yearly_expense" | "expense_ratio";
export type NotificationChannel = "push" | "email";
export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown>;
    channel: NotificationChannel;
    sentAt: string;
    readAt: string | null;
}
export interface NotificationPreferences {
    channels: Array<NotificationChannel>;
    billReminder: {
        enabled: boolean;
        daysBefore: number;
    };
    budgetAlert: {
        enabled: boolean;
        threshold: number;
    };
    trendWarning: {
        enabled: boolean;
    };
    yearlyExpenseReminder: {
        enabled: boolean;
        daysBefore: number;
    };
}
export interface BudgetStatus {
    month: string;
    budgetTotal: number;
    spentTotal: number;
    usagePercentage: number;
    overBudgetCategories: ExpenseCategory[];
}
//# sourceMappingURL=notification.d.ts.map