import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import {
  createIncome,
  deleteIncome,
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

    const income = await updateIncome(session.householdId, parsed.data);
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

    await deleteIncome(session.householdId, parsed.data.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
