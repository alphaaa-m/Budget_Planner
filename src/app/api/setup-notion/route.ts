import { apiSuccess, handleApiError } from "@/lib/api";
import { DEFAULT_COUPLE_USERS, ensureNotionSetup } from "@/lib/notion-setup";

export async function GET() {
  try {
    const setup = await ensureNotionSetup();

    return apiSuccess({
      ready: true,
      householdId: setup.householdId,
      databaseIds: setup.databases,
      defaultUsers: DEFAULT_COUPLE_USERS.map((item) => ({
        username: item.username,
        password: item.password,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  return GET();
}
