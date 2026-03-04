import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return apiFailure("Unauthorized", 401);
    }

    return apiSuccess({
      user: {
        id: session.userId,
        name: session.name,
        username: session.username,
        householdId: session.householdId,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
