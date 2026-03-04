import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { logActivitySafely } from "@/lib/activity-log";
import {
  createHiddenSavings,
  listHiddenSavings,
} from "@/lib/budget-service";
import { createSavingsSchema } from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    const monthKey = request.nextUrl.searchParams.get("monthKey") ?? undefined;
    const all = request.nextUrl.searchParams.get("all") === "true";

    const savings = await listHiddenSavings(session.householdId, all ? undefined : monthKey);
    return apiSuccess({ savings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createSavingsSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid hidden savings payload", 400, parsed.error.flatten());
    }

    const savings = await createHiddenSavings(session.householdId, parsed.data);
    const savingsNote = parsed.data.note?.trim();
    void logActivitySafely({
      session,
      action: "create",
      entity: "hidden_savings",
      description: `Moved ${savings.amount} to hidden savings "${savings.title}"${savingsNote ? ` · Note: ${savingsNote}` : ""}`,
      monthKey: savings.monthKey,
    });
    return apiSuccess({ savings }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
