export type AccountType =
  | "Cash"
  | "Bank"
  | "Easypaisa"
  | "Savings"
  | "Investment"
  | "Other";

export interface DatabaseIds {
  households: string;
  users: string;
  accounts: string;
  categories: string;
  expenses: string;
  income: string;
  hiddenSavings: string;
}

export interface AccountRecord {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  monthKey: string;
  householdId: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  budgetLimit: number;
  householdId: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  amount: number;
  date: string;
  accountId: string;
  categoryId: string;
  monthKey: string;
  note: string;
  householdId: string;
}

export interface IncomeRecord {
  id: string;
  title: string;
  amount: number;
  date: string;
  accountId: string;
  monthKey: string;
  householdId: string;
}

export interface HiddenSavingsRecord {
  id: string;
  title: string;
  amount: number;
  date: string;
  monthKey: string;
  householdId: string;
}

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  householdId: string;
}

export interface SessionPayload {
  userId: string;
  username: string;
  name: string;
  householdId: string;
}

export interface MonthInitializationOptions {
  monthKey: string;
  carryForward?: boolean;
  duplicatePrevious?: boolean;
}
