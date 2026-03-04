import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import {
  createExpense,
  deleteExpense,
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

    const expense = await updateExpense(session.householdId, parsed.data);
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

    await deleteExpense(session.householdId, parsed.data.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
