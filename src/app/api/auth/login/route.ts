import bcrypt from "bcryptjs";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import { applySessionCookie, createSessionToken } from "@/lib/auth";
import { findUserByUsername } from "@/lib/budget-service";
import { ensureNotionSetup } from "@/lib/notion-setup";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    await ensureNotionSetup();

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return apiFailure("Invalid login payload", 400, parsed.error.flatten());
    }

    const username = parsed.data.username.trim().toLowerCase();
    const user = await findUserByUsername(username);

    if (!user) {
      return apiFailure("Invalid credentials", 401);
    }

    const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!matches) {
      return apiFailure("Invalid credentials", 401);
    }

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
      householdId: user.householdId,
    });

    const response = apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
    });

    applySessionCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
