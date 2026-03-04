import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";

export async function requireSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new HttpError(401, "Unauthorized");
  }
  return session;
}
