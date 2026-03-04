import bcrypt from "bcryptjs";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  getDataSourceIdByDatabaseId,
  notion,
  queryAllPages,
  withNotionRetry,
} from "@/lib/notion";
import { env, normalizeNotionId } from "@/lib/env";
import type { DatabaseIds } from "@/lib/types";
import { HttpError } from "@/lib/api";

const DATABASE_TITLES = {
  households: "Households",
  users: "Users",
  accounts: "Accounts",
  categories: "Categories",
  expenses: "Expenses",
  income: "Income",
  hiddenSavings: "Hidden Savings",
} as const;

const SYSTEM_CONFIG_PAGE_TITLE = "System Config";
const DEFAULT_HOUSEHOLD_NAME = "Couple Household";

export const DEFAULT_COUPLE_USERS = [
  { name: "Muneeb", username: "muneeb", password: "muneeb123" },
  { name: "Ayesha", username: "ayesha", password: "ayesha123" },
] as const;

const DEFAULT_CATEGORIES = [
  { name: "Food", color: "green" },
  { name: "Transport", color: "blue" },
  { name: "Bills", color: "red" },
  { name: "Education", color: "purple" },
  { name: "Family", color: "brown" },
  { name: "Health", color: "pink" },
  { name: "Entertainment", color: "yellow" },
  { name: "Investment", color: "gray" },
  { name: "Other", color: "default" },
] as const;

export interface SetupState {
  databases: DatabaseIds;
  householdId: string;
}

let setupCache: SetupState | null = null;
let setupPromise: Promise<SetupState> | null = null;

function title(content: string) {
  return [{ type: "text" as const, text: { content } }];
}

function richText(content: string) {
  return content
    ? [{ type: "text" as const, text: { content } }]
    : [];
}

async function listParentBlocks(): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  while (true) {
    const response = await withNotionRetry(() =>
      notion.blocks.children.list({
        block_id: normalizeNotionId(env.NOTION_PARENT_PAGE_ID),
        start_cursor: cursor,
        page_size: 100,
      }),
    );

    response.results.forEach((block) => {
      if ("type" in block) {
        blocks.push(block as BlockObjectResponse);
      }
    });

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    cursor = response.next_cursor;
  }

  return blocks;
}

async function createDatabase(titleText: string, properties: Record<string, unknown>) {
  const database = await withNotionRetry(() =>
    notion.databases.create({
      parent: { type: "page_id", page_id: normalizeNotionId(env.NOTION_PARENT_PAGE_ID) },
      title: title(titleText),
      initial_data_source: {
        properties: properties as never,
      },
    }),
  );

  return database.id;
}

async function ensureDatabases(): Promise<DatabaseIds> {
  const blocks = await listParentBlocks();
  const existing = new Map<string, string>();

  blocks.forEach((block) => {
    if (block.type === "child_database") {
      existing.set(block.child_database.title.trim(), block.id);
    }
  });

  const ids: Partial<DatabaseIds> = {
    households: existing.get(DATABASE_TITLES.households),
    users: existing.get(DATABASE_TITLES.users),
    accounts: existing.get(DATABASE_TITLES.accounts),
    categories: existing.get(DATABASE_TITLES.categories),
    expenses: existing.get(DATABASE_TITLES.expenses),
    income: existing.get(DATABASE_TITLES.income),
    hiddenSavings: existing.get(DATABASE_TITLES.hiddenSavings),
  };

  const ensureDataSourceId = async (key: keyof DatabaseIds): Promise<string> => {
    const databaseId = ids[key];
    if (!databaseId) {
      throw new HttpError(500, `Missing database id for ${String(key)}`);
    }

    return getDataSourceIdByDatabaseId(databaseId);
  };

  if (!ids.households) {
    ids.households = await createDatabase(DATABASE_TITLES.households, {
      Name: { title: {} },
      "Created At": { date: {} },
    });
  }

  const householdsDataSourceId = await ensureDataSourceId("households");

  if (!ids.users) {
    ids.users = await createDatabase(DATABASE_TITLES.users, {
      Name: { title: {} },
      Username: { rich_text: {} },
      "Password Hash": { rich_text: {} },
      Household: {
        relation: { data_source_id: householdsDataSourceId, single_property: {} },
      },
    });
  }

  if (!ids.accounts) {
    ids.accounts = await createDatabase(DATABASE_TITLES.accounts, {
      Name: { title: {} },
      Type: {
        select: {
          options: [
            { name: "Cash", color: "green" },
            { name: "Bank", color: "blue" },
            { name: "Easypaisa", color: "orange" },
            { name: "Savings", color: "purple" },
            { name: "Investment", color: "pink" },
            { name: "Other", color: "gray" },
          ],
        },
      },
      Balance: { number: { format: "number_with_commas" } },
      Household: {
        relation: { data_source_id: householdsDataSourceId, single_property: {} },
      },
      "Month Key": { rich_text: {} },
    });
  }

  if (!ids.categories) {
    ids.categories = await createDatabase(DATABASE_TITLES.categories, {
      Name: { title: {} },
      Color: {
        select: {
          options: [
            { name: "default", color: "default" },
            { name: "gray", color: "gray" },
            { name: "brown", color: "brown" },
            { name: "orange", color: "orange" },
            { name: "yellow", color: "yellow" },
            { name: "green", color: "green" },
            { name: "blue", color: "blue" },
            { name: "purple", color: "purple" },
            { name: "pink", color: "pink" },
            { name: "red", color: "red" },
          ],
        },
      },
      "Budget Limit": { number: { format: "number_with_commas" } },
      Household: {
        relation: { data_source_id: householdsDataSourceId, single_property: {} },
      },
    });
  }

  const accountsDataSourceId = await ensureDataSourceId("accounts");
  const categoriesDataSourceId = await ensureDataSourceId("categories");

  if (!ids.expenses) {
    ids.expenses = await createDatabase(DATABASE_TITLES.expenses, {
      Title: { title: {} },
      Amount: { number: { format: "number_with_commas" } },
      Date: { date: {} },
      Account: {
        relation: { data_source_id: accountsDataSourceId, single_property: {} },
      },
      Category: {
        relation: { data_source_id: categoriesDataSourceId, single_property: {} },
      },
      "Month Key": { rich_text: {} },
      Note: { rich_text: {} },
      Household: {
        relation: { data_source_id: householdsDataSourceId, single_property: {} },
      },
    });
  }

  if (!ids.income) {
    ids.income = await createDatabase(DATABASE_TITLES.income, {
      Title: { title: {} },
      Amount: { number: { format: "number_with_commas" } },
      Date: { date: {} },
      Account: {
        relation: { data_source_id: accountsDataSourceId, single_property: {} },
      },
      "Month Key": { rich_text: {} },
      Household: {
        relation: { data_source_id: householdsDataSourceId, single_property: {} },
      },
    });
  }

  if (!ids.hiddenSavings) {
    ids.hiddenSavings = await createDatabase(DATABASE_TITLES.hiddenSavings, {
      Title: { title: {} },
      Amount: { number: { format: "number_with_commas" } },
      Date: { date: {} },
      "Month Key": { rich_text: {} },
      Household: {
        relation: { data_source_id: householdsDataSourceId, single_property: {} },
      },
    });
  }

  return ids as DatabaseIds;
}

async function ensureSystemConfigPage(databaseIds: DatabaseIds): Promise<void> {
  const blocks = await listParentBlocks();
  const existingConfig = blocks.find(
    (block) =>
      block.type === "child_page" &&
      block.child_page.title.trim().toLowerCase() ===
        SYSTEM_CONFIG_PAGE_TITLE.toLowerCase(),
  );

  let configPageId = existingConfig?.id;

  if (!configPageId) {
    const page = await withNotionRetry(() =>
      notion.pages.create({
        parent: { page_id: normalizeNotionId(env.NOTION_PARENT_PAGE_ID) },
        properties: {
          title: {
            title: title(SYSTEM_CONFIG_PAGE_TITLE),
          },
        },
      }),
    );

    if (page.object !== "page") {
      throw new HttpError(500, "Failed to create System Config page");
    }

    configPageId = page.id;
  }

  const marker = `DB_IDS::${JSON.stringify(databaseIds)}`;
  const existingBlocks = await withNotionRetry(() =>
    notion.blocks.children.list({
      block_id: configPageId,
      page_size: 100,
    }),
  );

  const alreadyWritten = existingBlocks.results.some((block) => {
    if (!("type" in block) || block.type !== "paragraph") {
      return false;
    }

    return block.paragraph.rich_text.some((item) => item.plain_text.includes("DB_IDS::"));
  });

  if (!alreadyWritten) {
    await withNotionRetry(() =>
      notion.blocks.children.append({
        block_id: configPageId,
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: marker } }],
            },
          },
        ],
      }),
    );
  }
}

async function ensureDefaultHousehold(databaseIds: DatabaseIds): Promise<string> {
  const existingHouseholds = await queryAllPages({
    database_id: databaseIds.households,
    filter: {
      property: "Name",
      title: {
        equals: DEFAULT_HOUSEHOLD_NAME,
      },
    },
  });

  if (existingHouseholds[0]) {
    return existingHouseholds[0].id;
  }

  const page = await withNotionRetry(() =>
    notion.pages.create({
      parent: { database_id: databaseIds.households },
      properties: {
        Name: { title: title(DEFAULT_HOUSEHOLD_NAME) },
        "Created At": { date: { start: new Date().toISOString() } },
      },
    }),
  );

  if (page.object !== "page") {
    throw new HttpError(500, "Failed to create household");
  }

  return page.id;
}

async function ensureDefaultUsers(
  databaseIds: DatabaseIds,
  householdId: string,
): Promise<void> {
  const users = await queryAllPages({
    database_id: databaseIds.users,
    filter: {
      property: "Household",
      relation: {
        contains: householdId,
      },
    },
  });

  const usersByUsername = new Map<string, string>();

  users.forEach((user) => {
    const property = user.properties.Username;
    if (property?.type !== "rich_text") {
      return;
    }

    const username = property.rich_text
      .map((item) => item.plain_text)
      .join("")
      .trim()
      .toLowerCase();

    if (username) {
      usersByUsername.set(username, user.id);
    }
  });

  const legacyUsernameMap: Record<string, string[]> = {
    muneeb: ["husband"],
    ayesha: ["wife"],
  };

  for (const baseUser of DEFAULT_COUPLE_USERS) {
    const passwordHash = await bcrypt.hash(baseUser.password, 10);

    const existingId = usersByUsername.get(baseUser.username);
    const legacyId = legacyUsernameMap[baseUser.username]
      ?.map((legacyUsername) => usersByUsername.get(legacyUsername))
      .find(Boolean);

    const targetPageId = existingId ?? legacyId;

    if (targetPageId) {
      await withNotionRetry(() =>
        notion.pages.update({
          page_id: targetPageId,
          properties: {
            Name: { title: title(baseUser.name) },
            Username: { rich_text: richText(baseUser.username) },
            "Password Hash": { rich_text: richText(passwordHash) },
            Household: { relation: [{ id: householdId }] },
          },
        }),
      );

      usersByUsername.set(baseUser.username, targetPageId);
      continue;
    }

    const created = await withNotionRetry(() =>
      notion.pages.create({
        parent: { database_id: databaseIds.users },
        properties: {
          Name: { title: title(baseUser.name) },
          Username: { rich_text: richText(baseUser.username) },
          "Password Hash": { rich_text: richText(passwordHash) },
          Household: { relation: [{ id: householdId }] },
        },
      }),
    );

    usersByUsername.set(baseUser.username, created.id);
  }
}

async function ensureDefaultCategories(
  databaseIds: DatabaseIds,
  householdId: string,
): Promise<void> {
  const categories = await queryAllPages({
    database_id: databaseIds.categories,
    filter: {
      property: "Household",
      relation: {
        contains: householdId,
      },
    },
  });

  const existing = new Set(
    categories
      .map((category) => {
        const name = category.properties.Name;
        if (name?.type !== "title") {
          return "";
        }
        return name.title.map((item) => item.plain_text).join("").trim().toLowerCase();
      })
      .filter(Boolean),
  );

  for (const category of DEFAULT_CATEGORIES) {
    if (existing.has(category.name.toLowerCase())) {
      continue;
    }

    await withNotionRetry(() =>
      notion.pages.create({
        parent: { database_id: databaseIds.categories },
        properties: {
          Name: { title: title(category.name) },
          Color: { select: { name: category.color } },
          "Budget Limit": { number: 0 },
          Household: { relation: [{ id: householdId }] },
        },
      }),
    );
  }
}

async function runSetup(): Promise<SetupState> {
  const databases = await ensureDatabases();
  await ensureSystemConfigPage(databases);

  const householdId = await ensureDefaultHousehold(databases);
  await ensureDefaultUsers(databases, householdId);
  await ensureDefaultCategories(databases, householdId);

  return {
    databases,
    householdId,
  };
}

export async function ensureNotionSetup(force = false): Promise<SetupState> {
  if (!force && setupCache) {
    return setupCache;
  }

  if (!force && setupPromise) {
    return setupPromise;
  }

  setupPromise = runSetup()
    .then((setup) => {
      setupCache = setup;
      return setup;
    })
    .finally(() => {
      setupPromise = null;
    });

  return setupPromise;
}
