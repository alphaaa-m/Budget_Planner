import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { listActivityLogs } from "@/lib/activity-log";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "40");
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 40;

    const logs = await listActivityLogs(session.householdId, safeLimit);
    return apiSuccess({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
