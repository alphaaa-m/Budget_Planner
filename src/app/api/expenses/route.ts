import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { logActivitySafely } from "@/lib/activity-log";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from "@/lib/budget-service";
import {
  createExpenseSchema,
  deleteEntitySchema,
  updateExpenseSchema,
} from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    const monthKey = request.nextUrl.searchParams.get("monthKey") ?? undefined;
    const all = request.nextUrl.searchParams.get("all") === "true";

    const expenses = await listExpenses(session.householdId, all ? undefined : monthKey);
    return apiSuccess({ expenses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid expense payload", 400, parsed.error.flatten());
    }

    const expense = await createExpense(session.householdId, parsed.data);
    void logActivitySafely({
      session,
      action: "create",
      entity: "expense",
      description: `Added expense "${expense.title}" for ${expense.amount}`,
      monthKey: expense.monthKey,
    });
    return apiSuccess({ expense }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid expense update payload", 400, parsed.error.flatten());
    }

    const previous = await getExpense(session.householdId, parsed.data.id);
    const expense = await updateExpense(session.householdId, parsed.data);

    const changes: string[] = [];
    if (previous.title !== expense.title) {
      changes.push(`title "${previous.title}"→"${expense.title}"`);
    }
    if (previous.amount !== expense.amount) {
      changes.push(`amount ${previous.amount}→${expense.amount}`);
    }
    if (previous.accountId !== expense.accountId) {
      changes.push("account changed");
    }
    if (previous.categoryId !== expense.categoryId) {
      changes.push("category changed");
    }

    void logActivitySafely({
      session,
      action: "update",
      entity: "expense",
      description:
        changes.length > 0
          ? `Updated expense "${expense.title}" (${changes.join(", ")})`
          : `Updated expense "${expense.title}"`,
      monthKey: expense.monthKey,
    });
    return apiSuccess({ expense });
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

    const expense = await getExpense(session.householdId, parsed.data.id);
    await deleteExpense(session.householdId, parsed.data.id);
    void logActivitySafely({
      session,
      action: "delete",
      entity: "expense",
      description: `Deleted expense "${expense.title}" (${expense.amount})`,
      monthKey: expense.monthKey,
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
