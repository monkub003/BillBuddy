import { Expense } from "./expense";

export interface BillParser {
  format(expense: Expense): string;
  parse(displayString: string): Expense;
  serialize(expense: Expense): string;
  deserialize(json: string): Expense;
}
