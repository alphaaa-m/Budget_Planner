import { HttpError } from "@/lib/api";
import { ensureNotionSetup } from "@/lib/notion-setup";
import { supabaseAdmin } from "@/lib/supabase";
import type { SessionPayload } from "@/lib/types";

export type ActivityLogRecord = {
  id: string;
  timestamp: string;
  actorName: string;
  actorUsername: string;
  action: string;
  entity: string;
  description: string;
  householdId: string;
  monthKey?: string | null;
};

function ensureNoSupabaseError(error: { message?: string } | null, context: string): void {
  if (error) {
    throw new HttpError(500, `${context}: ${error.message ?? "Unknown Supabase error"}`);
  }
}

export async function logActivity(args: {
  session: Pick<SessionPayload, "name" | "username" | "householdId">;
  action: string;
  entity: string;
  description: string;
  monthKey?: string | null;
}): Promise<void> {
  await ensureNotionSetup();

  const { error } = await supabaseAdmin.from("activity_logs").insert({
    household_id: args.session.householdId,
    actor_name: args.session.name,
    actor_username: args.session.username,
    action: args.action,
    entity: args.entity,
    description: args.description,
    month_key: args.monthKey ?? null,
  });

  ensureNoSupabaseError(error, "Activity log write failed");
}

export async function logActivitySafely(args: {
  session: Pick<SessionPayload, "name" | "username" | "householdId">;
  action: string;
  entity: string;
  description: string;
  monthKey?: string | null;
}): Promise<void> {
  try {
    await logActivity(args);
  } catch (error) {
    console.error("Activity log write failed", error);
  }
}

export async function listActivityLogs(
  householdId: string,
  limit = 40,
): Promise<ActivityLogRecord[]> {
  await ensureNotionSetup();

  const safeLimit = Math.max(1, Math.min(limit, 200));

  const { data, error } = await supabaseAdmin
    .from("activity_logs")
    .select(
      "id, created_at, actor_name, actor_username, action, entity, description, household_id, month_key",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  ensureNoSupabaseError(error, "Failed to fetch activity logs");

  return (data ?? []).map((row) => ({
    id: String(row.id),
    timestamp: String(row.created_at ?? ""),
    actorName: String(row.actor_name ?? ""),
    actorUsername: String(row.actor_username ?? ""),
    action: String(row.action ?? ""),
    entity: String(row.entity ?? ""),
    description: String(row.description ?? ""),
    householdId: String(row.household_id ?? ""),
    monthKey: row.month_key ? String(row.month_key) : null,
  }));
}
