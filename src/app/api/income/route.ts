import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { logActivitySafely } from "@/lib/activity-log";
import {
  createIncome,
  deleteIncome,
  getIncome,
  listIncome,
  updateIncome,
} from "@/lib/budget-service";
import {
  createIncomeSchema,
  deleteEntitySchema,
  updateIncomeSchema,
} from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    const monthKey = request.nextUrl.searchParams.get("monthKey") ?? undefined;
    const all = request.nextUrl.searchParams.get("all") === "true";

    const income = await listIncome(session.householdId, all ? undefined : monthKey);
    return apiSuccess({ income });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createIncomeSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid income payload", 400, parsed.error.flatten());
    }

    const income = await createIncome(session.householdId, parsed.data);
    await logActivitySafely({
      session,
      action: "create",
      entity: "income",
      description: `Added income "${income.title}" for ${income.amount}`,
      monthKey: income.monthKey,
    });
    return apiSuccess({ income }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = updateIncomeSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid income update payload", 400, parsed.error.flatten());
    }

    const previous = await getIncome(session.householdId, parsed.data.id);
    const income = await updateIncome(session.householdId, parsed.data);

    const changes: string[] = [];
    if (previous.title !== income.title) {
      changes.push(`title "${previous.title}"→"${income.title}"`);
    }
    if (previous.amount !== income.amount) {
      changes.push(`amount ${previous.amount}→${income.amount}`);
    }
    if (previous.accountId !== income.accountId) {
      changes.push("account changed");
    }

    await logActivitySafely({
      session,
      action: "update",
      entity: "income",
      description:
        changes.length > 0
          ? `Updated income "${income.title}" (${changes.join(", ")})`
          : `Updated income "${income.title}"`,
      monthKey: income.monthKey,
    });
    return apiSuccess({ income });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = deleteEntitySchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid delete payload", 400, parsed.error.flatten());
    }

    const income = await getIncome(session.householdId, parsed.data.id);
    await deleteIncome(session.householdId, parsed.data.id);
    await logActivitySafely({
      session,
      action: "delete",
      entity: "income",
      description: `Deleted income "${income.title}" (${income.amount})`,
      monthKey: income.monthKey,
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
