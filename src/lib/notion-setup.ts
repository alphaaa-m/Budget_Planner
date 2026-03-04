import bcrypt from "bcryptjs";
import { HttpError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase";
import type { DatabaseIds } from "@/lib/types";

const DEFAULT_HOUSEHOLD_NAME = "Couple Household";

const TABLE_IDS: DatabaseIds = {
  households: "households",
  users: "app_users",
  accounts: "accounts",
  categories: "categories",
  expenses: "expenses",
  income: "income",
  hiddenSavings: "hidden_savings",
};

export const DEFAULT_COUPLE_USERS = [
  { name: "Muneeb", username: "muneeb", password: "muneeb123" },
  { name: "Ayesha", username: "ayesha", password: "ayesha123" },
] as const;

export interface SetupState {
  databases: DatabaseIds;
  householdId: string;
}

let setupCache: SetupState | null = null;
let setupPromise: Promise<SetupState> | null = null;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function ensureNoSupabaseError(error: { message?: string } | null, context: string): void {
  if (error) {
    throw new HttpError(500, `${context}: ${error.message ?? "Unknown Supabase error"}`);
  }
}

async function assertTableExists(tableName: string): Promise<void> {
  const { error } = await supabaseAdmin.from(tableName).select("id").limit(1);
  ensureNoSupabaseError(
    error,
    `Supabase table \"${tableName}\" is not ready. Follow README setup SQL first`,
  );
}

async function ensureSupabaseSchema(): Promise<void> {
  await Promise.all([
    assertTableExists("households"),
    assertTableExists("app_users"),
    assertTableExists("accounts"),
    assertTableExists("categories"),
    assertTableExists("expenses"),
    assertTableExists("income"),
    assertTableExists("hidden_savings"),
    assertTableExists("activity_logs"),
  ]);
}

async function ensureDefaultHousehold(): Promise<string> {
  const { data: existing, error } = await supabaseAdmin
    .from("households")
    .select("id")
    .eq("name", DEFAULT_HOUSEHOLD_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  ensureNoSupabaseError(error, "Failed to read households");

  if (existing?.id) {
    return String(existing.id);
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("households")
    .insert({ name: DEFAULT_HOUSEHOLD_NAME })
    .select("id")
    .single();

  ensureNoSupabaseError(createError, "Failed to create default household");

  if (!created?.id) {
    throw new HttpError(500, "Failed to create default household");
  }

  return String(created.id);
}

async function ensureDefaultUsers(householdId: string): Promise<void> {
  const { data: users, error } = await supabaseAdmin
    .from("app_users")
    .select("id, username, name, password_hash")
    .eq("household_id", householdId);

  ensureNoSupabaseError(error, "Failed to read users");

  const usersByUsername = new Map<string, {
    id: string;
    name: string;
    passwordHash: string;
  }>();
  (users ?? []).forEach((user) => {
    const username = normalizeUsername(String(user.username ?? ""));
    if (username) {
      usersByUsername.set(username, {
        id: String(user.id),
        name: String(user.name ?? ""),
        passwordHash: String(user.password_hash ?? ""),
      });
    }
  });

  const legacyUsernameMap: Record<string, string[]> = {
    muneeb: ["husband"],
    ayesha: ["wife"],
  };

  const getPasswordHash = async (plainPassword: string) => bcrypt.hash(plainPassword, 10);

  for (const baseUser of DEFAULT_COUPLE_USERS) {
    const username = normalizeUsername(baseUser.username);
    const directExisting = usersByUsername.get(username);

    if (
      directExisting &&
      directExisting.name === baseUser.name &&
      Boolean(directExisting.passwordHash)
    ) {
      continue;
    }

    const targetId = [username, ...(legacyUsernameMap[username] ?? [])]
      .map((candidate) => usersByUsername.get(candidate)?.id)
      .find(Boolean);

    if (targetId) {
      const existingTarget =
        directExisting ??
        [username, ...(legacyUsernameMap[username] ?? [])]
          .map((candidate) => usersByUsername.get(candidate))
          .find(Boolean);

      const patch: {
        name: string;
        username: string;
        household_id: string;
        password_hash?: string;
      } = {
        name: baseUser.name,
        username,
        household_id: householdId,
      };

      if (!existingTarget?.passwordHash) {
        patch.password_hash = await getPasswordHash(baseUser.password);
      }

      const { error: updateError } = await supabaseAdmin
        .from("app_users")
        .update(patch)
        .eq("id", targetId);

      ensureNoSupabaseError(updateError, `Failed to update user ${username}`);
      usersByUsername.set(username, {
        id: targetId,
        name: baseUser.name,
        passwordHash: patch.password_hash ?? existingTarget?.passwordHash ?? "",
      });
      continue;
    }

    const passwordHash = await getPasswordHash(baseUser.password);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("app_users")
      .insert({
        name: baseUser.name,
        username,
        password_hash: passwordHash,
        household_id: householdId,
      })
      .select("id")
      .single();

    ensureNoSupabaseError(insertError, `Failed to create user ${username}`);
    if (inserted?.id) {
      usersByUsername.set(username, {
        id: String(inserted.id),
        name: baseUser.name,
        passwordHash,
      });
    }
  }
}

async function runSetup(): Promise<SetupState> {
  await ensureSupabaseSchema();
  const householdId = await ensureDefaultHousehold();
  await ensureDefaultUsers(householdId);

  return {
    databases: TABLE_IDS,
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
