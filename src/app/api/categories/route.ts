import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import {
  createCategory,
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

    const category = await updateCategory(session.householdId, parsed.data);
    return apiSuccess({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
