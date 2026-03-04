import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { logActivitySafely } from "@/lib/activity-log";
import {
  createAccount,
  deleteAccount,
  getAccount,
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
    void logActivitySafely({
      session,
      action: "create",
      entity: "account",
      description: `Created account "${account.name}" (${account.type}) with balance ${account.balance}`,
      monthKey: account.monthKey,
    });
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
      const transferNote = parsedTransfer.data.note?.trim();
      void logActivitySafely({
        session,
        action: "transfer",
        entity: "account",
        description: `Transferred ${parsedTransfer.data.amount} from "${result.from.name}" to "${result.to.name}"${transferNote ? ` · Note: ${transferNote}` : ""}`,
        monthKey: result.from.monthKey,
      });
      return apiSuccess(result);
    }

    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return apiFailure("Invalid account update payload", 400, parsed.error.flatten());
    }

    const previous = await getAccount(session.householdId, parsed.data.id);
    const account = await updateAccount(session.householdId, parsed.data);

    const changes: string[] = [];
    if (parsed.data.name && parsed.data.name !== previous.name) {
      changes.push(`name "${previous.name}"→"${account.name}"`);
    }
    if (parsed.data.type && parsed.data.type !== previous.type) {
      changes.push(`type ${previous.type}→${account.type}`);
    }
    if (typeof parsed.data.balance === "number" && parsed.data.balance !== previous.balance) {
      changes.push(`balance ${previous.balance}→${account.balance}`);
    }

    void logActivitySafely({
      session,
      action: "update",
      entity: "account",
      description:
        changes.length > 0
          ? `Updated account "${account.name}" (${changes.join(", ")})`
          : `Updated account "${account.name}"`,
      monthKey: account.monthKey,
    });
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

    const account = await getAccount(session.householdId, parsed.data.id);
    await deleteAccount(session.householdId, parsed.data.id);
    void logActivitySafely({
      session,
      action: "delete",
      entity: "account",
      description: `Deleted account "${account.name}" (${account.type})`,
      monthKey: account.monthKey,
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
