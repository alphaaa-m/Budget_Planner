import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { logActivitySafely } from "@/lib/activity-log";
import { initializeMonthAccounts, listAccounts } from "@/lib/budget-service";
import { initializeMonthSchema, monthKeySchema } from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const monthKey = request.nextUrl.searchParams.get("monthKey");

    const parsed = monthKeySchema.safeParse(monthKey);
    if (!parsed.success) {
      return apiFailure("Invalid month key", 400, parsed.error.flatten());
    }

    const accounts = await initializeMonthAccounts(session.householdId, {
      monthKey: parsed.data,
      carryForward: false,
      duplicatePrevious: false,
    });

    return apiSuccess({
      monthKey: parsed.data,
      accounts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = initializeMonthSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid month initialization payload", 400, parsed.error.flatten());
    }

    const existingAccounts = await listAccounts(session.householdId, parsed.data.monthKey);
    const accounts = await initializeMonthAccounts(session.householdId, parsed.data);

    if (existingAccounts.length === 0 && accounts.length > 0) {
      const strategy = parsed.data.duplicatePrevious
        ? "duplicated previous balances"
        : parsed.data.carryForward
          ? "carried forward balances"
          : "zeroed balances";

      await logActivitySafely({
        session,
        action: "initialize",
        entity: "month",
        description: `Initialized month ${parsed.data.monthKey} with ${accounts.length} accounts (${strategy})`,
        monthKey: parsed.data.monthKey,
      });
    }

    return apiSuccess({
      monthKey: parsed.data.monthKey,
      accounts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
