import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { HttpError } from "@/lib/api";
import { deriveMonthKeyFromDate, previousMonthKey } from "@/lib/format";
import { notion, queryAllPages, withNotionRetry } from "@/lib/notion";
import { ensureNotionSetup } from "@/lib/notion-setup";
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
  { name: "Cash Wallet", type: "Cash" },
  { name: "Main Bank", type: "Bank" },
  { name: "Easypaisa", type: "Easypaisa" },
  { name: "Savings", type: "Savings" },
];

function titleValue(content: string) {
  return [{ type: "text" as const, text: { content } }];
}

function richTextValue(content: string) {
  return content
    ? [{ type: "text" as const, text: { content } }]
    : [];
}

function readTitle(page: PageObjectResponse, propertyName: string): string {
  const property = page.properties[propertyName];
  if (!property || property.type !== "title") {
    return "";
  }
  return property.title.map((item) => item.plain_text).join("").trim();
}

function readRichText(page: PageObjectResponse, propertyName: string): string {
  const property = page.properties[propertyName];
  if (!property || property.type !== "rich_text") {
    return "";
  }
  return property.rich_text.map((item) => item.plain_text).join("").trim();
}

function readNumber(page: PageObjectResponse, propertyName: string): number {
  const property = page.properties[propertyName];
  if (!property || property.type !== "number") {
    return 0;
  }
  return property.number ?? 0;
}

function readDate(page: PageObjectResponse, propertyName: string): string {
  const property = page.properties[propertyName];
  if (!property || property.type !== "date") {
    return "";
  }

  return property.date?.start?.slice(0, 10) ?? "";
}

function readRelation(page: PageObjectResponse, propertyName: string): string[] {
  const property = page.properties[propertyName];
  if (!property || property.type !== "relation") {
    return [];
  }
  return property.relation.map((item) => item.id);
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

function mapAccount(page: PageObjectResponse): AccountRecord {
  const typeProperty = page.properties.Type;
  const typeName =
    typeProperty && typeProperty.type === "select"
      ? typeProperty.select?.name ?? "Other"
      : "Other";

  return {
    id: page.id,
    name: readTitle(page, "Name"),
    type: asAccountType(typeName),
    balance: readNumber(page, "Balance"),
    monthKey: readRichText(page, "Month Key"),
    householdId: readRelation(page, "Household")[0] ?? "",
  };
}

function mapCategory(page: PageObjectResponse): CategoryRecord {
  const colorProperty = page.properties.Color;
  const color =
    colorProperty && colorProperty.type === "select"
      ? colorProperty.select?.name ?? "default"
      : "default";

  return {
    id: page.id,
    name: readTitle(page, "Name"),
    color,
    budgetLimit: readNumber(page, "Budget Limit"),
    householdId: readRelation(page, "Household")[0] ?? "",
  };
}

function mapExpense(page: PageObjectResponse): ExpenseRecord {
  return {
    id: page.id,
    title: readTitle(page, "Title"),
    amount: readNumber(page, "Amount"),
    date: readDate(page, "Date"),
    accountId: readRelation(page, "Account")[0] ?? "",
    categoryId: readRelation(page, "Category")[0] ?? "",
    monthKey: readRichText(page, "Month Key"),
    note: readRichText(page, "Note"),
    householdId: readRelation(page, "Household")[0] ?? "",
  };
}

function mapIncome(page: PageObjectResponse): IncomeRecord {
  return {
    id: page.id,
    title: readTitle(page, "Title"),
    amount: readNumber(page, "Amount"),
    date: readDate(page, "Date"),
    accountId: readRelation(page, "Account")[0] ?? "",
    monthKey: readRichText(page, "Month Key"),
    householdId: readRelation(page, "Household")[0] ?? "",
  };
}

function mapSavings(page: PageObjectResponse): HiddenSavingsRecord {
  return {
    id: page.id,
    title: readTitle(page, "Title"),
    amount: readNumber(page, "Amount"),
    date: readDate(page, "Date"),
    monthKey: readRichText(page, "Month Key"),
    householdId: readRelation(page, "Household")[0] ?? "",
  };
}

function mapUser(page: PageObjectResponse): UserRecord {
  return {
    id: page.id,
    name: readTitle(page, "Name"),
    username: readRichText(page, "Username"),
    passwordHash: readRichText(page, "Password Hash"),
    householdId: readRelation(page, "Household")[0] ?? "",
  };
}

async function getPageOrThrow(pageId: string): Promise<PageObjectResponse> {
  const page = await withNotionRetry(() => notion.pages.retrieve({ page_id: pageId }));
  if (page.object !== "page" || !("properties" in page)) {
    throw new HttpError(404, "Entity not found");
  }
  return page as PageObjectResponse;
}

async function updateAccountBalance(accountId: string, nextBalance: number): Promise<void> {
  if (nextBalance < 0) {
    throw new HttpError(400, "Insufficient account balance");
  }

  await withNotionRetry(() =>
    notion.pages.update({
      page_id: accountId,
      properties: {
        Balance: { number: nextBalance },
      },
    }),
  );
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const setup = await ensureNotionSetup();
  const users = await queryAllPages({
    database_id: setup.databases.users,
    filter: {
      property: "Username",
      rich_text: {
        equals: username,
      },
    },
  });

  if (!users[0]) {
    return null;
  }

  return mapUser(users[0]);
}

export async function listAccounts(
  householdId: string,
  monthKey?: string,
): Promise<AccountRecord[]> {
  const setup = await ensureNotionSetup();
  const filter = monthKey
    ? {
        and: [
          { property: "Household", relation: { contains: householdId } },
          { property: "Month Key", rich_text: { equals: monthKey } },
        ],
      }
    : { property: "Household", relation: { contains: householdId } };

  const pages = await queryAllPages({
    database_id: setup.databases.accounts,
    filter: filter as never,
  });

  return pages.map(mapAccount).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCategories(householdId: string): Promise<CategoryRecord[]> {
  const setup = await ensureNotionSetup();

  const pages = await queryAllPages({
    database_id: setup.databases.categories,
    filter: {
      property: "Household",
      relation: { contains: householdId },
    },
  });

  return pages.map(mapCategory).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listExpenses(
  householdId: string,
  monthKey?: string,
): Promise<ExpenseRecord[]> {
  const setup = await ensureNotionSetup();

  const filter = monthKey
    ? {
        and: [
          { property: "Household", relation: { contains: householdId } },
          { property: "Month Key", rich_text: { equals: monthKey } },
        ],
      }
    : { property: "Household", relation: { contains: householdId } };

  const pages = await queryAllPages({
    database_id: setup.databases.expenses,
    filter: filter as never,
  });

  return pages
    .map(mapExpense)
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
}

export async function listIncome(
  householdId: string,
  monthKey?: string,
): Promise<IncomeRecord[]> {
  const setup = await ensureNotionSetup();

  const filter = monthKey
    ? {
        and: [
          { property: "Household", relation: { contains: householdId } },
          { property: "Month Key", rich_text: { equals: monthKey } },
        ],
      }
    : { property: "Household", relation: { contains: householdId } };

  const pages = await queryAllPages({
    database_id: setup.databases.income,
    filter: filter as never,
  });

  return pages
    .map(mapIncome)
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
}

export async function listHiddenSavings(
  householdId: string,
  monthKey?: string,
): Promise<HiddenSavingsRecord[]> {
  const setup = await ensureNotionSetup();

  const filter = monthKey
    ? {
        and: [
          { property: "Household", relation: { contains: householdId } },
          { property: "Month Key", rich_text: { equals: monthKey } },
        ],
      }
    : { property: "Household", relation: { contains: householdId } };

  const pages = await queryAllPages({
    database_id: setup.databases.hiddenSavings,
    filter: filter as never,
  });

  return pages
    .map(mapSavings)
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
}

export async function createAccount(
  householdId: string,
  input: { name: string; type: AccountType; balance: number; monthKey: string },
): Promise<AccountRecord> {
  const setup = await ensureNotionSetup();

  const created = await withNotionRetry(() =>
    notion.pages.create({
      parent: { database_id: setup.databases.accounts },
      properties: {
        Name: { title: titleValue(input.name) },
        Type: { select: { name: input.type } },
        Balance: { number: input.balance },
        Household: { relation: [{ id: householdId }] },
        "Month Key": { rich_text: richTextValue(input.monthKey) },
      },
    }),
  );

  const page = await getPageOrThrow(created.id);
  return mapAccount(page);
}

export async function updateAccount(
  householdId: string,
  input: { id: string; name?: string; type?: AccountType; balance?: number },
): Promise<AccountRecord> {
  const account = await getAccount(householdId, input.id);

  await withNotionRetry(() =>
    notion.pages.update({
      page_id: account.id,
      properties: {
        ...(input.name ? { Name: { title: titleValue(input.name) } } : {}),
        ...(input.type ? { Type: { select: { name: input.type } } } : {}),
        ...(typeof input.balance === "number" ? { Balance: { number: input.balance } } : {}),
      },
    }),
  );

  return getAccount(householdId, account.id);
}

export async function deleteAccount(householdId: string, accountId: string): Promise<void> {
  await getAccount(householdId, accountId);

  await withNotionRetry(() =>
    notion.pages.update({
      page_id: accountId,
      archived: true,
    }),
  );
}

export async function getAccount(
  householdId: string,
  accountId: string,
): Promise<AccountRecord> {
  const page = await getPageOrThrow(accountId);
  const account = mapAccount(page);

  if (account.householdId !== householdId) {
    throw new HttpError(403, "Account access denied");
  }

  return account;
}

export async function getCategory(
  householdId: string,
  categoryId: string,
): Promise<CategoryRecord> {
  const page = await getPageOrThrow(categoryId);
  const category = mapCategory(page);

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
  const setup = await ensureNotionSetup();

  const created = await withNotionRetry(() =>
    notion.pages.create({
      parent: { database_id: setup.databases.categories },
      properties: {
        Name: { title: titleValue(input.name) },
        Color: { select: { name: input.color } },
        "Budget Limit": { number: input.budgetLimit },
        Household: { relation: [{ id: householdId }] },
      },
    }),
  );

  const page = await getPageOrThrow(created.id);
  return mapCategory(page);
}

export async function updateCategory(
  householdId: string,
  input: { id: string; name?: string; color?: string; budgetLimit?: number },
): Promise<CategoryRecord> {
  const category = await getCategory(householdId, input.id);

  await withNotionRetry(() =>
    notion.pages.update({
      page_id: category.id,
      properties: {
        ...(input.name ? { Name: { title: titleValue(input.name) } } : {}),
        ...(input.color ? { Color: { select: { name: input.color } } } : {}),
        ...(typeof input.budgetLimit === "number"
          ? { "Budget Limit": { number: input.budgetLimit } }
          : {}),
      },
    }),
  );

  const page = await getPageOrThrow(category.id);
  return mapCategory(page);
}

export async function getExpense(
  householdId: string,
  expenseId: string,
): Promise<ExpenseRecord> {
  const page = await getPageOrThrow(expenseId);
  const expense = mapExpense(page);

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
  const setup = await ensureNotionSetup();
  const account = await getAccount(householdId, input.accountId);
  await getCategory(householdId, input.categoryId);

  if (account.balance < input.amount) {
    throw new HttpError(400, "Insufficient account balance");
  }

  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  const created = await withNotionRetry(() =>
    notion.pages.create({
      parent: { database_id: setup.databases.expenses },
      properties: {
        Title: { title: titleValue(input.title) },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        Account: { relation: [{ id: input.accountId }] },
        Category: { relation: [{ id: input.categoryId }] },
        "Month Key": { rich_text: richTextValue(resolvedMonthKey) },
        Note: { rich_text: richTextValue(input.note ?? "") },
        Household: { relation: [{ id: householdId }] },
      },
    }),
  );

  await updateAccountBalance(account.id, account.balance - input.amount);
  const page = await getPageOrThrow(created.id);
  return mapExpense(page);
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

    await updateAccountBalance(oldAccount.id, oldAccount.balance + existing.amount);
    if (newAccount.balance < input.amount) {
      throw new HttpError(400, "Insufficient destination account balance");
    }
    await updateAccountBalance(newAccount.id, newAccount.balance - input.amount);
  }

  await withNotionRetry(() =>
    notion.pages.update({
      page_id: input.id,
      properties: {
        Title: { title: titleValue(input.title) },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        Account: { relation: [{ id: input.accountId }] },
        Category: { relation: [{ id: input.categoryId }] },
        "Month Key": { rich_text: richTextValue(resolvedMonthKey) },
        Note: { rich_text: richTextValue(input.note ?? "") },
      },
    }),
  );

  return getExpense(householdId, input.id);
}

export async function deleteExpense(householdId: string, expenseId: string): Promise<void> {
  const expense = await getExpense(householdId, expenseId);
  const account = await getAccount(householdId, expense.accountId);

  await updateAccountBalance(account.id, account.balance + expense.amount);
  await withNotionRetry(() =>
    notion.pages.update({
      page_id: expense.id,
      archived: true,
    }),
  );
}

export async function getIncome(
  householdId: string,
  incomeId: string,
): Promise<IncomeRecord> {
  const page = await getPageOrThrow(incomeId);
  const income = mapIncome(page);

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
  const setup = await ensureNotionSetup();
  const account = await getAccount(householdId, input.accountId);
  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  const created = await withNotionRetry(() =>
    notion.pages.create({
      parent: { database_id: setup.databases.income },
      properties: {
        Title: { title: titleValue(input.title) },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        Account: { relation: [{ id: input.accountId }] },
        "Month Key": { rich_text: richTextValue(resolvedMonthKey) },
        Household: { relation: [{ id: householdId }] },
      },
    }),
  );

  await updateAccountBalance(account.id, account.balance + input.amount);
  const page = await getPageOrThrow(created.id);
  return mapIncome(page);
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

  await withNotionRetry(() =>
    notion.pages.update({
      page_id: input.id,
      properties: {
        Title: { title: titleValue(input.title) },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        Account: { relation: [{ id: input.accountId }] },
        "Month Key": { rich_text: richTextValue(resolvedMonthKey) },
      },
    }),
  );

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
  await withNotionRetry(() =>
    notion.pages.update({
      page_id: income.id,
      archived: true,
    }),
  );
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
  const setup = await ensureNotionSetup();
  const account = await getAccount(householdId, input.accountId);

  if (account.balance < input.amount) {
    throw new HttpError(400, "Insufficient account balance");
  }

  const resolvedMonthKey = input.monthKey || deriveMonthKeyFromDate(input.date);

  const created = await withNotionRetry(() =>
    notion.pages.create({
      parent: { database_id: setup.databases.hiddenSavings },
      properties: {
        Title: { title: titleValue(input.title) },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        "Month Key": { rich_text: richTextValue(resolvedMonthKey) },
        Household: { relation: [{ id: householdId }] },
      },
    }),
  );

  await updateAccountBalance(account.id, account.balance - input.amount);

  const page = await getPageOrThrow(created.id);
  return mapSavings(page);
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

  const templates = previousAccounts.length
    ? previousAccounts.map((account) => ({
        name: account.name,
        type: account.type,
        balance: duplicatePrevious || carryForward ? account.balance : 0,
      }))
    : DEFAULT_ACCOUNT_TEMPLATES.map((account) => ({
        ...account,
        balance: 0,
      }));

  for (const template of templates) {
    await createAccount(householdId, {
      name: template.name,
      type: template.type,
      balance: template.balance,
      monthKey,
    });
  }

  return listAccounts(householdId, monthKey);
}
