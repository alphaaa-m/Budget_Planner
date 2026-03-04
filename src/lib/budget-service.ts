import { HttpError } from "@/lib/api";
import { deriveMonthKeyFromDate, previousMonthKey } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  AccountRecord,
  AccountType,
  CategoryRecord,
  ExpenseRecord,
  HiddenSavingsRecord,
  IncomeRecord,
  MonthInitializationOptions,
  UserRecord,
} from "@/lib/types";

const DEFAULT_ACCOUNT_TEMPLATES: Array<{ name: string; type: AccountType }> = [
  { name: "UBL", type: "Bank" },
  { name: "Meezan", type: "Bank" },
  { name: "HBL", type: "Bank" },
  { name: "MCB", type: "Bank" },
  { name: "Cash (Muneeb)", type: "Cash" },
  { name: "Cash (Ayesha)", type: "Cash" },
];

type AccountRow = {
  id: string;
  name: string;
  type: string;
  balance: number | string;
  month_key: string;
  household_id: string;
};

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  budget_limit: number | string;
  household_id: string;
};

type ExpenseRow = {
  id: string;
  title: string;
  amount: number | string;
  date: string;
  account_id: string;
  category_id: string;
  month_key: string;
  note: string | null;
  household_id: string;
};

type IncomeRow = {
  id: string;
  title: string;
  amount: number | string;
  date: string;
  account_id: string;
  month_key: string;
  household_id: string;
};

type HiddenSavingsRow = {
  id: string;
  title: string;
  amount: number | string;
  date: string;
  month_key: string;
  household_id: string;
};

type UserRow = {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  household_id: string;
};

function toNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDateOnly(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function ensureNoSupabaseError(error: { message?: string; code?: string } | null, context: string): void {
  if (error) {
    throw new HttpError(500, `${context}: ${error.message ?? "Unknown Supabase error"}`);
  }
}

function asAccountType(value: string): AccountType {
  if (
    value === "Cash" ||
    value === "Bank" ||
    value === "Easypaisa" ||
    value === "Savings" ||
    value === "Investment" ||
    value === "Other"
  ) {
    return value;
  }
  return "Other";
}

function mapAccount(row: AccountRow): AccountRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    type: asAccountType(String(row.type ?? "Other")),
    balance: toNumber(row.balance),
    monthKey: String(row.month_key ?? ""),
    householdId: String(row.household_id ?? ""),
  };
}

function mapCategory(row: CategoryRow): CategoryRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    color: String(row.color ?? "default"),
    budgetLimit: toNumber(row.budget_limit),
    householdId: String(row.household_id ?? ""),
  };
}

function mapExpense(row: ExpenseRow): ExpenseRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    amount: toNumber(row.amount),
    date: toDateOnly(row.date),
    accountId: String(row.account_id ?? ""),
    categoryId: String(row.category_id ?? ""),
    monthKey: String(row.month_key ?? ""),
    note: String(row.note ?? ""),
    householdId: String(row.household_id ?? ""),
  };
}

function mapIncome(row: IncomeRow): IncomeRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    amount: toNumber(row.amount),
    date: toDateOnly(row.date),
    accountId: String(row.account_id ?? ""),
    monthKey: String(row.month_key ?? ""),
    householdId: String(row.household_id ?? ""),
  };
}

function mapSavings(row: HiddenSavingsRow): HiddenSavingsRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    amount: toNumber(row.amount),
    date: toDateOnly(row.date),
    monthKey: String(row.month_key ?? ""),
    householdId: String(row.household_id ?? ""),
  };
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    username: normalizeUsername(String(row.username ?? "")),
    passwordHash: String(row.password_hash ?? ""),
    householdId: String(row.household_id ?? ""),
  };
}

async function updateAccountBalance(accountId: string, nextBalance: number): Promise<void> {
  if (nextBalance < 0) {
    throw new HttpError(400, "Insufficient account balance");
  }

  const { error } = await supabaseAdmin
    .from("accounts")
    .update({ balance: nextBalance })
    .eq("id", accountId);

  ensureNoSupabaseError(error, "Failed to update account balance");
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, name, username, password_hash, household_id")
    .eq("username", normalizeUsername(username))
    .maybeSingle();

  ensureNoSupabaseError(error, "Failed to fetch user");

  if (!data) {
    return null;
  }

  return mapUser(data as UserRow);
}

export async function listAccounts(
  householdId: string,
  monthKey?: string,
): Promise<AccountRecord[]> {
  let query = supabaseAdmin
    .from("accounts")
    .select("id, name, type, balance, month_key, household_id")
    .eq("household_id", householdId);

  if (monthKey) {
    query = query.eq("month_key", monthKey);
  }

  const { data, error } = await query;
  ensureNoSupabaseError(error, "Failed to list accounts");

  return (data as AccountRow[] | null ?? [])
    .map(mapAccount)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listCategories(householdId: string): Promise<CategoryRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, color, budget_limit, household_id")
    .eq("household_id", householdId);

  ensureNoSupabaseError(error, "Failed to list categories");

  return (data as CategoryRow[] | null ?? [])
    .map(mapCategory)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listExpenses(
  householdId: string,
  monthKey?: string,
): Promise<ExpenseRecord[]> {
  let query = supabaseAdmin
    .from("expenses")
    .select("id, title, amount, date, account_id, category_id, month_key, note, household_id")
    .eq("household_id", householdId);

  if (monthKey) {
    query = query.eq("month_key", monthKey);
  }

  const { data, error } = await query;
  ensureNoSupabaseError(error, "Failed to list expenses");

  return (data as ExpenseRow[] | null ?? [])
    .map(mapExpense)
    .sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount);
}

export async function listIncome(
  householdId: string,
  monthKey?: string,
): Promise<IncomeRecord[]> {
  let query = supabaseAdmin
    .from("income")
    .select("id, title, amount, date, account_id, month_key, household_id")
    .eq("household_id", householdId);

  if (monthKey) {
    query = query.eq("month_key", monthKey);
  }

  const { data, error } = await query;
  ensureNoSupabaseError(error, "Failed to list income");

  return (data as IncomeRow[] | null ?? [])
    .map(mapIncome)
    .sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount);
}

export async function listHiddenSavings(
  householdId: string,
  monthKey?: string,
): Promise<HiddenSavingsRecord[]> {
  let query = supabaseAdmin
    .from("hidden_savings")
    .select("id, title, amount, date, month_key, household_id")
    .eq("household_id", householdId);

  if (monthKey) {
    query = query.eq("month_key", monthKey);
  }

  const { data, error } = await query;
  ensureNoSupabaseError(error, "Failed to list hidden savings");

  return (data as HiddenSavingsRow[] | null ?? [])
    .map(mapSavings)
    .sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount);
}

export async function createAccount(
  householdId: string,
  input: { name: string; type: AccountType; balance: number; monthKey: string },
): Promise<AccountRecord> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .insert({
      household_id: householdId,
      name: input.name,
      type: input.type,
      balance: input.balance,
      month_key: input.monthKey,
    })
    .select("id, name, type, balance, month_key, household_id")
    .single();

  if (error?.code === "23505") {
    throw new HttpError(409, "An account with this name already exists for this month");
  }

  if (error?.code === "23503") {
    throw new HttpError(401, "Session household is invalid. Please logout and login again.");
  }

  ensureNoSupabaseError(error, "Failed to create account");
  return mapAccount(data as AccountRow);
}

export async function updateAccount(
  householdId: string,
  input: { id: string; name?: string; type?: AccountType; balance?: number },
): Promise<AccountRecord> {
  const account = await getAccount(householdId, input.id);

  const patch: Record<string, unknown> = {};
  if (input.name) {
    patch.name = input.name;
  }
  if (input.type) {
    patch.type = input.type;
  }
  if (typeof input.balance === "number") {
    patch.balance = input.balance;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from("accounts").update(patch).eq("id", account.id);
    ensureNoSupabaseError(error, "Failed to update account");
  }

  return getAccount(householdId, account.id);
}

export async function deleteAccount(householdId: string, accountId: string): Promise<void> {
  await getAccount(householdId, accountId);

  const { error } = await supabaseAdmin.from("accounts").delete().eq("id", accountId);

  if (error?.code === "23503") {
    throw new HttpError(400, "Cannot delete this account because it has linked transactions");
  }

  ensureNoSupabaseError(error, "Failed to delete account");
}

export async function getAccount(
  householdId: string,
  accountId: string,
): Promise<AccountRecord> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("id, name, type, balance, month_key, household_id")
    .eq("id", accountId)
    .maybeSingle();

  ensureNoSupabaseError(error, "Failed to fetch account");

  if (!data) {
    throw new HttpError(404, "Account not found");
  }

  const account = mapAccount(data as AccountRow);
  if (account.householdId !== householdId) {
    throw new HttpError(403, "Account access denied");
  }

  return account;
}

export async function getCategory(
  householdId: string,
  categoryId: string,
): Promise<CategoryRecord> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, color, budget_limit, household_id")
    .eq("id", categoryId)
    .maybeSingle();

  ensureNoSupabaseError(error, "Failed to fetch category");

  if (!data) {
    throw new HttpError(404, "Category not found");
  }

  const category = mapCategory(data as CategoryRow);
  if (category.householdId !== householdId) {
    throw new HttpError(403, "Category access denied");
  }

  return category;
}

export async function transferBetweenAccounts(
  householdId: string,
  input: { fromAccountId: string; toAccountId: string; amount: number },
) {
  if (input.fromAccountId === input.toAccountId) {
    throw new HttpError(400, "Source and destination accounts must be different");
  }

  const fromAccount = await getAccount(householdId, input.fromAccountId);
  const toAccount = await getAccount(householdId, input.toAccountId);

  if (fromAccount.balance < input.amount) {
    throw new HttpError(400, "Insufficient balance for transfer");
  }

  await updateAccountBalance(fromAccount.id, fromAccount.balance - input.amount);
  await updateAccountBalance(toAccount.id, toAccount.balance + input.amount);

  const [nextFrom, nextTo] = await Promise.all([
    getAccount(householdId, fromAccount.id),
    getAccount(householdId, toAccount.id),
  ]);

  return {
    from: nextFrom,
    to: nextTo,
  };
}

export async function createCategory(
  householdId: string,
  input: { name: string; color: string; budgetLimit: number },
): Promise<CategoryRecord> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({
      household_id: householdId,
      name: input.name,
      color: input.color,
      budget_limit: input.budgetLimit,
    })
    .select("id, name, color, budget_limit, household_id")
    .single();

  if (error?.code === "23505") {
    throw new HttpError(409, "Category already exists");
  }

  ensureNoSupabaseError(error, "Failed to create category");
  return mapCategory(data as CategoryRow);
}

export async function updateCategory(
  householdId: string,
  input: { id: string; name?: string; color?: string; budgetLimit?: number },
): Promise<CategoryRecord> {
  const category = await getCategory(householdId, input.id);

  const patch: Record<string, unknown> = {};
  if (input.name) {
    patch.name = input.name;
  }
  if (input.color) {
    patch.color = input.color;
  }
  if (typeof input.budgetLimit === "number") {
    patch.budget_limit = input.budgetLimit;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from("categories").update(patch).eq("id", category.id);
    ensureNoSupabaseError(error, "Failed to update category");
  }

  return getCategory(householdId, category.id);
}

export async function getExpense(
  householdId: string,
  expenseId: string,
): Promise<ExpenseRecord> {
  const { data, error } = await supabaseAdmin
    .from("expenses")
    .select("id, title, amount, date, account_id, category_id, month_key, note, household_id")
    .eq("id", expenseId)
    .maybeSingle();

  ensureNoSupabaseError(error, "Failed to fetch expense");

  if (!data) {
    throw new HttpError(404, "Expense not found");
  }

  const expense = mapExpense(data as ExpenseRow);
  if (expense.householdId !== householdId) {
    throw new HttpError(403, "Expense access denied");
  }

  return expense;
}

export async function createExpense(
  householdId: string,
  input: {
    title: string;
    amount: number;
    date: string;
    accountId: string;
    categoryId: string;
    monthKey?: string;
    note?: string;
  },
): Promise<ExpenseRecord> {
  const account = await getAccount(householdId, input.accountId);
  await getCategory(householdId, input.categoryId);

  if (account.balance < input.amount) {
    throw new HttpError(400, "Insufficient account balance");
  }

  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .insert({
      household_id: householdId,
      title: input.title,
      amount: input.amount,
      date: input.date,
      account_id: input.accountId,
      category_id: input.categoryId,
      month_key: resolvedMonthKey,
      note: input.note ?? "",
    })
    .select("id, title, amount, date, account_id, category_id, month_key, note, household_id")
    .single();

  ensureNoSupabaseError(error, "Failed to create expense");

  await updateAccountBalance(account.id, account.balance - input.amount);
  return mapExpense(data as ExpenseRow);
}

export async function updateExpense(
  householdId: string,
  input: {
    id: string;
    title: string;
    amount: number;
    date: string;
    accountId: string;
    categoryId: string;
    monthKey?: string;
    note?: string;
  },
): Promise<ExpenseRecord> {
  const existing = await getExpense(householdId, input.id);
  await getCategory(householdId, input.categoryId);

  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  if (existing.accountId === input.accountId) {
    const account = await getAccount(householdId, existing.accountId);
    const nextBalance = account.balance + existing.amount - input.amount;

    if (nextBalance < 0) {
      throw new HttpError(400, "Insufficient account balance");
    }

    await updateAccountBalance(account.id, nextBalance);
  } else {
    const oldAccount = await getAccount(householdId, existing.accountId);
    const newAccount = await getAccount(householdId, input.accountId);

    if (newAccount.balance < input.amount) {
      throw new HttpError(400, "Insufficient destination account balance");
    }

    await updateAccountBalance(oldAccount.id, oldAccount.balance + existing.amount);
    await updateAccountBalance(newAccount.id, newAccount.balance - input.amount);
  }

  const { error } = await supabaseAdmin
    .from("expenses")
    .update({
      title: input.title,
      amount: input.amount,
      date: input.date,
      account_id: input.accountId,
      category_id: input.categoryId,
      month_key: resolvedMonthKey,
      note: input.note ?? "",
    })
    .eq("id", input.id);

  ensureNoSupabaseError(error, "Failed to update expense");

  return getExpense(householdId, input.id);
}

export async function deleteExpense(householdId: string, expenseId: string): Promise<void> {
  const expense = await getExpense(householdId, expenseId);
  const account = await getAccount(householdId, expense.accountId);

  await updateAccountBalance(account.id, account.balance + expense.amount);

  const { error } = await supabaseAdmin.from("expenses").delete().eq("id", expense.id);
  ensureNoSupabaseError(error, "Failed to delete expense");
}

export async function getIncome(
  householdId: string,
  incomeId: string,
): Promise<IncomeRecord> {
  const { data, error } = await supabaseAdmin
    .from("income")
    .select("id, title, amount, date, account_id, month_key, household_id")
    .eq("id", incomeId)
    .maybeSingle();

  ensureNoSupabaseError(error, "Failed to fetch income");

  if (!data) {
    throw new HttpError(404, "Income not found");
  }

  const income = mapIncome(data as IncomeRow);
  if (income.householdId !== householdId) {
    throw new HttpError(403, "Income access denied");
  }

  return income;
}

export async function createIncome(
  householdId: string,
  input: {
    title: string;
    amount: number;
    date: string;
    accountId: string;
    monthKey?: string;
  },
): Promise<IncomeRecord> {
  const account = await getAccount(householdId, input.accountId);
  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  const { data, error } = await supabaseAdmin
    .from("income")
    .insert({
      household_id: householdId,
      title: input.title,
      amount: input.amount,
      date: input.date,
      account_id: input.accountId,
      month_key: resolvedMonthKey,
    })
    .select("id, title, amount, date, account_id, month_key, household_id")
    .single();

  ensureNoSupabaseError(error, "Failed to create income");

  await updateAccountBalance(account.id, account.balance + input.amount);
  return mapIncome(data as IncomeRow);
}

export async function updateIncome(
  householdId: string,
  input: {
    id: string;
    title: string;
    amount: number;
    date: string;
    accountId: string;
    monthKey?: string;
  },
): Promise<IncomeRecord> {
  const existing = await getIncome(householdId, input.id);
  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  if (existing.accountId === input.accountId) {
    const account = await getAccount(householdId, existing.accountId);
    const nextBalance = account.balance - existing.amount + input.amount;

    if (nextBalance < 0) {
      throw new HttpError(400, "Account would go negative");
    }

    await updateAccountBalance(account.id, nextBalance);
  } else {
    const oldAccount = await getAccount(householdId, existing.accountId);
    const newAccount = await getAccount(householdId, input.accountId);

    if (oldAccount.balance < existing.amount) {
      throw new HttpError(400, "Cannot move income from account due to insufficient balance");
    }

    await updateAccountBalance(oldAccount.id, oldAccount.balance - existing.amount);
    await updateAccountBalance(newAccount.id, newAccount.balance + input.amount);
  }

  const { error } = await supabaseAdmin
    .from("income")
    .update({
      title: input.title,
      amount: input.amount,
      date: input.date,
      account_id: input.accountId,
      month_key: resolvedMonthKey,
    })
    .eq("id", input.id);

  ensureNoSupabaseError(error, "Failed to update income");

  return getIncome(householdId, input.id);
}

export async function deleteIncome(householdId: string, incomeId: string): Promise<void> {
  const income = await getIncome(householdId, incomeId);
  const account = await getAccount(householdId, income.accountId);

  if (account.balance < income.amount) {
    throw new HttpError(
      400,
      "Cannot delete this income because account funds were already spent",
    );
  }

  await updateAccountBalance(account.id, account.balance - income.amount);

  const { error } = await supabaseAdmin.from("income").delete().eq("id", income.id);
  ensureNoSupabaseError(error, "Failed to delete income");
}

export async function createHiddenSavings(
  householdId: string,
  input: {
    title: string;
    amount: number;
    date: string;
    accountId: string;
    monthKey?: string;
  },
): Promise<HiddenSavingsRecord> {
  const account = await getAccount(householdId, input.accountId);
  if (account.balance < input.amount) {
    throw new HttpError(400, "Insufficient account balance");
  }

  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  const { data, error } = await supabaseAdmin
    .from("hidden_savings")
    .insert({
      household_id: householdId,
      title: input.title,
      amount: input.amount,
      date: input.date,
      month_key: resolvedMonthKey,
    })
    .select("id, title, amount, date, month_key, household_id")
    .single();

  ensureNoSupabaseError(error, "Failed to create hidden savings entry");

  await updateAccountBalance(account.id, account.balance - input.amount);

  return mapSavings(data as HiddenSavingsRow);
}

export async function initializeMonthAccounts(
  householdId: string,
  options: MonthInitializationOptions,
): Promise<AccountRecord[]> {
  const { monthKey, carryForward = false, duplicatePrevious = false } = options;

  const existing = await listAccounts(householdId, monthKey);
  if (existing.length > 0) {
    return existing;
  }

  const allAccounts = await listAccounts(householdId);

  const availableMonths = Array.from(
    new Set(allAccounts.map((account) => account.monthKey).filter(Boolean)),
  )
    .filter((key) => key < monthKey)
    .sort();

  const latestPreviousMonth = availableMonths[availableMonths.length - 1] ?? previousMonthKey(monthKey);
  const previousAccounts = allAccounts.filter(
    (account) => account.monthKey === latestPreviousMonth,
  );

  const shouldCarryBalances = duplicatePrevious || carryForward;

  const normalizedFromPrevious = previousAccounts.length
    ? previousAccounts.flatMap((account) => {
        if (account.name === "Cash (Muneeb, Ayesha)") {
          return [
            {
              name: "Cash (Muneeb)",
              type: "Cash" as AccountType,
              balance: shouldCarryBalances ? account.balance : 0,
            },
            {
              name: "Cash (Ayesha)",
              type: "Cash" as AccountType,
              balance: 0,
            },
          ];
        }

        return [
          {
            name: account.name,
            type: account.type,
            balance: shouldCarryBalances ? account.balance : 0,
          },
        ];
      })
    : [];

  const templates = normalizedFromPrevious.length
    ? normalizedFromPrevious
    : DEFAULT_ACCOUNT_TEMPLATES.map((account) => ({
        ...account,
        balance: 0,
      }));

  const uniqueTemplates = Array.from(
    new Map(templates.map((template) => [template.name.toLowerCase(), template])).values(),
  );

  for (const template of uniqueTemplates) {
    await createAccount(householdId, {
      name: template.name,
      type: template.type,
      balance: template.balance,
      monthKey,
    });
  }

  return listAccounts(householdId, monthKey);
}
