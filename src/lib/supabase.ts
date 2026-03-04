import { createClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/api";
import { env } from "@/lib/env";

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export function assertSupabase<T>(
  data: T | null,
  error: { message?: string } | null,
  fallbackMessage: string,
): T {
  if (error) {
    throw new HttpError(500, `${fallbackMessage}: ${error.message ?? "Unknown error"}`);
  }

  if (data == null) {
    throw new HttpError(500, fallbackMessage);
  }

  return data;
}
