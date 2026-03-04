import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  transferBetweenAccounts,
  updateAccount,
} from "@/lib/budget-service";
import {
  createAccountSchema,
  deleteEntitySchema,
  transferSchema,
  updateAccountSchema,
} from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    const monthKey = request.nextUrl.searchParams.get("monthKey") ?? undefined;
    const all = request.nextUrl.searchParams.get("all") === "true";

    const accounts = await listAccounts(session.householdId, all ? undefined : monthKey);
    return apiSuccess({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid account payload", 400, parsed.error.flatten());
    }

    const account = await createAccount(session.householdId, parsed.data);
    return apiSuccess({ account }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();

    if (body?.mode === "transfer") {
      const parsedTransfer = transferSchema.safeParse(body);
      if (!parsedTransfer.success) {
        return apiFailure("Invalid transfer payload", 400, parsedTransfer.error.flatten());
      }

      const result = await transferBetweenAccounts(session.householdId, parsedTransfer.data);
      return apiSuccess(result);
    }

    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return apiFailure("Invalid account update payload", 400, parsed.error.flatten());
    }

    const account = await updateAccount(session.householdId, parsed.data);
    return apiSuccess({ account });
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

    await deleteAccount(session.householdId, parsed.data.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
