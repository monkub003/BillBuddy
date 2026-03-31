import { ExpenseCategory } from "./api";

export interface ExtractionFieldResult<T> {
  value: T;
  confidence: number;
}

export interface ExtractionResult {
  amount: ExtractionFieldResult<number>;
  category: ExtractionFieldResult<ExpenseCategory>;
  dueDate: ExtractionFieldResult<string>;
}

export interface EmailWebhookPayload {
  from: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string;
    mimeType: string;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  needsReview: boolean;
}
