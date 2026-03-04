import { apiSuccess, handleApiError } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    const response = apiSuccess({ loggedOut: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
