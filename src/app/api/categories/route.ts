import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { logActivitySafely } from "@/lib/activity-log";
import {
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "@/lib/budget-service";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const categories = await listCategories(session.householdId);
    return apiSuccess({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid category payload", 400, parsed.error.flatten());
    }

    const category = await createCategory(session.householdId, parsed.data);
    void logActivitySafely({
      session,
      action: "create",
      entity: "category",
      description: `Created category "${category.name}" with budget ${category.budgetLimit}`,
    });
    return apiSuccess({ category }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid category update payload", 400, parsed.error.flatten());
    }

    const previous = await getCategory(session.householdId, parsed.data.id);
    const category = await updateCategory(session.householdId, parsed.data);

    const changes: string[] = [];
    if (previous.name !== category.name) {
      changes.push(`name "${previous.name}"→"${category.name}"`);
    }
    if (previous.color !== category.color) {
      changes.push(`color ${previous.color}→${category.color}`);
    }
    if (previous.budgetLimit !== category.budgetLimit) {
      changes.push(`budget ${previous.budgetLimit}→${category.budgetLimit}`);
    }

    void logActivitySafely({
      session,
      action: "update",
      entity: "category",
      description:
        changes.length > 0
          ? `Updated category "${category.name}" (${changes.join(", ")})`
          : `Updated category "${category.name}"`,
    });
    return apiSuccess({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
