import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { SessionPayload } from "@/lib/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_CACHE_TTL_MS = 15_000;
const sessionCache = new Map<string, { expiresAt: number; session: SessionPayload }>();

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

async function resolveSessionFromDatabase(session: SessionPayload): Promise<SessionPayload> {
  if (!isUuid(session.userId)) {
    throw new HttpError(401, "Session expired. Please login again.");
  }

  const cached = sessionCache.get(session.userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, name, username, household_id")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to validate session: ${error.message ?? "Unknown error"}`);
  }

  if (!data?.id || !data?.household_id) {
    throw new HttpError(401, "Session expired. Please login again.");
  }

  const householdId = String(data.household_id);
  if (!isUuid(householdId)) {
    throw new HttpError(401, "Session expired. Please login again.");
  }

  const resolved: SessionPayload = {
    userId: String(data.id),
    username: String(data.username ?? "").trim().toLowerCase(),
    name: String(data.name ?? ""),
    householdId,
  };

  sessionCache.set(session.userId, {
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    session: resolved,
  });

  return resolved;
}

export async function requireSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new HttpError(401, "Unauthorized");
  }

  return resolveSessionFromDatabase(session);
}
